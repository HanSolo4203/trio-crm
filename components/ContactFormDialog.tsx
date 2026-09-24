"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  BusinessSelectOptions,
  StatusDot,
  statusPillClass,
  tagPillStyle,
  useBusinessDisplay,
  useTagColors,
} from "@/components/BusinessSettingsProvider";
import { HEATS, STAGES } from "@/lib/constants";
import { createContact, updateContact, type ContactExtras } from "@/lib/crm";
import { createClient } from "@/lib/supabase/client";
import type { Business, CommissionStatus, Contact, Heat, Stage } from "@/lib/types";

type ContactFormDialogProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (contactId: string) => void;
  editingContact: Contact | null;
  defaultBusiness: Business;
  contacts?: Contact[];
};

type DuplicateMatch = {
  id: string;
  name: string;
  business: Business;
  matchedOn: "phone" | "email" | "both";
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
  referral_source: string;
  commission_status: CommissionStatus;
  commission_amount: string;
  tags: string[];
  followUpText: string;
  followUpDate: string;
  note: string;
};

const controlClass =
  "input mt-1.5 w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-mint/40 placeholder:text-muted/70 focus:border-navy focus:ring-2";

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
    referral_source: "",
    commission_status: "none",
    commission_amount: "",
    tags: [],
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
    referral_source: contact.referral_source ?? "",
    commission_status: contact.commission_status ?? "none",
    commission_amount:
      contact.commission_amount == null ? "" : String(contact.commission_amount),
    tags: contact.tags ?? [],
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
    <div className={`min-w-0 ${className ?? ""}`}>
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

function normalizePhone(value: string) {
  return value.replace(/[\s()-]/g, "");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function orLiteral(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function duplicateLabel(matchedOn: DuplicateMatch["matchedOn"]) {
  if (matchedOn === "both") return "phone and email";
  return matchedOn;
}

function findDuplicate(
  contacts: Pick<Contact, "id" | "name" | "business" | "phone" | "email">[],
  phone: string,
  email: string,
): DuplicateMatch | null {
  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = normalizeEmail(email);
  let phoneMatch: (typeof contacts)[number] | null = null;
  let emailMatch: (typeof contacts)[number] | null = null;

  for (const contact of contacts) {
    const phoneHit =
      Boolean(normalizedPhone) &&
      Boolean(contact.phone) &&
      normalizePhone(contact.phone ?? "") === normalizedPhone;
    const emailHit =
      Boolean(normalizedEmail) &&
      Boolean(contact.email) &&
      normalizeEmail(contact.email ?? "") === normalizedEmail;

    if (phoneHit && emailHit) return toDuplicateMatch(contact, "both");
    if (phoneHit && !phoneMatch) phoneMatch = contact;
    if (emailHit && !emailMatch) emailMatch = contact;
  }

  if (phoneMatch) return toDuplicateMatch(phoneMatch, "phone");
  if (emailMatch) return toDuplicateMatch(emailMatch, "email");
  return null;
}

function toDuplicateMatch(
  contact: Pick<Contact, "id" | "name" | "business">,
  matchedOn: DuplicateMatch["matchedOn"],
): DuplicateMatch {
  return {
    id: contact.id,
    name: contact.name,
    business: contact.business,
    matchedOn,
  };
}

async function queryDuplicate(
  supabase: SupabaseClient,
  phone: string,
  email: string,
) {
  const filters: string[] = [];
  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = normalizeEmail(email);

  if (normalizedPhone) filters.push(`phone.eq.${orLiteral(normalizedPhone)}`);
  if (normalizedEmail) {
    const literal = normalizedEmail.replace(/[%_\\]/g, (char) => `\\${char}`);
    filters.push(`email.ilike.${orLiteral(literal)}`);
  }
  if (filters.length === 0) return null;

  const { data, error } = await supabase
    .from("crm_contacts")
    .select("id, name, business, phone, email")
    .or(filters.join(","));
  if (error) throw new Error(error.message);

  return findDuplicate((data ?? []) as Contact[], phone, email);
}

function addTag(tags: string[], raw: string) {
  return raw.split(",").reduce((next, part) => {
    const tag = part.trim().toLowerCase();
    if (!tag || next.includes(tag)) return next;
    return [...next, tag];
  }, tags);
}

export function ContactFormDialog({
  open,
  onClose,
  onSaved,
  editingContact,
  defaultBusiness,
  contacts,
}: ContactFormDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const followUpDateRef = useRef<HTMLInputElement>(null);
  const saveAttempt = useRef(0);
  const formId = useId();
  const titleId = `${formId}-title`;
  const nameErrorId = `${formId}-name-error`;
  const followUpErrorId = `${formId}-follow-up-error`;
  const formErrorId = `${formId}-form-error`;

  const tagColors = useTagColors();
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultBusiness));
  const [tagDraft, setTagDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const [prevOpen, setPrevOpen] = useState(false);
  const [prevEditingId, setPrevEditingId] = useState<string | null>(null);

  const editingId = editingContact?.id ?? null;
  const duplicateBusiness = useBusinessDisplay(duplicate?.business ?? "right-stay");

  if (open !== prevOpen || editingId !== prevEditingId) {
    setPrevOpen(open);
    setPrevEditingId(editingId);
    if (open) {
      setForm(
        editingContact ? formFromContact(editingContact) : emptyForm(defaultBusiness),
      );
      setTagDraft("");
      setNameError(null);
      setFollowUpError(null);
      setFormError(null);
      setDuplicate(null);
      setDuplicateAcknowledged(false);
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
    if (key === "phone" || key === "email") {
      setDuplicate(null);
      setDuplicateAcknowledged(false);
    }
    if (key === "followUpText" || key === "followUpDate" || key === "stage") {
      setFollowUpError(null);
    }
  }

  function commitTagDraft(raw = tagDraft) {
    setForm((current) => ({ ...current, tags: addTag(current.tags, raw) }));
    setTagDraft("");
  }

  function removeTag(tag: string) {
    setForm((current) => ({ ...current, tags: current.tags.filter((item) => item !== tag) }));
  }

  function handleTagKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitTagDraft();
      return;
    }
    if (event.key === "Backspace" && tagDraft === "" && form.tags.length > 0) {
      event.preventDefault();
      const last = form.tags[form.tags.length - 1];
      removeTag(last);
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

    const phone = form.phone.trim();
    const email = form.email.trim();
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
      referral_source: form.referral_source,
      commission_status: form.commission_status,
      commission_amount:
        form.commission_amount === "" ? null : Number(form.commission_amount),
      heat: form.heat,
      stage: form.stage,
      tags: addTag(form.tags, tagDraft),
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

      if (!editingContact && (phone || email) && !duplicateAcknowledged) {
        const match = contacts
          ? findDuplicate(contacts, phone, email)
          : await queryDuplicate(supabase, phone, email);
        if (saveAttempt.current !== attempt) return;
        if (match) {
          setDuplicate(match);
          setDuplicateAcknowledged(true);
          return;
        }
      }

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
      className="sheet-dialog bg-white text-ink backdrop:bg-navy/40"
    >
      <form
        onSubmit={handleSubmit}
        className="flex h-full max-h-[100dvh] min-h-0 flex-col overflow-hidden md:h-auto md:max-h-[min(90vh,52rem)] md:overflow-hidden md:rounded-2xl"
        noValidate
      >
        <header className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-4 border-b border-line bg-white px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] md:px-6 md:py-4">
          <h2 id={titleId} className="text-lg font-semibold text-navy">
            {editingContact ? "Edit contact" : "Add contact"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-page hover:text-ink"
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
          <fieldset disabled={submitting} className="min-w-0 border-0 p-0">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  <BusinessSelectOptions />
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
                className="md:col-span-2"
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

            <div className="mt-4">
              <label htmlFor={`${formId}-tags`} className="text-sm font-medium text-ink">
                Tags
              </label>
              <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-line bg-white px-2 py-1.5 focus-within:border-navy focus-within:ring-2 focus-within:ring-mint/40">
                {form.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`${statusPillClass} gap-1 py-0.5 pl-2 pr-1`}
                    style={tagPillStyle(tagColors[tag])}
                  >
                    <StatusDot color={tagPillStyle(tagColors[tag]).color} />
                    {tag}
                    <button
                      type="button"
                      aria-label={`Remove ${tag}`}
                      onClick={() => removeTag(tag)}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted hover:bg-white hover:text-ink"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  id={`${formId}-tags`}
                  name="tags"
                  type="text"
                  autoComplete="off"
                  value={tagDraft}
                  placeholder={form.tags.length === 0 ? "Add a tag" : ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value.includes(",")) {
                      commitTagDraft(value);
                      return;
                    }
                    setTagDraft(value);
                  }}
                  onKeyDown={handleTagKeyDown}
                  className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-1 text-sm text-ink outline-none placeholder:text-muted/70"
                />
              </div>
            </div>

            <section className="mt-6 border-t border-line pt-5">
              <SectionHeading>Backup contact</SectionHeading>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
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
              <SectionHeading>Referral</SectionHeading>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field
                  id={`${formId}-referral-source`}
                  label="Referral source"
                  className="md:col-span-2"
                >
                  <input
                    id={`${formId}-referral-source`}
                    name="referral_source"
                    type="text"
                    autoComplete="off"
                    value={form.referral_source}
                    onChange={(event) => updateField("referral_source", event.target.value)}
                    className={controlClass}
                  />
                </Field>
                <Field id={`${formId}-commission-status`} label="Commission status">
                  <select
                    id={`${formId}-commission-status`}
                    name="commission_status"
                    value={form.commission_status}
                    onChange={(event) =>
                      updateField("commission_status", event.target.value as CommissionStatus)
                    }
                    className={controlClass}
                  >
                    <option value="none">None</option>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                  </select>
                </Field>
                {form.commission_status !== "none" ? (
                  <Field id={`${formId}-commission-amount`} label="Commission amount">
                    <input
                      id={`${formId}-commission-amount`}
                      name="commission_amount"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.01}
                      value={form.commission_amount}
                      onChange={(event) => updateField("commission_amount", event.target.value)}
                      className={controlClass}
                    />
                  </Field>
                ) : null}
              </div>
            </section>

            <section className="mt-6 border-t border-line pt-5">
              <SectionHeading>Add a follow-up</SectionHeading>
              {followUpsPaused ? (
                <p className="mt-3 rounded-lg bg-page px-3 py-2 text-sm text-muted">
                  Follow-ups for closed leads are paused.
                </p>
              ) : (
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_11.5rem]">
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
                      className="text-sm text-danger md:col-span-2"
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

        <footer className="sticky bottom-0 z-10 shrink-0 border-t border-line bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 md:px-6 md:py-4">
          {duplicate ? (
            <div
              role="status"
              className="mb-3 rounded-lg bg-[#fff1d9] px-3 py-2 text-sm text-ink"
            >
              <p>
                A contact with this {duplicateLabel(duplicate.matchedOn)} already exists:{" "}
                {duplicate.name} ({duplicateBusiness.name}).
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(`/contacts/${duplicate.id}`);
                }}
                className="mt-1 text-sm font-medium text-blue underline-offset-2 hover:underline"
              >
                View existing contact
              </button>
            </div>
          ) : null}
          {formError ? (
            <p
              id={formErrorId}
              role="alert"
              className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {formError}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 md:flex-row md:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="btn inline-flex w-full items-center justify-center rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-page md:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary inline-flex w-full items-center justify-center rounded-full bg-navy px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
            >
              {submitting
                ? "Saving…"
                : editingContact
                  ? "Save changes"
                  : duplicate
                    ? "Save anyway"
                    : "Add contact"}
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
