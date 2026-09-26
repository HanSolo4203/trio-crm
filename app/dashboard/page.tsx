"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useId, useState, useSyncExternalStore, type ReactNode } from "react";
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

import { AppShell } from "@/components/AppShell";
import { BusinessSelectOptions, useBusinessDisplay, useReportBusinessScope } from "@/components/BusinessSettingsProvider";
import { BUSINESSES, formatRand, HEATS, isOpenStage, localDate, stage } from "@/lib/constants";
import { queryKeys } from "@/lib/queryKeys";
import { fetchContacts, fetchHistory, fetchTasks } from "@/lib/queries";
import type { Business, Contact, Stage, Task } from "@/lib/types";
import { useProfile } from "@/lib/useProfile";

type BusinessFilter = "all" | Business;

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
  "input mt-1.5 block w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-mint/40 focus:border-navy focus:ring-2 md:min-w-52";

function subscribePhone(onChange: () => void) {
  const media = window.matchMedia("(max-width: 767px)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function phoneSnapshot() {
  return window.matchMedia("(max-width: 767px)").matches;
}

function usePhone() {
  return useSyncExternalStore(subscribePhone, phoneSnapshot, () => false);
}

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
  href,
}: {
  label: ReactNode;
  value: string;
  valueClassName?: string;
  href?: string;
}) {
  const className = "min-w-0 rounded-2xl border border-line/60 bg-white px-4 py-3 shadow-card";
  const body = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums leading-none ${valueClassName ?? ""}`}>
        {value}
      </p>
    </>
  );
  if (!href) return <div className={className}>{body}</div>;
  return (
    <Link
      href={href}
      className={`${className} transition-colors hover:border-navy/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy`}
    >
      {body}
    </Link>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-line/60 bg-white p-4 shadow-card md:p-5">
      <h2 className="text-base font-semibold text-navy">{title}</h2>
      <div className="mt-4 h-[220px] md:h-72">{children}</div>
    </section>
  );
}

function HorizontalBars({
  data,
  yWidth,
  mobileYWidth,
  chartKey,
}: {
  data: BarDatum[];
  yWidth: number;
  mobileYWidth: number;
  chartKey: string;
}) {
  const phone = usePhone();
  const tickSize = phone ? 10 : 12;
  const axisTick = { fill: "#56677f", fontSize: tickSize };
  const categoryTick = { fill: "#192841", fontSize: tickSize };
  const axisWidth = phone ? mobileYWidth : yWidth;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        key={chartKey}
        layout="vertical"
        data={data}
        barCategoryGap={16}
        barSize={20}
        maxBarSize={20}
        margin={{ top: 4, right: phone ? 8 : 16, left: 0, bottom: 0 }}
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
          width={axisWidth}
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

function commissionAmount(amount: number | null) {
  const value = Number(amount);
  return Number.isFinite(value) ? value : 0;
}

function CommissionBadge({ status }: { status: "pending" | "paid" }) {
  const paid = status === "paid";
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
      style={
        paid
          ? { backgroundColor: "#e6f5ee", color: "#267156" }
          : { backgroundColor: "#fff1d9", color: "#885712" }
      }
    >
      {paid ? "Paid" : "Pending"}
    </span>
  );
}

function ReferralCommissions({ contacts }: { contacts: Contact[] }) {
  const rows = [...contacts].sort((a, b) => a.name.localeCompare(b.name));
  const pending = rows
    .filter((contact) => contact.commission_status === "pending")
    .reduce((sum, contact) => sum + commissionAmount(contact.commission_amount), 0);
  const paid = rows
    .filter((contact) => contact.commission_status === "paid")
    .reduce((sum, contact) => sum + commissionAmount(contact.commission_amount), 0);

  return (
    <section className="mt-4 min-w-0 rounded-2xl border border-line/60 bg-white p-4 shadow-card md:p-5">
      <h2 className="text-base font-semibold text-navy">Referral commissions</h2>
      <div className="mt-4 min-w-0 max-w-full overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <caption className="sr-only">Referral commissions</caption>
          <thead className="border-b border-line text-xs font-medium uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Contact name
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Referral source
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Status
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((contact) => (
              <tr key={contact.id}>
                <td className="px-4 py-4 font-semibold text-navy">
                  <Link href={`/contacts/${contact.id}`} className="hover:underline">
                    {contact.name}
                  </Link>
                </td>
                <td className="px-4 py-4 text-ink">
                  {contact.referral_source?.trim() || "—"}
                </td>
                <td className="px-4 py-4">
                  {contact.commission_status === "paid" || contact.commission_status === "pending" ? (
                    <CommissionBadge status={contact.commission_status} />
                  ) : null}
                </td>
                <td className="px-4 py-4 text-right tabular-nums text-ink">
                  {formatRand(contact.commission_amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink">
        <span>
          Pending: <span className="font-semibold tabular-nums">{formatRand(pending)}</span>
        </span>
        <span>
          Paid: <span className="font-semibold tabular-nums">{formatRand(paid)}</span>
        </span>
      </p>
    </section>
  );
}

function Dashboard() {
  const filterId = useId();
  const phone = usePhone();
  const { profile, loading: profileLoading } = useProfile();
  const axisTick = { fill: "#56677f", fontSize: phone ? 10 : 12 };
  const [businessFilter, setBusinessFilter] = useState<BusinessFilter>("all");
  useReportBusinessScope(businessFilter);
  const contactsQuery = useQuery({ queryKey: queryKeys.contacts, queryFn: fetchContacts });
  const tasksQuery = useQuery({ queryKey: queryKeys.tasks, queryFn: fetchTasks });
  const historyQuery = useQuery({ queryKey: queryKeys.history, queryFn: fetchHistory });
  const contacts = contactsQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const loaded = Boolean(contactsQuery.data && tasksQuery.data && historyQuery.data);
  const errorSource = contactsQuery.error ?? tasksQuery.error ?? historyQuery.error;
  const error = errorSource ? errorMessage(errorSource) : null;
  const loading =
    !loaded && !error && (contactsQuery.isPending || tasksQuery.isPending || historyQuery.isPending);
  const rightStay = useBusinessDisplay("right-stay");
  const rslExpress = useBusinessDisplay("rsl-express");
  const storey = useBusinessDisplay("storey");
  const businessDisplay = {
    "right-stay": rightStay,
    "rsl-express": rslExpress,
    storey,
  };

  const today = localDate();
  const scopedContacts = contacts.filter((contact) => matchesBusiness(contact, businessFilter));
  const scopedIds = new Set(scopedContacts.map((contact) => contact.id));
  const pendingTasks = tasks.filter(
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
  const myFollowUps = profile
    ? pendingTasks.filter((task) => {
        if (task.assigned_to !== profile.id) return false;
        const day = taskDay(task);
        return day !== "" && day <= today;
      }).length
    : null;

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
    name: businessDisplay[item.id].name,
    count: contacts.filter((contact) => contact.business === item.id).length,
    fill: businessDisplay[item.id].color,
  }));

  const months = recentMonths(scopedContacts);

  return (
    <>
          <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium text-blue">Trio CRM</p>
              <h1 className="mt-2 text-3xl font-semibold text-navy">Dashboard</h1>
            </div>
            <div className="w-full md:w-auto">
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
                <BusinessSelectOptions />
              </select>
            </div>
          </div>

          {error ? (
            <section className="mt-8 rounded-2xl border border-line/60 bg-white p-6 shadow-card">
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
              <button
                type="button"
                onClick={() => {
                  void contactsQuery.refetch();
                  void tasksQuery.refetch();
                  void historyQuery.refetch();
                }}
                className="btn mt-4 inline-flex items-center justify-center rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-page"
              >
                Try again
              </button>
            </section>
          ) : loading ? (
            <p className="mt-8 text-sm text-muted">Loading dashboard…</p>
          ) : (
            <>
              <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
                <StatTile label="Total contacts" value={String(totalContacts)} />
                <StatTile label="Open leads" value={String(openLeads)} />
                <StatTile label="Clients won" value={String(clientsWon)} />
                <StatTile label="Win rate" value={formatWinRate(clientsWon, closedLost)} />
                <StatTile
                  label={
                    <>
                      Overdue <span className="whitespace-nowrap">follow-ups</span>
                    </>
                  }
                  value={String(overdue)}
                  valueClassName="text-danger"
                />
                <StatTile
                  label="Due today"
                  value={String(dueToday)}
                  valueClassName="text-[#975414]"
                />
                <StatTile
                  label={
                    <>
                      My <span className="whitespace-nowrap">follow-ups</span>
                    </>
                  }
                  value={profileLoading || myFollowUps == null ? "—" : String(myFollowUps)}
                  valueClassName={myFollowUps ? "text-navy" : undefined}
                  href="/followups"
                />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
                <ChartCard title="Sales funnel by stage">
                  <HorizontalBars
                    data={funnel}
                    yWidth={148}
                    mobileYWidth={124}
                    chartKey={`funnel-${businessFilter}`}
                  />
                </ChartCard>
                <ChartCard title="Leads by category">
                  <HorizontalBars
                    data={heats}
                    yWidth={112}
                    mobileYWidth={92}
                    chartKey={`heats-${businessFilter}`}
                  />
                </ChartCard>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 min-[900px]:grid-cols-2">
                <ChartCard title="Contacts by business">
                  <HorizontalBars
                    data={businesses}
                    yWidth={112}
                    mobileYWidth={96}
                    chartKey="businesses"
                  />
                </ChartCard>
                <ChartCard title="New contacts per month">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      key={businessFilter}
                      data={months}
                      margin={{ top: 8, right: phone ? 8 : 16, left: 0, bottom: 0 }}
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

              {scopedContacts.some((contact) => (contact.referral_source?.trim() ?? "") !== "") ? (
                <ReferralCommissions
                  contacts={scopedContacts.filter(
                    (contact) =>
                      contact.commission_status === "pending" ||
                      contact.commission_status === "paid",
                  )}
                />
              ) : null}
            </>
          )}
    </>
  );
}

export default function DashboardPage() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}
