"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { BUSINESSES, business } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { Business } from "@/lib/types";

export type BusinessSettingsRow = {
  id: Business;
  display_name: string | null;
  color: string | null;
  logo_url: string | null;
};

export type BusinessDisplay = {
  name: string;
  color: string;
  logoUrl: string | null;
};

export type TagColorMap = Record<string, string>;

type ContextValue = {
  rows: BusinessSettingsRow[];
  tagColors: TagColorMap;
  loading: boolean;
  refresh: () => Promise<void>;
};

const NEUTRAL_TAG = { backgroundColor: "#e8edf4", color: "#56677f" };

export const statusPillClass =
  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold";

export function StatusDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="size-1.5 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

function inkOn(hex: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return NEUTRAL_TAG.color;
  const value = Number.parseInt(match[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.62 ? "#192841" : "#ffffff";
}

export function tagPillStyle(color: string | null | undefined) {
  const value = color?.trim() ?? "";
  if (!/^#[0-9a-f]{6}$/i.test(value)) return NEUTRAL_TAG;
  return { backgroundColor: value, color: inkOn(value) };
}

const BusinessSettingsContext = createContext<ContextValue | null>(null);

type BusinessScope = Business | "all";

const BusinessScopeContext = createContext<BusinessScope>("all");
const SetBusinessScopeContext = createContext<(scope: BusinessScope) => void>(() => {});

function filled(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function tagColorMap(rows: { tag: string; color: string }[] | null) {
  const map: TagColorMap = {};
  for (const row of rows ?? []) {
    const tag = row.tag?.trim();
    const color = row.color?.trim();
    if (tag && color) map[tag] = color;
  }
  return map;
}

function BusinessScopeProvider({ children }: { children: ReactNode }) {
  const [scope, setScope] = useState<BusinessScope>("all");
  return (
    <SetBusinessScopeContext.Provider value={setScope}>
      <BusinessScopeContext.Provider value={scope}>{children}</BusinessScopeContext.Provider>
    </SetBusinessScopeContext.Provider>
  );
}

export function useReportBusinessScope(scope: Business | "all" | null | undefined) {
  const setScope = useContext(SetBusinessScopeContext);
  const reported: BusinessScope = scope && scope !== "all" ? scope : "all";
  useEffect(() => {
    setScope(reported);
    return () => setScope("all");
  }, [reported, setScope]);
}

export function BusinessSettingsProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<BusinessSettingsRow[]>([]);
  const [tagColors, setTagColors] = useState<TagColorMap>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [businesses, colors] = await Promise.all([
      supabase.from("crm_business_settings").select("id, display_name, color, logo_url"),
      supabase.from("crm_tag_colors").select("tag, color"),
    ]);

    if (!businesses.error) {
      setRows((businesses.data ?? []) as BusinessSettingsRow[]);
    }
    if (!colors.error) {
      setTagColors(tagColorMap(colors.data));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <BusinessSettingsContext.Provider value={{ rows, tagColors, loading, refresh }}>
      <BusinessScopeProvider>{children}</BusinessScopeProvider>
    </BusinessSettingsContext.Provider>
  );
}

function BusinessLogo({ id, featured }: { id: Business; featured: boolean }) {
  const { name, color, logoUrl } = useBusinessDisplay(id);
  const frame = featured ? "h-12 w-12" : "h-10 w-10";
  return (
    <div className="flex items-center gap-2">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className={`${frame} shrink-0 rounded-xl border border-line/60 bg-white object-contain p-1`}
        />
      ) : (
        <span
          aria-hidden="true"
          className={`${frame} shrink-0 rounded-xl`}
          style={{ backgroundColor: color }}
        />
      )}
      <span className={featured ? "text-sm font-semibold text-navy" : "text-sm font-medium text-ink"}>
        {name}
      </span>
    </div>
  );
}

export function BusinessLogos() {
  const scope = useContext(BusinessScopeContext);
  const ids = scope === "all" ? BUSINESSES.map((item) => item.id) : [scope];
  const featured = ids.length === 1;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-3" aria-label="Businesses">
      {ids.map((id) => (
        <BusinessLogo key={id} id={id} featured={featured} />
      ))}
    </div>
  );
}

export function useBusinessSettings() {
  const context = useContext(BusinessSettingsContext);
  if (!context) {
    throw new Error("useBusinessSettings must be used within BusinessSettingsProvider");
  }
  return context;
}

export function useTagColors() {
  const context = useContext(BusinessSettingsContext);
  if (!context) {
    throw new Error("useTagColors must be used within BusinessSettingsProvider");
  }
  return context.tagColors;
}

export function StatusPill({
  label,
  bg,
  ink,
  className = "",
}: {
  label: string;
  bg: string;
  ink: string;
  className?: string;
}) {
  return (
    <span
      className={className ? `${statusPillClass} ${className}` : statusPillClass}
      style={{ backgroundColor: bg, color: ink }}
    >
      <StatusDot color={ink} />
      {label}
    </span>
  );
}

export function TagPill({
  tag,
  className = statusPillClass,
}: {
  tag: string;
  className?: string;
}) {
  const tagColors = useTagColors();
  const style = tagPillStyle(tagColors[tag]);
  return (
    <span className={className} style={style}>
      <StatusDot color={style.color} />
      {tag}
    </span>
  );
}

export function useBusinessDisplay(id: Business): BusinessDisplay {
  const context = useContext(BusinessSettingsContext);
  const fallback = business(id);
  const row = context?.rows.find((item) => item.id === id);
  return {
    name: filled(row?.display_name) ?? fallback.name,
    color: filled(row?.color) ?? fallback.color,
    logoUrl: filled(row?.logo_url),
  };
}

export function BusinessSelectOptions() {
  return BUSINESSES.map((item) => <BusinessSelectOption key={item.id} id={item.id} />);
}

function BusinessSelectOption({ id }: { id: Business }) {
  const { name } = useBusinessDisplay(id);
  return <option value={id}>{name}</option>;
}

export function BusinessMark({
  id,
  className = "h-2.5 w-2.5",
}: {
  id: Business;
  className?: string;
}) {
  const { color, logoUrl } = useBusinessDisplay(id);
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt="" className={`${className} shrink-0 rounded-full object-cover`} />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${className} shrink-0 rounded-full`}
      style={{ backgroundColor: color }}
    />
  );
}

export function BusinessPill({ id }: { id: Business }) {
  const { name, color } = useBusinessDisplay(id);
  return (
    <span className={`${statusPillClass} text-white`} style={{ backgroundColor: color }}>
      <StatusDot color="#ffffff" />
      {name}
    </span>
  );
}
