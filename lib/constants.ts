import type { Business, Heat, Stage } from "./types";

export const BUSINESSES = [
  { id: "right-stay", name: "Right Stay", color: "#21746e" },
  { id: "rsl-express", name: "RSL Express", color: "#365bbb" },
  { id: "storey", name: "The Storey", color: "#995833" },
] as const satisfies readonly {
  id: Business;
  name: string;
  color: string;
}[];

export const HEATS = [
  { id: "general", name: "General", bg: "#edf1f7", ink: "#52647c" },
  { id: "cold", name: "Cold leads", bg: "#e8f2ff", ink: "#275fac" },
  { id: "warm", name: "Warm leads", bg: "#fff1d9", ink: "#885712" },
  { id: "hot", name: "Hot leads", bg: "#ffebea", ink: "#ad3b35" },
] as const satisfies readonly {
  id: Heat;
  name: string;
  bg: string;
  ink: string;
}[];

export const STAGES = [
  { id: "new", name: "New lead", bg: "#e8eefc", ink: "#2a4494" },
  { id: "contacted", name: "Contacted", bg: "#e5f4f2", ink: "#1d6b64" },
  { id: "meeting", name: "Meeting arranged", bg: "#f1eaf8", ink: "#643d96" },
  { id: "proposal", name: "Proposal sent", bg: "#ffefe4", ink: "#9a4518" },
  { id: "client", name: "Client", bg: "#e6f5ee", ink: "#267156" },
  { id: "closed", name: "Closed", bg: "#f0f0f2", ink: "#636573" },
] as const satisfies readonly {
  id: Stage;
  name: string;
  bg: string;
  ink: string;
}[];

export const CHANNELS = [
  "Phone call",
  "WhatsApp",
  "Email",
  "Meeting",
  "Other",
] as const;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function business(id: Business) {
  const match = BUSINESSES.find((item) => item.id === id);
  if (!match) throw new Error(`Unknown business: ${id}`);
  return match;
}

export function heat(id: Heat) {
  const match = HEATS.find((item) => item.id === id);
  if (!match) throw new Error(`Unknown heat: ${id}`);
  return match;
}

export function stage(id: Stage) {
  const match = STAGES.find((item) => item.id === id);
  if (!match) throw new Error(`Unknown stage: ${id}`);
  return match;
}

export function isOpenStage(value: Stage) {
  return value !== "client" && value !== "closed";
}

function formatLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localDate(date?: Date | string | null) {
  if (date == null || date === "") return formatLocal(new Date());
  if (date instanceof Date) {
    return Number.isNaN(date.getTime()) ? formatLocal(new Date()) : formatLocal(date);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;

  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? formatLocal(new Date()) : formatLocal(parsed);
}

export function formatDate(value?: string | Date | null) {
  if (value == null || value === "") return "";

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    const monthName = MONTHS[Number(month) - 1];
    if (!monthName || !year || !day) return "";
    return `${Number(day)} ${monthName} ${year}`;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatDate(localDate(date));
}

export function formatTimestamp(value?: string | Date | null) {
  if (value == null || value === "") return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formatDate(date)}, ${hours}:${minutes}`;
}
