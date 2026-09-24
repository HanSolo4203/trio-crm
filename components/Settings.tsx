"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { SettingsBusinesses } from "@/components/SettingsBusinesses";
import { SettingsDigest } from "@/components/SettingsDigest";
import { SettingsTags } from "@/components/SettingsTags";
import { SettingsUsers } from "@/components/SettingsUsers";
import { UserAvatar } from "@/components/UserAvatar";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/useProfile";

const TABS = [
  { id: "profile", label: "My profile", admin: false },
  { id: "users", label: "Users", admin: true },
  { id: "businesses", label: "Businesses", admin: true },
  { id: "tags", label: "Tags", admin: true },
  { id: "digest", label: "Email digest", admin: true },
] as const;

type TabId = (typeof TABS)[number]["id"];

const ADMIN_TABS = new Set<TabId>(TABS.filter((tab) => tab.admin).map((tab) => tab.id));

const controlClass =
  "input mt-1.5 block w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-mint/40 focus:border-navy focus:ring-2";

function isTabId(value: string | null): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

function tabFromParam(value: string | null): TabId {
  return isTabId(value) ? value : "profile";
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Something went wrong. Try again.";
}

function ProfileTab() {
  const nameId = useId();
  const fileId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const { profile, refresh } = useProfile();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [email, setEmail] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
  }, [profile?.display_name]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setEmail(data.user?.email ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    const next = displayName.trim();
    if (next.length > 160) {
      setError("Display name must be 160 characters or fewer.");
      setSaved(false);
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("crm_profiles")
      .update({ display_name: next || null })
      .eq("id", profile.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    await refresh();
    setSaving(false);
    setSaved(true);
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      setSaved(false);
      return;
    }

    setUploading(true);
    setError(null);
    setSaved(false);

    try {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const user = userData.user;
      if (userError || !user) {
        setError("Sign in again to upload a photo.");
        return;
      }

      const safeName = file.name.replace(/[/\\]/g, "-");
      const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });

      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: updateError } = await supabase
        .from("crm_profiles")
        .update({ avatar_url: publicUrl.publicUrl })
        .eq("id", user.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      await refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-line/60 bg-white shadow-card p-6">
      <h2 className="text-lg font-semibold text-navy">My profile</h2>
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <UserAvatar
          displayName={profile?.display_name}
          email={email}
          avatarUrl={profile?.avatar_url}
          alt="Profile photo"
          className="h-20 w-20 bg-navy text-lg text-mint"
        />
        <div>
          <input
            ref={fileRef}
            id={fileId}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || !profile}
            className="btn inline-flex items-center justify-center rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-page disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? "Uploading…" : "Upload photo"}
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="mt-6 max-w-md">
        <label htmlFor={nameId} className="text-sm font-medium text-ink">
          Display name
        </label>
        <input
          id={nameId}
          name="display_name"
          type="text"
          maxLength={160}
          value={displayName}
          onChange={(event) => {
            setDisplayName(event.target.value);
            setSaved(false);
          }}
          className={controlClass}
          autoComplete="name"
        />
        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p role="status" className="mt-3 text-sm text-muted">
            Saved.
          </p>
        ) : null}
        <button
          type="submit"
          disabled={saving || !profile}
          className="btn btn-primary mt-4 inline-flex items-center justify-center rounded-full bg-navy px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </section>
  );
}

export function Settings() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, loading } = useProfile();
  const requested = tabFromParam(searchParams.get("tab"));
  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (loading) return;
    if (ADMIN_TABS.has(requested) && !isAdmin) {
      router.replace("/settings", { scroll: false });
    }
  }, [loading, requested, isAdmin, router]);

  const visibleTabs = TABS.filter((tab) => !tab.admin || isAdmin);
  const active: TabId =
    loading || (ADMIN_TABS.has(requested) && !isAdmin) ? "profile" : requested;

  function selectTab(id: TabId) {
    const href = id === "profile" ? "/settings" : `/settings?tab=${id}`;
    router.replace(href, { scroll: false });
  }

  return (
    <>
      <p className="text-sm font-medium text-blue">Trio CRM</p>
      <h1 className="mt-2 text-3xl font-semibold text-navy">Settings</h1>

      <div className="-mx-4 mt-6 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div role="tablist" aria-label="Settings" className="flex min-w-max gap-1 border-b border-line">
          {visibleTabs.map((tab) => {
            const selected = active === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`settings-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`settings-panel-${tab.id}`}
                onClick={() => selectTab(tab.id)}
                className={`btn-compact border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  selected
                    ? "border-navy text-navy"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-muted">Loading settings…</p>
      ) : !profile ? (
        <p role="alert" className="mt-8 text-sm text-danger">
          Could not load your profile.
        </p>
      ) : active === "profile" ? (
        <div role="tabpanel" id="settings-panel-profile" aria-labelledby="settings-tab-profile">
          <ProfileTab />
        </div>
      ) : active === "users" ? (
        <div role="tabpanel" id="settings-panel-users" aria-labelledby="settings-tab-users">
          <SettingsUsers />
        </div>
      ) : active === "businesses" ? (
        <div role="tabpanel" id="settings-panel-businesses" aria-labelledby="settings-tab-businesses">
          <SettingsBusinesses />
        </div>
      ) : active === "tags" ? (
        <div role="tabpanel" id="settings-panel-tags" aria-labelledby="settings-tab-tags">
          <SettingsTags />
        </div>
      ) : active === "digest" ? (
        <div role="tabpanel" id="settings-panel-digest" aria-labelledby="settings-tab-digest">
          <SettingsDigest />
        </div>
      ) : (
        <section
          role="tabpanel"
          id={`settings-panel-${active}`}
          aria-labelledby={`settings-tab-${active}`}
          className="mt-6 rounded-2xl border border-line/60 bg-white shadow-card p-6"
        >
          <h2 className="text-lg font-semibold text-navy">
            {TABS.find((tab) => tab.id === active)?.label}
          </h2>
        </section>
      )}
    </>
  );
}
