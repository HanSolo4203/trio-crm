"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useId, useRef, useState } from "react";

import { BusinessSelectOptions, useBusinessDisplay, useReportBusinessScope } from "@/components/BusinessSettingsProvider";
import { formatDate, formatTimestamp, localDate } from "@/lib/constants";
import { completeFollowup } from "@/lib/crm";
import { queryKeys } from "@/lib/queryKeys";
import { fetchContacts, fetchHistory, fetchTasks, invalidateCrm } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import type { Business, Contact, HistoryEntry, Profile, Task } from "@/lib/types";
import { useProfile } from "@/lib/useProfile";
import { profileName, useProfilesMap } from "@/lib/useProfilesMap";

type BusinessFilter = "all" | Business;

type FollowupRow = {
  task: Task;
  contact: Contact;
  chat: HistoryEntry | null;
};

const controlClass =
  "input mt-1.5 block w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-mint/40 focus:border-navy focus:ring-2 md:min-w-52";

const primaryButtonClass =
  "btn btn-primary inline-flex items-center justify-center rounded-full bg-navy px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClass =
  "btn-compact inline-flex items-center justify-center rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-page";

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

function ClientSubline({ contact }: { contact: Contact }) {
  const { name } = useBusinessDisplay(contact.business);
  const company = contact.company?.trim() ?? "";
  return company ? `${name} · ${company}` : name;
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
      className="block min-h-11 min-w-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
    >
      <p className="font-semibold text-navy">{contact.name}</p>
      <p className="mt-0.5 text-sm text-muted">
        <ClientSubline contact={contact} />
      </p>
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

function FollowupCard({
  row,
  mode,
  completingId,
  assigneeName,
  onComplete,
}: {
  row: FollowupRow;
  mode: "pending" | "completed";
  completingId: string | null;
  assigneeName: string | null;
  onComplete?: (row: FollowupRow) => void;
}) {
  const status = followupStatus(row.task.date);
  const overdue = mode === "pending" && status === "Overdue";
  const completedAt = formatTimestamp(row.task.done_at);
  const chat = row.chat;
  const chatDate = chat ? chatDateLabel(chat) : "";
  const action = row.task.text.trim() || "Follow-up";

  return (
    <article className="rounded-2xl border border-line/60 bg-white p-4 shadow-card">
      <p className={`text-sm font-semibold ${overdue ? "text-danger" : "text-ink"}`}>
        {dueLabel(row.task.date)}
      </p>
      <Link
        href={`/contacts/${row.contact.id}`}
        className="mt-2 block min-h-11 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
      >
        <span className="font-semibold text-navy">{row.contact.name}</span>
        <span className="mt-0.5 block text-sm text-muted">
          <ClientSubline contact={row.contact} />
        </span>
      </Link>
      {assigneeName ? <p className="mt-0.5 text-sm text-muted">{assigneeName}</p> : null}
      <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{action}</p>
      {chat ? (
        <Link
          href={`/contacts/${row.contact.id}#history-${chat.id}`}
          className={`${secondaryButtonClass} mt-3 w-full`}
        >
          {chatDate ? `Open chat · ${chatDate}` : "Open chat"}
        </Link>
      ) : (
        <p className="mt-2 text-xs text-muted">Contact follow-up</p>
      )}
      <p className={`mt-3 text-sm font-semibold ${overdue ? "text-danger" : "text-ink"}`}>
        {mode === "pending" ? status : completedAt || "Completed"}
      </p>
      {mode === "pending" ? (
        <button
          type="button"
          onClick={() => onComplete?.(row)}
          disabled={completingId !== null}
          className={`${primaryButtonClass} mt-3 w-full`}
        >
          {completingId === row.task.id ? "Saving…" : "Done"}
        </button>
      ) : (
        <Link href={`/contacts/${row.contact.id}`} className={`${secondaryButtonClass} mt-3 w-full`}>
          View
        </Link>
      )}
    </article>
  );
}

function assigneeLabel(row: FollowupRow, profilesMap: Map<string, Profile>) {
  return profileName(row.task.assigned_to ? profilesMap.get(row.task.assigned_to) : undefined);
}

function FollowupTable({
  rows,
  mode,
  completingId,
  profilesMap,
  showAssignee,
  onComplete,
}: {
  rows: FollowupRow[];
  mode: "pending" | "completed";
  completingId: string | null;
  profilesMap: Map<string, Profile>;
  showAssignee: boolean;
  onComplete?: (row: FollowupRow) => void;
}) {
  return (
    <>
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <li key={row.task.id}>
            <FollowupCard
              row={row}
              mode={mode}
              completingId={completingId}
              assigneeName={showAssignee ? assigneeLabel(row, profilesMap) : null}
              onComplete={onComplete}
            />
          </li>
        ))}
      </ul>
      <div className="hidden min-w-0 max-w-full overflow-x-auto md:block">
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
            {showAssignee ? (
              <th scope="col" className="px-4 py-3 font-medium">
                Assignee
              </th>
            ) : null}
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
                {showAssignee ? (
                  <td className="px-4 py-4 text-sm text-muted">
                    {assigneeLabel(row, profilesMap)}
                  </td>
                ) : null}
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
    </>
  );
}

export function Followups() {
  const filterId = useId();
  const assigneeFilterId = useId();
  const queryClient = useQueryClient();
  const { profile, loading: profileLoading } = useProfile();
  const { profiles, profilesMap } = useProfilesMap();
  const [businessFilter, setBusinessFilter] = useState<BusinessFilter>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const myId = profile?.id ?? null;
  const assigneeValue = assigneeFilter ?? myId ?? "all";
  const showAssignee = assigneeValue === "all" || (myId != null && assigneeValue !== myId);
  useReportBusinessScope(businessFilter);
  const [actionError, setActionError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const completingRef = useRef(false);
  const tasksQuery = useQuery({ queryKey: queryKeys.tasks, queryFn: fetchTasks });
  const contactsQuery = useQuery({ queryKey: queryKeys.contacts, queryFn: fetchContacts });
  const historyQuery = useQuery({ queryKey: queryKeys.history, queryFn: fetchHistory });

  const tasks = tasksQuery.data ?? [];
  const contacts = contactsQuery.data ?? [];
  const history = historyQuery.data ?? [];
  const loaded = Boolean(tasksQuery.data && contactsQuery.data && historyQuery.data);
  const loadErrorSource = tasksQuery.error ?? contactsQuery.error ?? historyQuery.error;
  const loadError = loadErrorSource ? errorMessage(loadErrorSource) : null;
  const waitingForAssignee = assigneeFilter == null && profileLoading;
  const loading =
    !loadError &&
    (waitingForAssignee ||
      (!loaded && (tasksQuery.isPending || contactsQuery.isPending || historyQuery.isPending)));

  function retry() {
    void tasksQuery.refetch();
    void contactsQuery.refetch();
    void historyQuery.refetch();
  }

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
      await invalidateCrm(queryClient);
    } catch (caught) {
      setActionError(errorMessage(caught));
    } finally {
      completingRef.current = false;
      setCompletingId(null);
    }
  }

  const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));
  const historyById = new Map(history.map((entry) => [entry.id, entry]));

  const rows = tasks.flatMap((task) => {
    const contact = contactsById.get(task.contact_id);
    if (!contact) return [];
    if (businessFilter !== "all" && contact.business !== businessFilter) return [];
    if (assigneeValue !== "all" && task.assigned_to !== assigneeValue) return [];
    const linked = task.log_id ? historyById.get(task.log_id) ?? null : null;
    return [{ task, contact, chat: linked }];
  });

  const pending = rows.filter((row) => !row.task.done_at).sort(comparePending);
  const completed = rows.filter((row) => row.task.done_at).sort(compareCompleted);

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-blue">Trio CRM</p>
          <h1 className="mt-2 text-3xl font-semibold text-navy">Follow-ups</h1>
        </div>
        <div className="flex w-full flex-col gap-4 sm:flex-row md:w-auto">
          <div className="min-w-0">
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
          <div className="min-w-0">
            <label htmlFor={assigneeFilterId} className="text-sm font-medium text-ink">
              Assignee
            </label>
            <select
              id={assigneeFilterId}
              value={assigneeValue}
              onChange={(event) => setAssigneeFilter(event.target.value)}
              className={controlClass}
            >
              {myId ? <option value={myId}>Assigned to me</option> : null}
              <option value="all">All</option>
              {[...profiles]
                .sort((a, b) => profileName(a).localeCompare(profileName(b)))
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {profileName(member)}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {loadError && !loaded ? (
        <section className="mt-8 rounded-2xl border border-line/60 bg-white shadow-card p-6">
          <p role="alert" className="text-sm text-danger">
            {loadError}
          </p>
          <button
            type="button"
            onClick={retry}
            className="btn mt-4 inline-flex items-center justify-center rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-page"
          >
            Try again
          </button>
        </section>
      ) : loading ? (
        <p className="mt-8 text-sm text-muted">Loading follow-ups…</p>
      ) : (
        <>
          {loadError ? (
            <section className="mt-8 rounded-2xl border border-line/60 bg-white shadow-card p-6">
              <p role="alert" className="text-sm text-danger">
                {loadError}
              </p>
              <button
                type="button"
                onClick={retry}
                className="btn mt-4 inline-flex items-center justify-center rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-page"
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
            <section className="mt-8 rounded-2xl border border-line/60 bg-white shadow-card px-6 py-16 text-center">
              <p className="text-sm text-muted">No pending follow-ups</p>
              <Link href="/" className={`mt-4 inline-flex ${primaryButtonClass}`}>
                View contacts
              </Link>
            </section>
          ) : (
            <section className="mt-8 md:overflow-hidden md:rounded-2xl md:border md:border-line/60 md:bg-white md:shadow-card">
              <FollowupTable
                rows={pending}
                mode="pending"
                completingId={completingId}
                profilesMap={profilesMap}
                showAssignee={showAssignee}
                onComplete={(row) => {
                  void handleComplete(row);
                }}
              />
            </section>
          )}

          <details className="mt-8 rounded-2xl border border-line/60 bg-white shadow-card">
            <summary className="min-h-11 cursor-pointer px-4 py-4 text-sm font-semibold text-navy">
              Completed follow-up log ({completed.length})
            </summary>
            {completed.length === 0 ? (
              <p className="border-t border-line px-4 py-4 text-sm text-muted">
                No completed follow-ups.
              </p>
            ) : (
              <div className="border-t border-line p-3 md:p-0">
                <FollowupTable
                  rows={completed}
                  mode="completed"
                  completingId={null}
                  profilesMap={profilesMap}
                  showAssignee={showAssignee}
                />
              </div>
            )}
          </details>
        </>
      )}
    </>
  );
}
