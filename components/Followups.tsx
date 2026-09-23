"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { BUSINESSES, business, formatDate, formatTimestamp, localDate } from "@/lib/constants";
import { completeFollowup } from "@/lib/crm";
import { createClient } from "@/lib/supabase/client";
import type { Business, Contact, HistoryEntry, Task } from "@/lib/types";

type BusinessFilter = "all" | Business;

type FollowupRow = {
  task: Task;
  contact: Contact;
  chat: HistoryEntry | null;
};

const controlClass =
  "mt-1.5 block w-full min-w-52 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-mint/40 focus:border-navy focus:ring-2";

const primaryButtonClass =
  "rounded-lg bg-navy px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClass =
  "inline-flex rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-page";

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Something went wrong. Try again.";
}

function dueLabel(date: string | null) {
  const value = date?.trim() ?? "";
  if (!value) return "No date";
  const today = localDate();
  const formatted = formatDate(value);
  if (value < today) return formatted ? `Overdue · ${formatted}` : "Overdue";
  if (value === today) return "Due today";
  return formatted ? `Due ${formatted}` : "Due";
}

function followupStatus(date: string | null) {
  const value = date?.trim() ?? "";
  if (!value) return "Needs a date";
  const today = localDate();
  if (value < today) return "Overdue";
  if (value === today) return "Today";
  return "Upcoming";
}

function chatDateLabel(entry: HistoryEntry) {
  return formatDate(entry.date) || formatDate(entry.at);
}

function clientSubline(contact: Contact) {
  const company = contact.company?.trim() ?? "";
  return company ? `${business(contact.business).name} · ${company}` : business(contact.business).name;
}

function comparePending(a: FollowupRow, b: FollowupRow) {
  const aDate = a.task.date?.trim() ?? "";
  const bDate = b.task.date?.trim() ?? "";
  if (aDate !== bDate) {
    if (!aDate) return 1;
    if (!bDate) return -1;
    return aDate < bDate ? -1 : 1;
  }
  return a.contact.name.localeCompare(b.contact.name);
}

function compareCompleted(a: FollowupRow, b: FollowupRow) {
  const aAt = a.task.done_at ?? "";
  const bAt = b.task.done_at ?? "";
  if (aAt !== bAt) return aAt < bAt ? 1 : -1;
  return a.contact.name.localeCompare(b.contact.name);
}

function ClientCell({ contact }: { contact: Contact }) {
  return (
    <Link
      href={`/contacts/${contact.id}`}
      className="block min-w-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
    >
      <p className="font-semibold text-navy">{contact.name}</p>
      <p className="mt-0.5 text-sm text-muted">{clientSubline(contact)}</p>
    </Link>
  );
}

function ActionCell({ row }: { row: FollowupRow }) {
  const text = row.task.text.trim() || "Follow-up";
  const chat = row.chat;
  const chatDate = chat ? chatDateLabel(chat) : "";

  return (
    <div className="min-w-0">
      <p className="whitespace-pre-wrap text-ink">{text}</p>
      {chat ? (
        <Link
          href={`/contacts/${row.contact.id}#history-${chat.id}`}
          className={`mt-2 ${secondaryButtonClass}`}
        >
          {chatDate ? `Open chat · ${chatDate}` : "Open chat"}
        </Link>
      ) : (
        <p className="mt-1 text-xs text-muted">Contact follow-up</p>
      )}
    </div>
  );
}

function FollowupTable({
  rows,
  mode,
  completingId,
  onComplete,
}: {
  rows: FollowupRow[];
  mode: "pending" | "completed";
  completingId: string | null;
  onComplete?: (row: FollowupRow) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <caption className="sr-only">
          {mode === "pending" ? "Pending follow-ups" : "Completed follow-ups"}
        </caption>
        <thead className="border-b border-line text-xs font-medium uppercase tracking-wide text-muted">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">
              Follow-up date
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Client
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Action
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {mode === "pending" ? "Status" : "Completed at"}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              <span className="sr-only">{mode === "pending" ? "Complete" : "View"}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => {
            const status = followupStatus(row.task.date);
            const overdue = mode === "pending" && status === "Overdue";
            const completedAt = formatTimestamp(row.task.done_at);

            return (
              <tr key={row.task.id} className="align-top">
                <td className={`px-4 py-4 font-semibold ${overdue ? "text-danger" : "text-ink"}`}>
                  {dueLabel(row.task.date)}
                </td>
                <td className="px-4 py-4">
                  <ClientCell contact={row.contact} />
                </td>
                <td className="px-4 py-4">
                  <ActionCell row={row} />
                </td>
                <td className="px-4 py-4">
                  {mode === "pending" ? (
                    <span className={`font-semibold ${overdue ? "text-danger" : "text-ink"}`}>
                      {status}
                    </span>
                  ) : (
                    <span className="text-ink">{completedAt || "Completed"}</span>
                  )}
                </td>
                <td className="px-4 py-4 text-right">
                  {mode === "pending" ? (
                    <button
                      type="button"
                      onClick={() => onComplete?.(row)}
                      disabled={completingId !== null}
                      className={primaryButtonClass}
                    >
                      {completingId === row.task.id ? "Saving…" : "Done"}
                    </button>
                  ) : (
                    <Link href={`/contacts/${row.contact.id}`} className={secondaryButtonClass}>
                      View
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Followups() {
  const filterId = useId();
  const [businessFilter, setBusinessFilter] = useState<BusinessFilter>("all");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const hasLoaded = useRef(false);
  const completingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!hasLoaded.current) setLoading(true);
      setLoadError(null);

      const supabase = createClient();
      const [tasksResult, contactsResult, historyResult] = await Promise.all([
        supabase.from("crm_tasks").select("*"),
        supabase.from("crm_contacts").select("*"),
        supabase.from("crm_history").select("*"),
      ]);

      if (cancelled) return;

      const queryError = tasksResult.error ?? contactsResult.error ?? historyResult.error;
      if (queryError) {
        setLoadError(queryError.message);
        setLoading(false);
        completingRef.current = false;
        setCompletingId(null);
        return;
      }

      setTasks((tasksResult.data ?? []) as Task[]);
      setContacts((contactsResult.data ?? []) as Contact[]);
      setHistory((historyResult.data ?? []) as HistoryEntry[]);
      hasLoaded.current = true;
      setLoaded(true);
      setLoading(false);
      completingRef.current = false;
      setCompletingId(null);
    }

    load().catch((caught) => {
      if (cancelled) return;
      setLoadError(errorMessage(caught));
      setLoading(false);
      completingRef.current = false;
      setCompletingId(null);
    });

    return () => {
      cancelled = true;
    };
  }, [loadKey]);

  async function handleComplete(row: FollowupRow) {
    if (completingRef.current) return;
    completingRef.current = true;
    setActionError(null);
    setCompletingId(row.task.id);
    try {
      await completeFollowup(
        createClient(),
        row.contact.id,
        row.task.id,
        row.task.text,
        row.task.date,
      );
      setLoadKey((value) => value + 1);
    } catch (caught) {
      completingRef.current = false;
      setActionError(errorMessage(caught));
      setCompletingId(null);
    }
  }

  const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));
  const historyById = new Map(history.map((entry) => [entry.id, entry]));

  const rows = tasks.flatMap((task) => {
    const contact = contactsById.get(task.contact_id);
    if (!contact) return [];
    if (businessFilter !== "all" && contact.business !== businessFilter) return [];
    const linked = task.log_id ? historyById.get(task.log_id) ?? null : null;
    return [{ task, contact, chat: linked }];
  });

  const pending = rows.filter((row) => !row.task.done_at).sort(comparePending);
  const completed = rows.filter((row) => row.task.done_at).sort(compareCompleted);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-blue">Trio CRM</p>
          <h1 className="mt-2 text-3xl font-semibold text-navy">Follow-ups</h1>
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

      {loadError && !loaded ? (
        <section className="mt-8 rounded-2xl border border-line bg-white p-6">
          <p role="alert" className="text-sm text-danger">
            {loadError}
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
        <p className="mt-8 text-sm text-muted">Loading follow-ups…</p>
      ) : (
        <>
          {loadError ? (
            <section className="mt-8 rounded-2xl border border-line bg-white p-6">
              <p role="alert" className="text-sm text-danger">
                {loadError}
              </p>
              <button
                type="button"
                onClick={() => setLoadKey((value) => value + 1)}
                className="mt-4 rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-page"
              >
                Try again
              </button>
            </section>
          ) : null}

          {actionError ? (
            <p role="alert" className="mt-8 text-sm text-danger">
              {actionError}
            </p>
          ) : null}

          {pending.length === 0 ? (
            <section className="mt-8 rounded-2xl border border-line bg-white px-6 py-16 text-center">
              <p className="text-sm text-muted">No pending follow-ups</p>
              <Link href="/" className={`mt-4 inline-flex ${primaryButtonClass}`}>
                View contacts
              </Link>
            </section>
          ) : (
            <section className="mt-8 overflow-hidden rounded-2xl border border-line bg-white">
              <FollowupTable
                rows={pending}
                mode="pending"
                completingId={completingId}
                onComplete={(row) => {
                  void handleComplete(row);
                }}
              />
            </section>
          )}

          <details className="mt-8 rounded-2xl border border-line bg-white">
            <summary className="cursor-pointer px-4 py-4 text-sm font-semibold text-navy">
              Completed follow-up log ({completed.length})
            </summary>
            {completed.length === 0 ? (
              <p className="border-t border-line px-4 py-4 text-sm text-muted">
                No completed follow-ups.
              </p>
            ) : (
              <div className="border-t border-line">
                <FollowupTable rows={completed} mode="completed" completingId={null} />
              </div>
            )}
          </details>
        </>
      )}
    </>
  );
}
