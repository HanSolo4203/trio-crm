"use client";

import { useEffect, useId, useState } from "react";

import {
  StatusDot,
  statusPillClass,
  tagPillStyle,
  useBusinessSettings,
  useTagColors,
} from "@/components/BusinessSettingsProvider";
import { createClient } from "@/lib/supabase/client";

const NEUTRAL_GRAY = "#e8edf4";

function normalizeColor(value: string | null | undefined) {
  const color = value?.trim() ?? "";
  return /^#[0-9a-f]{6}$/i.test(color) ? color : NEUTRAL_GRAY;
}

function distinctTags(rows: { tags: string[] | null }[] | null) {
  const tags = new Set<string>();
  for (const row of rows ?? []) {
    for (const tag of row.tags ?? []) {
      const value = tag.trim();
      if (value) tags.add(value);
    }
  }
  return [...tags].sort((a, b) => a.localeCompare(b));
}

function TagRow({ tag }: { tag: string }) {
  const colorId = useId();
  const tagColors = useTagColors();
  const { refresh } = useBusinessSettings();
  const [color, setColor] = useState(() => normalizeColor(tagColors[tag]));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    const supabase = createClient();
    const { error: upsertError } = await supabase.from("crm_tag_colors").upsert(
      { tag, color, updated_at: new Date().toISOString() },
      { onConflict: "tag" },
    );

    if (upsertError) {
      setError(upsertError.message);
      setSaving(false);
      return;
    }

    await refresh();
    setSaving(false);
    setSaved(true);
  }

  return (
    <li className="flex flex-col gap-3 border-b border-line py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <label htmlFor={colorId} className="sr-only">
          Color for {tag}
        </label>
        <input
          id={colorId}
          name={`color-${tag}`}
          type="color"
          value={color}
          onChange={(event) => {
            setColor(event.target.value);
            setSaved(false);
          }}
          className="h-10 w-16 shrink-0 cursor-pointer rounded-lg border border-line bg-white p-1"
        />
        <span className={`${statusPillClass} max-w-full truncate`} style={tagPillStyle(color)}>
          <StatusDot color={tagPillStyle(color).color} />
          {tag}
        </span>
      </div>
      <div className="flex items-center gap-3 sm:shrink-0">
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p role="status" className="text-sm text-muted">
            Saved.
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="btn btn-primary inline-flex items-center justify-center rounded-full bg-navy px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </li>
  );
}

export function SettingsTags() {
  const { loading: colorsLoading } = useBusinessSettings();
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createClient();
      const { data, error: queryError } = await supabase.from("crm_contacts").select("tags");

      if (cancelled) return;
      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      setTags(distinctTags(data));
      setLoading(false);
      setSeeded(true);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mt-6 rounded-2xl border border-line/60 bg-white shadow-card p-6">
      <h2 className="text-lg font-semibold text-navy">Tags</h2>
      {loading || colorsLoading ? <p className="mt-4 text-sm text-muted">Loading tags…</p> : null}
      {error ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {!loading && !colorsLoading && !error && tags.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No tags yet — add one from a contact first</p>
      ) : null}
      {seeded && !colorsLoading && tags.length > 0 ? (
        <ul className="mt-2">
          {tags.map((tag) => (
            <TagRow key={tag} tag={tag} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
