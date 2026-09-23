"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import { BUSINESSES, HEATS, STAGES } from "@/lib/constants";
import { createContact, updateContact, type ContactExtras } from "@/lib/crm";
import { createClient } from "@/lib/supabase/client";
import type { Business, Contact, Heat, Stage } from "@/lib/types";

type ContactFormDialogProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (contactId: string) => void;
  editingContact: Contact | null;
  defaultBusiness: Business;
};

type FormState = {
  name: string;
  company: string;
  business: Business;
  heat: Heat;
  stage: Stage;
  phone: string;
  email: string;
  location: string;
  backup_name: string;
  backup_role: string;
  backup_phone: string;
  backup_email: string;
  followUpText: string;
  followUpDate: string;
  note: string;
};

const controlClass =
  "mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-mint/40 placeholder:text-muted/70 focus:border-navy focus:ring-2";

function emptyForm(business: Business): FormState {
  return {
    name: "",
    company: "",
    business,
    heat: "general",
    stage: "new",
    phone: "",
    email: "",
    location: "",
    backup_name: "",
    backup_role: "",
    backup_phone: "",
    backup_email: "",
    followUpText: "",
    followUpDate: "",
    note: "",
  };
}

function formFromContact(contact: Contact): FormState {
  return {
    name: contact.name,
    company: contact.company ?? "",
    business: contact.business,
    heat: contact.heat,
    stage: contact.stage,
    phone: contact.phone ?? "",
    email: contact.email ?? "",
    location: contact.location ?? "",
    backup_name: contact.backup_name ?? "",
    backup_role: contact.backup_role ?? "",
    backup_phone: contact.backup_phone ?? "",
    backup_email: contact.backup_email ?? "",
    // A save can attach a new follow-up and note. Existing ones stay as they are.
    followUpText: "",
    followUpDate: "",
    note: "",
  };
}

function Field({
  id,
  label,
  required,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required ? (
          <span className="text-danger" aria-hidden="true">
            {" *"}
          </span>
        ) : null}
      </label>
      {children}
    </div>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold text-navy">{children}</h3>;
}

export function ContactFormDialog({
  open,
  onClose,
  onSaved,
  editingContact,
  defaultBusiness,
}: ContactFormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const followUpDateRef = useRef<HTMLInputElement>(null);
  const saveAttempt = useRef(0);
  const formId = useId();
  const titleId = `${formId}-title`;
  const nameErrorId = `${formId}-name-error`;
  const followUpErrorId = `${formId}-follow-up-error`;
  const formErrorId = `${formId}-form-error`;

  const [form, setForm] = useState<FormState>(() => emptyForm(defaultBusiness));
  const [nameError, setNameError] = useState<string | null>(null);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [prevOpen, setPrevOpen] = useState(false);
  const [prevEditingId, setPrevEditingId] = useState<string | null>(null);

  const editingId = editingContact?.id ?? null;

  if (open !== prevOpen || editingId !== prevEditingId) {
    setPrevOpen(open);
    setPrevEditingId(editingId);
    if (open) {
      setForm(
        editingContact ? formFromContact(editingContact) : emptyForm(defaultBusiness),
      );
      setNameError(null);
      setFollowUpError(null);
      setFormError(null);
      setSubmitting(false);
    }
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      saveAttempt.current += 1;
      if (!dialog.open) dialog.showModal();
      nameRef.current?.focus();
      return;
    }

    if (dialog.open) dialog.close();
  }, [open]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "name") setNameError(null);
    if (key === "followUpText" || key === "followUpDate" || key === "stage") {
      setFollowUpError(null);
    }
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const name = form.name.trim();
    const followUpText = form.followUpText.trim();
    let invalid = false;

    if (!name) {
      setNameError("Enter a contact name.");
      invalid = true;
    } else {
      setNameError(null);
    }

    if (form.stage !== "closed" && followUpText && !form.followUpDate) {
      setFollowUpError("Choose a date for your new follow-up.");
      invalid = true;
    } else {
      setFollowUpError(null);
    }

    if (invalid) {
      if (!name) nameRef.current?.focus();
      else followUpDateRef.current?.focus();
      return;
    }

    const attempt = saveAttempt.current;
    setSubmitting(true);

    const fields = {
      business: form.business,
      name,
      company: form.company,
      phone: form.phone,
      email: form.email,
      location: form.location,
      backup_name: form.backup_name,
      backup_role: form.backup_role,
      backup_phone: form.backup_phone,
      backup_email: form.backup_email,
      heat: form.heat,
      stage: form.stage,
    };
    const extras: ContactExtras = {
      note: form.note,
      followUp:
        form.stage === "closed" || !followUpText
          ? null
          : { text: followUpText, date: form.followUpDate },
    };

    try {
      const supabase = createClient();
      const saved = editingContact
        ? await updateContact(supabase, editingContact.id, fields, extras)
        : await createContact(supabase, fields, extras);

      onSaved(saved.id);
      if (saveAttempt.current === attempt) onClose();
    } catch (error) {
      if (saveAttempt.current !== attempt) return;
      setFormError(
        error instanceof Error && error.message
          ? error.message
          : "Could not save this contact. Try again.",
      );
    } finally {
      if (saveAttempt.current === attempt) setSubmitting(false);
    }
  }

  const followUpsPaused = form.stage === "closed";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={handleBackdropClick}
      className="m-auto w-[min(42rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-white p-0 text-ink shadow-xl backdrop:bg-navy/40"
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[min(90vh,52rem)] flex-col overflow-hidden"
        noValidate
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-navy">
            {editingContact ? "Edit contact" : "Add contact"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-page hover:text-ink"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M5 5l10 10M15 5 5 15" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <fieldset disabled={submitting} className="min-w-0 border-0 p-0">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id={`${formId}-name`} label="Contact name" required>
                <input
                  ref={nameRef}
                  id={`${formId}-name`}
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  value={form.name}
                  aria-invalid={nameError ? true : undefined}
                  aria-describedby={nameError ? nameErrorId : undefined}
                  onChange={(event) => updateField("name", event.target.value)}
                  className={controlClass}
                />
                {nameError ? (
                  <p id={nameErrorId} role="alert" className="mt-1.5 text-sm text-danger">
                    {nameError}
                  </p>
                ) : null}
              </Field>

              <Field id={`${formId}-company`} label="Company/property">
                <input
                  id={`${formId}-company`}
                  name="company"
                  type="text"
                  autoComplete="organization"
                  value={form.company}
                  onChange={(event) => updateField("company", event.target.value)}
                  className={controlClass}
                />
              </Field>

              <Field id={`${formId}-business`} label="Business">
                <select
                  id={`${formId}-business`}
                  name="business"
                  value={form.business}
                  onChange={(event) =>
                    updateField("business", event.target.value as Business)
                  }
                  className={controlClass}
                >
                  {BUSINESSES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field id={`${formId}-heat`} label="Lead category">
                <select
                  id={`${formId}-heat`}
                  name="heat"
                  value={form.heat}
                  onChange={(event) => updateField("heat", event.target.value as Heat)}
                  className={controlClass}
                >
                  {HEATS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field id={`${formId}-stage`} label="Sales stage">
                <select
                  id={`${formId}-stage`}
                  name="stage"
                  value={form.stage}
                  onChange={(event) => updateField("stage", event.target.value as Stage)}
                  className={controlClass}
                >
                  {STAGES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field id={`${formId}-phone`} label="Phone">
                <input
                  id={`${formId}-phone`}
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  className={controlClass}
                />
              </Field>

              <Field id={`${formId}-email`} label="Email">
                <input
                  id={`${formId}-email`}
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  className={controlClass}
                />
              </Field>

              <Field
                id={`${formId}-location`}
                label="Property address"
                className="sm:col-span-2"
              >
                <input
                  id={`${formId}-location`}
                  name="location"
                  type="text"
                  autoComplete="street-address"
                  value={form.location}
                  onChange={(event) => updateField("location", event.target.value)}
                  className={controlClass}
                />
              </Field>
            </div>

            <section className="mt-6 border-t border-line pt-5">
              <SectionHeading>Backup contact</SectionHeading>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field id={`${formId}-backup-name`} label="Backup name">
                  <input
                    id={`${formId}-backup-name`}
                    name="backup_name"
                    type="text"
                    autoComplete="off"
                    value={form.backup_name}
                    onChange={(event) => updateField("backup_name", event.target.value)}
                    className={controlClass}
                  />
                </Field>
                <Field id={`${formId}-backup-role`} label="Role">
                  <input
                    id={`${formId}-backup-role`}
                    name="backup_role"
                    type="text"
                    autoComplete="off"
                    value={form.backup_role}
                    onChange={(event) => updateField("backup_role", event.target.value)}
                    className={controlClass}
                  />
                </Field>
                <Field id={`${formId}-backup-phone`} label="Backup phone">
                  <input
                    id={`${formId}-backup-phone`}
                    name="backup_phone"
                    type="tel"
                    autoComplete="off"
                    value={form.backup_phone}
                    onChange={(event) => updateField("backup_phone", event.target.value)}
                    className={controlClass}
                  />
                </Field>
                <Field id={`${formId}-backup-email`} label="Backup email">
                  <input
                    id={`${formId}-backup-email`}
                    name="backup_email"
                    type="email"
                    autoComplete="off"
                    value={form.backup_email}
                    onChange={(event) => updateField("backup_email", event.target.value)}
                    className={controlClass}
                  />
                </Field>
              </div>
            </section>

            <section className="mt-6 border-t border-line pt-5">
              <SectionHeading>Add a follow-up</SectionHeading>
              {followUpsPaused ? (
                <p className="mt-3 rounded-lg bg-page px-3 py-2 text-sm text-muted">
                  Follow-ups for closed leads are paused.
                </p>
              ) : (
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_11.5rem]">
                  <Field id={`${formId}-follow-up`} label="What needs to happen?">
                    <input
                      id={`${formId}-follow-up`}
                      name="follow_up_text"
                      type="text"
                      value={form.followUpText}
                      onChange={(event) => updateField("followUpText", event.target.value)}
                      className={controlClass}
                    />
                  </Field>
                  <Field id={`${formId}-follow-up-date`} label="When?">
                    <input
                      ref={followUpDateRef}
                      id={`${formId}-follow-up-date`}
                      name="follow_up_date"
                      type="date"
                      value={form.followUpDate}
                      aria-invalid={followUpError ? true : undefined}
                      aria-describedby={followUpError ? followUpErrorId : undefined}
                      onChange={(event) => updateField("followUpDate", event.target.value)}
                      className={controlClass}
                    />
                  </Field>
                  {followUpError ? (
                    <p
                      id={followUpErrorId}
                      role="alert"
                      className="text-sm text-danger sm:col-span-2"
                    >
                      {followUpError}
                    </p>
                  ) : null}
                </div>
              )}
            </section>

            <section className="mt-6 border-t border-line pt-5">
              <label
                htmlFor={`${formId}-note`}
                className="text-sm font-semibold text-navy"
              >
                Add a note
              </label>
              <textarea
                id={`${formId}-note`}
                name="note"
                rows={3}
                value={form.note}
                onChange={(event) => updateField("note", event.target.value)}
                className={controlClass}
              />
            </section>
          </fieldset>
        </div>

        <footer className="shrink-0 border-t border-line px-6 py-4">
          {formError ? (
            <p
              id={formErrorId}
              role="alert"
              className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {formError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-page"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-navy px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Saving…" : editingContact ? "Save changes" : "Add contact"}
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
