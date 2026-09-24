"use client";

import { useEffect, useId, useState, type FormEvent } from "react";

import { createClient } from "@/lib/supabase/client";

const controlClass =
  "input mt-1.5 block w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-mint/40 focus:border-navy focus:ring-2";

type DigestSettings = {
  digest_enabled: boolean;
  digest_recipient_email: string | null;
  digest_send_hour_local: number;
};

// Africa/Blantyre is UTC+2. digest_send_hour_local stores the local hour N (0–23).
// The label is that same local hour ("6:00 AM" stores 6). Local hour N is
// (UTC hour + 2) % 24 — that is how a UTC clock becomes the label, not a second
// offset applied to N. The digest route does the reverse: UTC = (N − 2 + 24) % 24.
const LOCAL_HOURS = Array.from({ length: 24 }, (_, localHour) => localHour);

function formatLocalHour(localHour: number) {
  const hour12 = localHour % 12 === 0 ? 12 : localHour % 12;
  const period = localHour < 12 ? "AM" : "PM";
  return `${hour12}:00 ${period}`;
}

export function SettingsDigest() {
  const enabledId = useId();
  const emailId = useId();
  const hourId = useId();
  const [enabled, setEnabled] = useState(false);
  const [email, setEmail] = useState("");
  const [hour, setHour] = useState(6);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from("crm_app_settings")
        .select("digest_enabled, digest_recipient_email, digest_send_hour_local")
        .eq("id", true)
        .maybeSingle();

      if (cancelled) return;
      if (queryError || !data) {
        setError(queryError?.message ?? "Digest settings are missing.");
        setLoading(false);
        return;
      }

      const row = data as DigestSettings;
      setEnabled(row.digest_enabled);
      setEmail(row.digest_recipient_email ?? "");
      setHour(row.digest_send_hour_local);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const recipient = email.trim();
    if (recipient && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      setError("Enter a valid recipient email, or leave it blank.");
      setSaved(false);
      return;
    }
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      setError("Choose a send hour.");
      setSaved(false);
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("crm_app_settings")
      .update({
        digest_enabled: enabled,
        digest_recipient_email: recipient || null,
        digest_send_hour_local: hour,
      })
      .eq("id", true);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setSaved(true);
  }

  return (
    <section className="mt-6 rounded-2xl border border-line/60 bg-white shadow-card p-6">
      <h2 className="text-lg font-semibold text-navy">Email digest</h2>
      <p className="mt-2 max-w-xl text-sm text-muted">
        One email a day listing overdue and due-today follow-ups. Times are Africa/Blantyre (UTC+2).
      </p>

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading digest settings…</p>
      ) : (
        <form onSubmit={handleSave} className="mt-6 max-w-md">
          <div className="flex items-center gap-3">
            <input
              id={enabledId}
              name="digest_enabled"
              type="checkbox"
              checked={enabled}
              onChange={(event) => {
                setEnabled(event.target.checked);
                setSaved(false);
              }}
              className="h-4 w-4 rounded border-line text-navy accent-navy"
            />
            <label htmlFor={enabledId} className="text-sm font-medium text-ink">
              Send the daily digest
            </label>
          </div>

          <div className="mt-4">
            <label htmlFor={emailId} className="text-sm font-medium text-ink">
              Recipient email
            </label>
            <input
              id={emailId}
              name="digest_recipient_email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setSaved(false);
              }}
              autoComplete="email"
              className={controlClass}
            />
          </div>

          <div className="mt-4">
            <label htmlFor={hourId} className="text-sm font-medium text-ink">
              Send time
            </label>
            <select
              id={hourId}
              name="digest_send_hour_local"
              value={hour}
              onChange={(event) => {
                setHour(Number(event.target.value));
                setSaved(false);
              }}
              className={controlClass}
            >
              {LOCAL_HOURS.map((localHour) => (
                <option key={localHour} value={localHour}>
                  {formatLocalHour(localHour)}
                </option>
              ))}
            </select>
          </div>

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
            disabled={saving}
            className="btn btn-primary mt-4 inline-flex items-center justify-center rounded-full bg-navy px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      )}
    </section>
  );
}
