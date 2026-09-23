"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { ContactFormDialog } from "@/components/ContactFormDialog";
import {
  business,
  CHANNELS,
  formatDate,
  formatTimestamp,
  heat,
  HEATS,
  localDate,
  stage,
  STAGES,
} from "@/lib/constants";
import {
  addConversation,
  completeFollowup,
  deleteContact,
  linkFollowup,
  rescheduleTask,
  setLeadPosition,
  type ConversationInput,
} from "@/lib/crm";
import { createClient } from "@/lib/supabase/client";
import type { Contact, Heat, HistoryEntry, Stage, Task } from "@/lib/types";

type ContactDetailProps = {
  contactId: string;
};

type Bundle = {
  contact: Contact;
  history: HistoryEntry[];
  tasks: Task[];
};

const controlClass =
  "mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-mint/40 placeholder:text-muted/70 focus:border-navy focus:ring-2";

const primaryButtonClass =
  "rounded-lg bg-navy px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClass =
  "rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-page disabled:cursor-not-allowed disabled:opacity-60";

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Something went wrong. Try again.";
}

function raise(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

async function fetchBundle(supabase: SupabaseClient, contactId: string): Promise<Bundle> {
  const [contactResult, historyResult, taskResult] = await Promise.all([
    supabase.from("crm_contacts").select("*").eq("id", contactId).maybeSingle(),
    supabase.from("crm_history").select("*").eq("contact_id", contactId),
    supabase.from("crm_tasks").select("*").eq("contact_id", contactId),
  ]);

  raise(contactResult.error);
  raise(historyResult.error);
  raise(taskResult.error);

  if (!contactResult.data) {
    const missing = new Error("This contact could not be found.");
    missing.name = "NotFound";
    throw missing;
  }

  return {
    contact: contactResult.data as Contact,
    history: (historyResult.data ?? []) as HistoryEntry[],
    tasks: (taskResult.data ?? []) as Task[],
  };
}

function compareNewest(a: HistoryEntry, b: HistoryEntry) {
  const aDay =
    a.date && /^\d{4}-\d{2}-\d{2}$/.test(a.date) ? a.date : localDate(a.at);
  const bDay =
    b.date && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : localDate(b.at);
  if (aDay !== bDay) return aDay < bDay ? 1 : -1;
  if (a.at === b.at) return 0;
  return a.at < b.at ? 1 : -1;
}

function comparePending(a: Task, b: Task) {
  const aDate = a.date?.trim() ?? "";
  const bDate = b.date?.trim() ?? "";
  if (!aDate && !bDate) return 0;
  if (!aDate) return 1;
  if (!bDate) return -1;
  if (aDate < bDate) return -1;
  if (aDate > bDate) return 1;
  return 0;
}

function entryDateLabel(entry: HistoryEntry) {
  return formatDate(entry.date) || formatDate(entry.at);
}

function taskStatus(task: Task) {
  if (task.done_at) {
    const when = formatTimestamp(task.done_at);
    return when ? `Completed ${when}` : "Completed";
  }
  const when = formatDate(task.date);
  return when ? `Follow-up ${when}` : "Follow-up";
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

function phoneHref(value: string) {
  const digits = value.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
}

function emailHref(value: string) {
  const email = value.trim();
  if (!email || /[\s<>]/.test(email)) return null;
  return `mailto:${email}`;
}

function InfoItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{children}</dd>
    </div>
  );
}

function TextValue({
  value,
  href,
}: {
  value: string | null;
  href?: string | null;
}) {
  const text = value?.trim() ?? "";
  if (!text) return <span className="text-muted">—</span>;
  if (!href) return <span className="break-words">{text}</span>;
  return (
    <a href={href} className="break-words text-blue underline-offset-2 hover:underline">
      {text}
    </a>
  );
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
      {children}
    </label>
  );
}

function NewChatForm({
  isClosed,
  onSave,
}: {
  isClosed: boolean;
  onSave: (input: ConversationInput) => Promise<void>;
}) {
  const formId = useId();
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [date, setDate] = useState("");
  const [channel, setChannel] = useState<string>(CHANNELS[0]);
  const [notes, setNotes] = useState("");
  const [action, setAction] = useState("");
  const [due, setDue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setDate((current) => current || localDate());
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = notes.trim();
    const followUp = action.trim();
    const followUpDate = due.trim();

    if (!text) {
      setError("Add chat notes before saving.");
      notesRef.current?.focus();
      return;
    }
    if (!isClosed && followUpDate && !followUp) {
      setError("Add a follow-up action, or clear the date.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSave({
        text,
        date: date || null,
        channel,
        action: isClosed ? null : followUp,
        due: isClosed ? null : followUpDate,
      });
      setNotes("");
      setAction("");
      setDue("");
      setDate(localDate());
      setChannel(CHANNELS[0]);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="text-base font-semibold text-navy">New chat</h2>
      <form onSubmit={handleSubmit} className="mt-4" noValidate>
        <fieldset disabled={submitting} className="min-w-0 border-0 p-0">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor={`${formId}-date`}>Date</FieldLabel>
              <input
                id={`${formId}-date`}
                name="date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className={controlClass}
              />
            </div>
            <div>
              <FieldLabel htmlFor={`${formId}-channel`}>Channel</FieldLabel>
              <select
                id={`${formId}-channel`}
                name="channel"
                value={channel}
                onChange={(event) => setChannel(event.target.value)}
                className={controlClass}
              >
                {CHANNELS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <FieldLabel htmlFor={`${formId}-notes`}>Chat notes</FieldLabel>
            <textarea
              ref={notesRef}
              id={`${formId}-notes`}
              name="notes"
              rows={4}
              required
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
                setError(null);
              }}
              className={controlClass}
            />
          </div>

          <div className="mt-4 border-t border-line pt-4">
            <h3 className="text-sm font-semibold text-navy">Linked follow-up</h3>
            {isClosed ? (
              <p className="mt-3 rounded-lg bg-page px-3 py-2 text-sm text-muted">
                Follow-ups for closed leads are paused.
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_11.5rem]">
                <div>
                  <FieldLabel htmlFor={`${formId}-action`}>What needs to happen?</FieldLabel>
                  <input
                    id={`${formId}-action`}
                    name="action"
                    type="text"
                    value={action}
                    onChange={(event) => {
                      setAction(event.target.value);
                      setError(null);
                    }}
                    className={controlClass}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor={`${formId}-due`}>When?</FieldLabel>
                  <input
                    id={`${formId}-due`}
                    name="due"
                    type="date"
                    value={due}
                    onChange={(event) => {
                      setDue(event.target.value);
                      setError(null);
                    }}
                    className={controlClass}
                  />
                </div>
              </div>
            )}
          </div>
        </fieldset>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={submitting} className={`mt-4 ${primaryButtonClass}`}>
          {submitting ? "Saving…" : "Add chat"}
        </button>
      </form>
    </section>
  );
}

function LinkFollowupForm({
  onSave,
}: {
  onSave: (text: string, date: string) => Promise<void>;
}) {
  const formId = useId();
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const action = text.trim();
    if (!action) {
      setError("Add a follow-up.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSave(action, date);
      setText("");
      setDate("");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 border-t border-line pt-3">
      <p className="text-sm font-medium text-ink">Add a follow-up</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor={`${formId}-text`} className="sr-only">
          Follow-up
        </label>
        <input
          id={`${formId}-text`}
          name="follow_up"
          type="text"
          value={text}
          placeholder="What needs to happen?"
          onChange={(event) => {
            setText(event.target.value);
            setError(null);
          }}
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-mint/40 placeholder:text-muted/70 focus:border-navy focus:ring-2"
        />
        <label htmlFor={`${formId}-date`} className="sr-only">
          Follow-up date
        </label>
        <input
          id={`${formId}-date`}
          name="follow_up_date"
          type="date"
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
            setError(null);
          }}
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-mint/40 focus:border-navy focus:ring-2 sm:w-40"
        />
        <button type="submit" disabled={submitting} className={secondaryButtonClass}>
          {submitting ? "Saving…" : "Add"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function FollowUpCard({
  task,
  onComplete,
  onReschedule,
  onOpenChat,
}: {
  task: Task;
  onComplete: () => Promise<void>;
  onReschedule: (date: string) => Promise<void>;
  onOpenChat: (logId: string) => void;
}) {
  const formId = useId();
  const [date, setDate] = useState(task.date ?? "");
  const [previousDate, setPreviousDate] = useState(task.date);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);

  if (task.date !== previousDate) {
    setPreviousDate(task.date);
    setDate(task.date ?? "");
  }

  async function handleComplete() {
    setError(null);
    setCompleting(true);
    try {
      await onComplete();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setCompleting(false);
    }
  }

  async function handleReschedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = date.trim();
    const current = task.date?.trim() ?? "";
    if (next === current) return;

    setError(null);
    setRescheduling(true);
    try {
      await onReschedule(next);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setRescheduling(false);
    }
  }

  const busy = completing || rescheduling;
  const logId = task.log_id;
  const overdue = Boolean(task.date && task.date < localDate());

  return (
    <article className="rounded-xl border border-line bg-page px-3 py-3">
      <p className={`text-xs font-semibold ${overdue ? "text-danger" : "text-muted"}`}>
        {dueLabel(task.date)}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{task.text || "Follow-up"}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleComplete}
          disabled={busy}
          className={primaryButtonClass}
        >
          {completing ? "Saving…" : "Done"}
        </button>
        {logId ? (
          <button
            type="button"
            onClick={() => onOpenChat(logId)}
            className={secondaryButtonClass}
          >
            Open linked chat
          </button>
        ) : null}
      </div>
      <form onSubmit={handleReschedule} className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor={`${formId}-date`} className="text-xs font-medium text-muted">
            Date
          </label>
          <input
            id={`${formId}-date`}
            name="date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-mint/40 focus:border-navy focus:ring-2"
          />
        </div>
        <button type="submit" disabled={busy} className={secondaryButtonClass}>
          {rescheduling ? "Saving…" : "Change date"}
        </button>
      </form>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </article>
  );
}

export function ContactDetail({ contactId }: ContactDetailProps) {
  const router = useRouter();
  const contactIdRef = useRef(contactId);
  const reloadSeq = useRef(0);
  contactIdRef.current = contactId;

  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [positionError, setPositionError] = useState<string | null>(null);
  const [savingPosition, setSavingPosition] = useState<"heat" | "stage" | null>(null);
  const [heatDraft, setHeatDraft] = useState<Heat | null>(null);
  const [stageDraft, setStageDraft] = useState<Stage | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [openRequest, setOpenRequest] = useState(0);
  const openedHash = useRef<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);

  const reload = useCallback(async () => {
    const requestedId = contactIdRef.current;
    const seq = ++reloadSeq.current;
    const next = await fetchBundle(createClient(), requestedId);
    if (seq !== reloadSeq.current || requestedId !== contactIdRef.current) return;
    setBundle(next);
    setMissing(false);
    setLoadError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    reloadSeq.current += 1;
    setLoading(true);
    setLoadError(null);
    setMissing(false);
    setEditing(false);
    setHeatDraft(null);
    setStageDraft(null);
    setPositionError(null);
    setDeleteError(null);
    setConfirmingDelete(false);

    fetchBundle(createClient(), contactId)
      .then((next) => {
        if (cancelled) return;
        setBundle(next);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setBundle(null);
        if (error instanceof Error && error.name === "NotFound") {
          setMissing(true);
          return;
        }
        setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [contactId, loadKey]);

  useEffect(() => {
    if (!bundle) return;
    const previous = document.title;
    document.title = `${bundle.contact.name} · Trio CRM`;
    return () => {
      document.title = previous;
    };
  }, [bundle]);

  useEffect(() => {
    if (!bundle) return;
    const hash = window.location.hash;
    if (!hash.startsWith("#history-") || openedHash.current === hash) return;
    const id = decodeURIComponent(hash.slice("#history-".length));
    if (!id) return;
    openedHash.current = hash;
    setHighlightId(id);
    setOpenRequest((current) => current + 1);
  }, [bundle]);

  useEffect(() => {
    if (!highlightId) return;
    const entry = document.getElementById(`history-${highlightId}`);
    if (entry instanceof HTMLDetailsElement) {
      entry.open = true;
      entry.scrollIntoView({ behavior: "smooth", block: "center" });
      const summary = entry.querySelector("summary");
      if (summary instanceof HTMLElement) summary.focus();
    }
    const timer = window.setTimeout(() => setHighlightId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [highlightId, openRequest]);

  function openLinkedChat(logId: string) {
    setHighlightId(logId);
    setOpenRequest((current) => current + 1);
  }

  async function saveHeat(next: Heat) {
    const current = bundle?.contact;
    if (!current || next === current.heat || savingPosition) return;
    setHeatDraft(next);
    setPositionError(null);
    setSavingPosition("heat");
    try {
      await setLeadPosition(
        createClient(),
        current.id,
        "heat",
        next,
        current.heat,
        heat(current.heat).name,
        heat(next).name,
      );
      await reload();
    } catch (error) {
      setPositionError(errorMessage(error));
    } finally {
      setHeatDraft(null);
      setSavingPosition(null);
    }
  }

  async function saveStage(next: Stage) {
    const current = bundle?.contact;
    if (!current || next === current.stage || savingPosition) return;
    setStageDraft(next);
    setPositionError(null);
    setSavingPosition("stage");
    try {
      await setLeadPosition(
        createClient(),
        current.id,
        "stage",
        next,
        current.stage,
        stage(current.stage).name,
        stage(next).name,
      );
      await reload();
    } catch (error) {
      setPositionError(errorMessage(error));
    } finally {
      setStageDraft(null);
      setSavingPosition(null);
    }
  }

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    if (confirmingDelete) {
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (dialog.open) dialog.close();
  }, [confirmingDelete]);

  async function handleDelete() {
    const current = bundle?.contact;
    if (!current || deleting) return;

    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteContact(createClient(), current.id);
      router.push("/");
    } catch (error) {
      setDeleteError(errorMessage(error));
      setDeleting(false);
    }
  }

  if (!bundle || bundle.contact.id !== contactId) {
    if (!loading && missing) {
      return (
        <section className="rounded-2xl border border-line bg-white p-6">
          <h1 className="text-xl font-semibold text-navy">Contact</h1>
          <p role="alert" className="mt-3 text-sm text-muted">
            This contact could not be found.
          </p>
        </section>
      );
    }
    if (!loading && loadError) {
      return (
        <section className="rounded-2xl border border-line bg-white p-6">
          <h1 className="text-xl font-semibold text-navy">Contact</h1>
          <p role="alert" className="mt-3 text-sm text-danger">
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => setLoadKey((value) => value + 1)}
            className={`mt-4 ${secondaryButtonClass}`}
          >
            Try again
          </button>
        </section>
      );
    }
    return <p className="text-sm text-muted">Loading contact…</p>;
  }

  const { contact, history, tasks } = bundle;
  const brand = business(contact.business);
  const chats = history
    .filter((entry) => entry.type === "chat" || entry.type === "note")
    .sort(compareNewest);
  const activity = history
    .filter((entry) => entry.type === "activity" || entry.type === "followup")
    .sort(compareNewest);
  const pending = tasks.filter((task) => !task.done_at).sort(comparePending);
  const tasksByLog = new Map<string, Task[]>();
  tasks.forEach((task) => {
    if (!task.log_id) return;
    const linked = tasksByLog.get(task.log_id) ?? [];
    linked.push(task);
    tasksByLog.set(task.log_id, linked);
  });

  const heatValue = heatDraft ?? contact.heat;
  const stageValue = stageDraft ?? contact.stage;
  const heatStyle = heat(heatValue);
  const stageStyle = stage(stageValue);
  const isClosed = contact.stage === "closed";
  const added = formatTimestamp(contact.created_at);

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.8fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-2xl border border-line bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <span
              className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: brand.color }}
            >
              {brand.name}
            </span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className={secondaryButtonClass}
            >
              Edit contact
            </button>
          </div>

          <h1 className="mt-4 text-2xl font-semibold text-navy">{contact.name}</h1>

          <dl className="mt-5 space-y-4">
            <InfoItem label="Company/property">
              <TextValue value={contact.company} />
            </InfoItem>
            <InfoItem label="Phone">
              <TextValue value={contact.phone} href={contact.phone ? phoneHref(contact.phone) : null} />
            </InfoItem>
            <InfoItem label="Email">
              <TextValue value={contact.email} href={contact.email ? emailHref(contact.email) : null} />
            </InfoItem>
            <InfoItem label="Property address">
              <TextValue value={contact.location} />
            </InfoItem>
            <InfoItem label="Backup name">
              <TextValue value={contact.backup_name} />
            </InfoItem>
            <InfoItem label="Role">
              <TextValue value={contact.backup_role} />
            </InfoItem>
            <InfoItem label="Backup phone">
              <TextValue
                value={contact.backup_phone}
                href={contact.backup_phone ? phoneHref(contact.backup_phone) : null}
              />
            </InfoItem>
            <InfoItem label="Backup email">
              <TextValue
                value={contact.backup_email}
                href={contact.backup_email ? emailHref(contact.backup_email) : null}
              />
            </InfoItem>
          </dl>

          {added ? <p className="mt-5 text-sm text-muted">Added {added}</p> : null}

          <div className="mt-6 border-t border-line pt-5">
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setConfirmingDelete(true);
              }}
              disabled={deleting}
              className="rounded-lg border border-danger/30 px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete contact
            </button>
          </div>
        </section>

        <div className="min-w-0 space-y-6">
          <NewChatForm
            key={contact.id}
            isClosed={isClosed}
            onSave={async (input) => {
              await addConversation(createClient(), contact.id, isClosed, input);
              await reload();
            }}
          />

          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-base font-semibold text-navy">Chat history ({chats.length})</h2>
            {chats.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No chats or notes yet.</p>
            ) : (
              <div className="mt-3 divide-y divide-line border-y border-line">
                {chats.map((entry) => {
                  const linked = (tasksByLog.get(entry.id) ?? [])
                    .slice()
                    .sort(comparePending);
                  const summaryLabel =
                    entry.type === "note" ? "Note" : entry.channel?.trim() || "Chat";
                  return (
                    <details
                      key={entry.id}
                      id={`history-${entry.id}`}
                      className={`scroll-mt-6 py-1 ${
                        highlightId === entry.id ? "rounded-lg ring-2 ring-mint" : ""
                      }`}
                    >
                      <summary className="cursor-pointer px-1 py-2 text-sm font-medium text-ink">
                        <span>{entryDateLabel(entry) || "No date"}</span>
                        <span className="text-muted"> · {summaryLabel}</span>
                      </summary>
                      <div className="px-1 pb-3">
                        <p className="whitespace-pre-wrap text-sm text-ink">{entry.text}</p>
                        {linked.length > 0 ? (
                          <ul className="mt-3 space-y-1 text-sm text-muted">
                            {linked.map((task) => (
                              <li key={task.id}>
                                <span className="font-medium text-ink">{taskStatus(task)}</span>
                                {task.text.trim() ? ` — ${task.text}` : null}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {entry.type === "chat" ? (
                          <LinkFollowupForm
                            onSave={async (text, date) => {
                              await linkFollowup(
                                createClient(),
                                contact.id,
                                entry.id,
                                text,
                                date || null,
                                isClosed,
                              );
                              await reload();
                            }}
                          />
                        ) : null}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}

            <details className="mt-5 rounded-xl border border-line bg-page px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-navy">
                Other activity ({activity.length})
              </summary>
              {activity.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Nothing else recorded.</p>
              ) : (
                <ol className="mt-3 space-y-3 border-l border-line pl-4">
                  {activity.map((entry) => (
                    <li key={entry.id}>
                      <p className="text-xs text-muted">
                        {formatTimestamp(entry.at) || formatDate(entry.date)}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">{entry.text}</p>
                    </li>
                  ))}
                </ol>
              )}
            </details>
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-base font-semibold text-navy">Lead position</h2>
            <div className="mt-4 space-y-4">
              <div>
                <FieldLabel htmlFor="lead-category">Lead category</FieldLabel>
                <select
                  id="lead-category"
                  value={heatValue}
                  disabled={savingPosition !== null}
                  onChange={(event) => {
                    void saveHeat(event.target.value as Heat);
                  }}
                  style={{ backgroundColor: heatStyle.bg, color: heatStyle.ink }}
                  className={controlClass}
                >
                  {HEATS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel htmlFor="sales-stage">Sales stage</FieldLabel>
                <select
                  id="sales-stage"
                  value={stageValue}
                  disabled={savingPosition !== null}
                  onChange={(event) => {
                    void saveStage(event.target.value as Stage);
                  }}
                  style={{ backgroundColor: stageStyle.bg, color: stageStyle.ink }}
                  className={controlClass}
                >
                  {STAGES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {savingPosition ? (
              <p className="mt-3 text-sm text-muted">Saving…</p>
            ) : null}
            {positionError ? (
              <p role="alert" className="mt-3 text-sm text-danger">
                {positionError}
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-base font-semibold text-navy">Follow-ups ({pending.length})</h2>
            {pending.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No open follow-ups.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {pending.map((task) => (
                  <FollowUpCard
                    key={task.id}
                    task={task}
                    onOpenChat={openLinkedChat}
                    onComplete={async () => {
                      await completeFollowup(
                        createClient(),
                        contact.id,
                        task.id,
                        task.text,
                        task.date,
                      );
                      await reload();
                    }}
                    onReschedule={async (date) => {
                      await rescheduleTask(
                        createClient(),
                        contact.id,
                        task.id,
                        task.date,
                        date || null,
                      );
                      await reload();
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <ContactFormDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSaved={() => {
          void reload();
        }}
        editingContact={contact}
        defaultBusiness={contact.business}
      />

      <dialog
        ref={deleteDialogRef}
        aria-labelledby="delete-contact-title"
        onCancel={(event) => {
          event.preventDefault();
          if (!deleting) setConfirmingDelete(false);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget && !deleting) setConfirmingDelete(false);
        }}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-white p-6 text-ink shadow-xl backdrop:bg-navy/40"
      >
        <h2 id="delete-contact-title" className="text-lg font-semibold text-navy">
          Delete {contact.name}?
        </h2>
        <p className="mt-3 text-sm text-ink">
          This removes the contact, their notes and follow-ups. This cannot be undone.
        </p>
        {deleteError ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {deleteError}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setDeleteError(null);
              setConfirmingDelete(false);
            }}
            disabled={deleting}
            className={secondaryButtonClass}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void handleDelete();
            }}
            disabled={deleting}
            className="rounded-lg bg-danger px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete contact"}
          </button>
        </div>
      </dialog>
    </>
  );
}
