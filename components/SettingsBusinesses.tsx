"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import {
  useBusinessSettings,
  type BusinessSettingsRow,
} from "@/components/BusinessSettingsProvider";
import { BUSINESSES, business } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { Business } from "@/lib/types";

const controlClass =
  "input mt-1.5 block w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-mint/40 focus:border-navy focus:ring-2";

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Something went wrong. Try again.";
}

function filled(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function BusinessCard({ id, row }: { id: Business; row: BusinessSettingsRow | undefined }) {
  const nameId = useId();
  const colorId = useId();
  const fileId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const { refresh } = useBusinessSettings();
  const fallback = business(id);
  const [displayName, setDisplayName] = useState(row?.display_name ?? "");
  const [color, setColor] = useState(filled(row?.color) ?? fallback.color);
  const [logoUrl, setLogoUrl] = useState<string | null>(filled(row?.logo_url));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = displayName.trim();
    if (nextName.length > 80) {
      setError("Display name must be 80 characters or fewer.");
      setSaved(false);
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("crm_business_settings")
      .update({
        display_name: nextName || null,
        color,
      })
      .eq("id", id);

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
      const safeName = file.name.replace(/[/\\]/g, "-");
      const path = `${id}/${safeName}`;
      const { error: uploadError } = await supabase.storage.from("logos").upload(path, file, {
        contentType: file.type,
        upsert: true,
      });

      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const { data: publicUrl } = supabase.storage.from("logos").getPublicUrl(path);
      const { error: updateError } = await supabase
        .from("crm_business_settings")
        .update({ logo_url: publicUrl.publicUrl })
        .eq("id", id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setLogoUrl(publicUrl.publicUrl);
      await refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <form onSubmit={handleSave} className="rounded-2xl border border-line/60 bg-white shadow-card p-6">
      <h2 className="text-lg font-semibold text-navy">{fallback.name}</h2>
      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="h-16 w-16 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
        )}
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
            disabled={uploading}
            className="btn inline-flex items-center justify-center rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-page disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? "Uploading…" : "Upload logo"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid max-w-md gap-4">
        <div>
          <label htmlFor={colorId} className="text-sm font-medium text-ink">
            Color
          </label>
          <input
            id={colorId}
            name="color"
            type="color"
            value={color}
            onChange={(event) => {
              setColor(event.target.value);
              setSaved(false);
            }}
            className="mt-1.5 h-10 w-16 cursor-pointer rounded-lg border border-line bg-white p-1"
          />
        </div>
        <div>
          <label htmlFor={nameId} className="text-sm font-medium text-ink">
            Display name
          </label>
          <input
            id={nameId}
            name="display_name"
            type="text"
            maxLength={80}
            value={displayName}
            placeholder={fallback.name}
            onChange={(event) => {
              setDisplayName(event.target.value);
              setSaved(false);
            }}
            className={controlClass}
          />
        </div>
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
  );
}

function BusinessCardGate({ id }: { id: Business }) {
  const { rows, loading } = useBusinessSettings();
  const row = rows.find((item) => item.id === id);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!loading) setSeeded(true);
  }, [loading]);

  if (!seeded) return null;
  return <BusinessCard id={id} row={row} />;
}

export function SettingsBusinesses() {
  const { loading } = useBusinessSettings();

  return (
    <div className="mt-6 flex flex-col gap-4">
      {loading ? <p className="text-sm text-muted">Loading businesses…</p> : null}
      {BUSINESSES.map((item) => (
        <BusinessCardGate key={item.id} id={item.id} />
      ))}
    </div>
  );
}
