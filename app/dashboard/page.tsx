"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Sidebar } from "@/components/Sidebar";
import { BUSINESSES, HEATS, isOpenStage, localDate, stage } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { Business, Contact, HistoryEntry, Stage, Task } from "@/lib/types";

type BusinessFilter = "all" | Business;

type DashboardData = {
  contacts: Contact[];
  tasks: Task[];
  history: HistoryEntry[];
};

type BarDatum = {
  key: string;
  name: string;
  count: number;
  fill: string;
  gap?: boolean;
};

type MonthDatum = {
  label: string;
  count: number;
};

const FUNNEL_STAGES = ["new", "contacted", "meeting", "proposal", "client"] as const satisfies readonly Stage[];

const GAP_NAME = "\u200b";

const CLOSED_BAR = "#94a3b8";
const BRAND_BLUE = "#254fbb";

const MONTH_LABELS = [
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

const controlClass =
  "mt-1.5 block w-full min-w-52 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-mint/40 focus:border-navy focus:ring-2";

const axisTick = { fill: "#56677f", fontSize: 12 };
const categoryTick = { fill: "#192841", fontSize: 12 };

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Something went wrong. Try again.";
}

function matchesBusiness(contact: Contact, filter: BusinessFilter) {
  return filter === "all" || contact.business === filter;
}

function taskDay(task: Task) {
  const value = task.date?.trim() ?? "";
  return value ? localDate(value) : "";
}

function formatWinRate(clients: number, closed: number) {
  const decided = clients + closed;
  if (decided === 0) return "—";
  return `${Math.round((clients / decided) * 100)}%`;
}

function countDomain([, dataMax]: readonly [number, number]): [number, number] {
  const max = Number.isFinite(dataMax) ? dataMax : 0;
  if (max <= 0) return [0, 1];
  return [0, Math.ceil(max * 1.15)];
}

function recentMonths(contacts: Contact[], now = new Date()): MonthDatum[] {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: MONTH_LABELS[date.getMonth()] ?? "",
      count: 0,
    };
  });
  const indexByKey = new Map(months.map((month, index) => [month.key, index]));

  contacts.forEach((contact) => {
    const created = new Date(contact.created_at);
    if (Number.isNaN(created.getTime())) return;
    const slot = indexByKey.get(`${created.getFullYear()}-${created.getMonth()}`);
    if (slot == null) return;
    months[slot].count += 1;
  });

  return months.map(({ label, count }) => ({ label, count }));
}

function readDatum<T>(payload: unknown): T | null {
  if (!Array.isArray(payload) || payload.length === 0) return null;
  const entry = payload[0];
  if (!entry || typeof entry !== "object") return null;
  const row = "payload" in entry ? entry.payload : entry;
  if (!row || typeof row !== "object") return null;
  return row as T;
}

function BarTooltip({ active, payload }: { active?: boolean; payload?: unknown }) {
  const row = readDatum<BarDatum>(payload);
  if (!active || !row || row.gap) return null;

  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-sm shadow-sm">
      <p className="font-medium text-navy">{row.name}</p>
      <p className="mt-0.5 tabular-nums text-ink">{row.count}</p>
    </div>
  );
}

function MonthTooltip({ active, payload }: { active?: boolean; payload?: unknown }) {
  const row = readDatum<MonthDatum>(payload);
  if (!active || !row) return null;

  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-sm shadow-sm">
      <p className="font-medium text-navy">{row.label}</p>
      <p className="mt-0.5 tabular-nums text-ink">{row.count}</p>
    </div>
  );
}

function StatTile({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-white p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${valueClassName ?? ""}`}>{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-line bg-white p-5">
      <h2 className="text-base font-semibold text-navy">{title}</h2>
      <div className="mt-4 h-72">{children}</div>
    </section>
  );
}

function HorizontalBars({
  data,
  yWidth,
  chartKey,
}: {
  data: BarDatum[];
  yWidth: number;
  chartKey: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        key={chartKey}
        layout="vertical"
        data={data}
        barCategoryGap={16}
        barSize={20}
        maxBarSize={20}
        margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
      >
        <CartesianGrid horizontal={false} stroke="#dce3ed" />
        <XAxis
          type="number"
          allowDecimals={false}
          domain={countDomain}
          tick={axisTick}
          axisLine={{ stroke: "#dce3ed" }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={yWidth}
          interval={0}
          tick={categoryTick}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value: string) => (value === GAP_NAME ? "" : value)}
        />
        <Tooltip content={<BarTooltip />} cursor={{ fill: "#f3f6fa" }} />
        <Bar dataKey="count" barSize={20} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {data.map((entry) => (
            <Cell key={entry.key} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function DashboardPage() {
  const filterId = useId();
  const [businessFilter, setBusinessFilter] = useState<BusinessFilter>("all");
  const [data, setData] = useState<DashboardData>({ contacts: [], tasks: [], history: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const [contactsResult, tasksResult, historyResult] = await Promise.all([
        supabase.from("crm_contacts").select("*"),
        supabase.from("crm_tasks").select("*"),
        supabase.from("crm_history").select("*"),
      ]);

      if (cancelled) return;

      const queryError = contactsResult.error ?? tasksResult.error ?? historyResult.error;
      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      setData({
        contacts: (contactsResult.data ?? []) as Contact[],
        tasks: (tasksResult.data ?? []) as Task[],
        history: (historyResult.data ?? []) as HistoryEntry[],
      });
      setLoading(false);
    }

    load().catch((caught) => {
      if (cancelled) return;
      setError(errorMessage(caught));
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [loadKey]);

  const today = localDate();
  const scopedContacts = data.contacts.filter((contact) => matchesBusiness(contact, businessFilter));
  const scopedIds = new Set(scopedContacts.map((contact) => contact.id));
  const pendingTasks = data.tasks.filter(
    (task) => task.done_at == null && scopedIds.has(task.contact_id),
  );

  const totalContacts = scopedContacts.length;
  const openLeads = scopedContacts.filter((contact) => isOpenStage(contact.stage)).length;
  const clientsWon = scopedContacts.filter((contact) => contact.stage === "client").length;
  const closedLost = scopedContacts.filter((contact) => contact.stage === "closed").length;
  const overdue = pendingTasks.filter((task) => {
    const day = taskDay(task);
    return day !== "" && day < today;
  }).length;
  const dueToday = pendingTasks.filter((task) => taskDay(task) === today).length;

  const funnel: BarDatum[] = [
    ...FUNNEL_STAGES.map((id) => {
      const item = stage(id);
      return {
        key: id,
        name: item.name,
        count: scopedContacts.filter((contact) => contact.stage === id).length,
        fill: item.ink,
      };
    }),
    { key: "gap", name: GAP_NAME, count: 0, fill: "transparent", gap: true },
    {
      key: "closed",
      name: "Closed (lost)",
      count: closedLost,
      fill: CLOSED_BAR,
    },
  ];

  const heats: BarDatum[] = HEATS.map((item) => ({
    key: item.id,
    name: item.name,
    count: scopedContacts.filter((contact) => contact.heat === item.id).length,
    fill: item.ink,
  }));

  const businesses: BarDatum[] = BUSINESSES.map((item) => ({
    key: item.id,
    name: item.name,
    count: data.contacts.filter((contact) => contact.business === item.id).length,
    fill: item.color,
  }));

  const months = recentMonths(scopedContacts);

  return (
    <>
      <Sidebar />
      <div className="min-h-screen pl-[234px]">
        <main className="mx-auto max-w-[1600px] px-10 py-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-blue">Trio CRM</p>
              <h1 className="mt-2 text-3xl font-semibold text-navy">Dashboard</h1>
            </div>
            <div>
              <label htmlFor={filterId} className="text-sm font-medium text-ink">
                Business
              </label>
              <select
                id={filterId}
                value={businessFilter}
                onChange={(event) => setBusinessFilter(event.target.value as BusinessFilter)}
                className={controlClass}
              >
                <option value="all">All businesses</option>
                {BUSINESSES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error ? (
            <section className="mt-8 rounded-2xl border border-line bg-white p-6">
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
              <button
                type="button"
                onClick={() => setLoadKey((value) => value + 1)}
                className="mt-4 rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-page"
              >
                Try again
              </button>
            </section>
          ) : loading ? (
            <p className="mt-8 text-sm text-muted">Loading dashboard…</p>
          ) : (
            <>
              <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                <StatTile label="Total contacts" value={String(totalContacts)} />
                <StatTile label="Open leads" value={String(openLeads)} />
                <StatTile label="Clients won" value={String(clientsWon)} />
                <StatTile label="Win rate" value={formatWinRate(clientsWon, closedLost)} />
                <StatTile
                  label="Overdue follow-ups"
                  value={String(overdue)}
                  valueClassName="text-danger"
                />
                <StatTile
                  label="Due today"
                  value={String(dueToday)}
                  valueClassName="text-[#975414]"
                />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
                <ChartCard title="Sales funnel by stage">
                  <HorizontalBars data={funnel} yWidth={148} chartKey={`funnel-${businessFilter}`} />
                </ChartCard>
                <ChartCard title="Leads by category">
                  <HorizontalBars data={heats} yWidth={112} chartKey={`heats-${businessFilter}`} />
                </ChartCard>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
                <ChartCard title="Contacts by business">
                  <HorizontalBars data={businesses} yWidth={112} chartKey="businesses" />
                </ChartCard>
                <ChartCard title="New contacts per month">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      key={businessFilter}
                      data={months}
                      margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid vertical={false} stroke="#dce3ed" />
                      <XAxis
                        dataKey="label"
                        tick={axisTick}
                        axisLine={{ stroke: "#dce3ed" }}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        width={36}
                        domain={countDomain}
                        tick={axisTick}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<MonthTooltip />} cursor={{ stroke: "#dce3ed" }} />
                      <Line
                        type="linear"
                        dataKey="count"
                        stroke={BRAND_BLUE}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 5, fill: BRAND_BLUE, stroke: "#ffffff", strokeWidth: 2 }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}
