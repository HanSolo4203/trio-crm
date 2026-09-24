import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

type DigestTask = {
  text: string;
  date: string;
  contactId: string;
  contactName: string;
};

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

function tokensMatch(provided: string, secret: string) {
  const providedBytes = Buffer.from(provided);
  const secretBytes = Buffer.from(secret);
  if (providedBytes.length !== secretBytes.length) return false;
  return timingSafeEqual(providedBytes, secretBytes);
}

function requestToken(request: Request) {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  return new URL(request.url).searchParams.get("token")?.trim() ?? "";
}

function todayInBlantyre() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Blantyre",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function daysBetween(earlier: string, later: string) {
  const [yearA, monthA, dayA] = earlier.split("-").map(Number);
  const [yearB, monthB, dayB] = later.split("-").map(Number);
  const start = Date.UTC(yearA, monthA - 1, dayA);
  const end = Date.UTC(yearB, monthB - 1, dayB);
  return Math.round((end - start) / 86_400_000);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function appOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  if (!host) return new URL(request.url).origin;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function compareTasks(a: DigestTask, b: DigestTask) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.contactName.localeCompare(b.contactName);
}

function taskLine(task: DigestTask, origin: string, today: string) {
  const href = `${origin}/contacts/${task.contactId}`;
  const name = escapeHtml(task.contactName.trim() || "Unnamed contact");
  const text = escapeHtml(task.text.trim() || "Follow-up");
  const when =
    task.date === today
      ? "due today"
      : `overdue by ${daysBetween(task.date, today)} ${daysBetween(task.date, today) === 1 ? "day" : "days"}`;
  return `<li><a href="${escapeHtml(href)}">${name}</a> — ${text} — ${when}</li>`;
}

function digestHtml(overdue: DigestTask[], dueToday: DigestTask[], origin: string, today: string) {
  const sections = [
    overdue.length
      ? `<h2>Overdue</h2><ul>${overdue.map((task) => taskLine(task, origin, today)).join("")}</ul>`
      : "",
    dueToday.length
      ? `<h2>Due today</h2><ul>${dueToday.map((task) => taskLine(task, origin, today)).join("")}</ul>`
      : "",
  ];
  return `<div>${sections.filter(Boolean).join("")}</div>`;
}

export async function GET(request: Request) {
  const secret = process.env.DIGEST_SECRET ?? "";
  const token = requestToken(request);
  if (!secret || !token || !tokensMatch(token, secret)) {
    return unauthorized();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const digestTo = process.env.DIGEST_EMAIL_TO;
  if (!supabaseUrl || !serviceRoleKey || !resendKey || !digestTo) {
    return new Response("Digest is not configured.", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const today = todayInBlantyre();
  const { data, error } = await supabase
    .from("crm_tasks")
    .select("text, date, contact_id, crm_contacts(id, name)")
    .is("done_at", null)
    .lte("date", today)
    .order("date", { ascending: true });

  if (error) {
    return new Response(`Could not load follow-ups: ${error.message}`, { status: 500 });
  }

  const tasks: DigestTask[] = [];
  for (const row of data ?? []) {
    const contact = Array.isArray(row.crm_contacts) ? row.crm_contacts[0] : row.crm_contacts;
    const date = typeof row.date === "string" ? row.date : "";
    if (!date || !contact?.id) continue;
    tasks.push({
      text: row.text ?? "",
      date,
      contactId: contact.id,
      contactName: contact.name ?? "",
    });
  }

  const overdue = tasks.filter((task) => task.date < today).sort(compareTasks);
  const dueToday = tasks.filter((task) => task.date === today).sort(compareTasks);
  if (overdue.length === 0 && dueToday.length === 0) {
    return new Response("Nothing due — no email sent.", { status: 200 });
  }

  const count = overdue.length + dueToday.length;
  const subject =
    count === 1 ? "1 follow-up needs attention" : `${count} follow-ups need attention`;
  const from = process.env.DIGEST_EMAIL_FROM || "Trio CRM <onboarding@resend.dev>";
  const resend = new Resend(resendKey);
  const { error: sendError } = await resend.emails.send({
    from,
    to: digestTo,
    subject,
    html: digestHtml(overdue, dueToday, appOrigin(request), today),
  });

  if (sendError) {
    return new Response(`Email failed: ${sendError.message}`, { status: 500 });
  }

  return new Response(
    `Sent "${subject}" to ${digestTo}: ${overdue.length} overdue, ${dueToday.length} due today.`,
    { status: 200 },
  );
}
