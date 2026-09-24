import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createClient as createSessionClient } from "@/lib/supabase/server";
import type { AdminUser, Role } from "@/lib/types";

export const dynamic = "force-dynamic";

const ROLES: Role[] = ["admin", "member"];

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.includes(value as Role);
}

async function requireAdmin() {
  const session = await createSessionClient();
  const { data: userData, error: userError } = await session.auth.getUser();
  const user = userData.user;
  if (userError || !user) {
    return { error: jsonError("Sign in required.", 401) };
  }

  const { data: profile, error: profileError } = await session
    .from("crm_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return { error: jsonError(profileError.message, 500) };
  }
  if (profile?.role !== "admin") {
    return { error: jsonError("Admin access required.", 403) };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return { error: jsonError("User admin is not configured.", 500) };
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { user, admin };
}

async function isOnlyAdmin(admin: SupabaseClient, targetId: string) {
  const { data, error } = await admin.from("crm_profiles").select("id").eq("role", "admin");
  if (error) {
    return { error: jsonError(error.message, 500) };
  }
  const admins = data ?? [];
  return { blocked: admins.length === 1 && admins[0]?.id === targetId };
}

async function listAllAuthUsers(admin: SupabaseClient) {
  const users: { id: string; email?: string; created_at: string }[] = [];
  const perPage = 1000;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) return { error: jsonError(error.message, 500) };
    users.push(...data.users);
    if (data.users.length < perPage) break;
  }
  return { users };
}

export async function GET() {
  const gate = await requireAdmin();
  if ("error" in gate && gate.error) return gate.error;
  const { admin } = gate;

  const listed = await listAllAuthUsers(admin);
  if ("error" in listed && listed.error) return listed.error;

  const { data: profiles, error: profilesError } = await admin
    .from("crm_profiles")
    .select("id, display_name, avatar_url, role");

  if (profilesError) {
    return jsonError(profilesError.message, 500);
  }

  const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const users: AdminUser[] = listed.users
    .map((user) => {
      const profile = byId.get(user.id);
      return {
        id: user.id,
        email: user.email ?? null,
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        role: isRole(profile?.role) ? profile.role : null,
        created_at: user.created_at,
      };
    })
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const gate = await requireAdmin();
  if ("error" in gate && gate.error) return gate.error;
  const { admin } = gate;

  let body: { email?: unknown; role?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError("Expected a JSON body with email and role.", 400);
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || !email.includes("@")) {
    return jsonError("Enter a valid email address.", 400);
  }
  if (!isRole(body.role)) {
    return jsonError("Role must be admin or member.", 400);
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
  if (error) {
    return jsonError(error.message, 400);
  }

  const invited = data.user;
  if (!invited) {
    return jsonError("Invite did not return a user.", 500);
  }

  if (body.role === "admin") {
    const { data: updated, error: updateError } = await admin
      .from("crm_profiles")
      .update({ role: "admin" })
      .eq("id", invited.id)
      .select("id")
      .maybeSingle();

    if (updateError) {
      return jsonError(updateError.message, 500);
    }
    if (!updated) {
      return jsonError("Invited the user, but their profile was not updated to admin.", 500);
    }
  }

  return NextResponse.json({ id: invited.id, email: invited.email ?? email, role: body.role });
}

export async function DELETE(request: Request) {
  const gate = await requireAdmin();
  if ("error" in gate && gate.error) return gate.error;
  const { user, admin } = gate;

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return jsonError("Missing user id.", 400);
  }
  if (id === user.id) {
    return jsonError("Can't remove your own account here — ask another admin.", 400);
  }

  const last = await isOnlyAdmin(admin, id);
  if ("error" in last && last.error) return last.error;
  if (last.blocked) {
    return jsonError("This person is the only admin. Promote someone else before removing them.", 400);
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    return jsonError(error.message, 400);
  }

  return NextResponse.json({ id });
}

export async function PATCH(request: Request) {
  const gate = await requireAdmin();
  if ("error" in gate && gate.error) return gate.error;
  const { admin } = gate;

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return jsonError("Missing user id.", 400);
  }

  let body: { role?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonError("Expected a JSON body with role.", 400);
  }
  if (!isRole(body.role)) {
    return jsonError("Role must be admin or member.", 400);
  }

  if (body.role !== "admin") {
    const last = await isOnlyAdmin(admin, id);
    if ("error" in last && last.error) return last.error;
    if (last.blocked) {
      return jsonError(
        "This person is the only admin. Promote someone else before changing their role.",
        400,
      );
    }
  }

  const { data, error } = await admin
    .from("crm_profiles")
    .update({ role: body.role })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return jsonError(error.message, 500);
  }
  if (!data) {
    return jsonError("No profile found for that user.", 404);
  }

  return NextResponse.json({ id, role: body.role });
}
