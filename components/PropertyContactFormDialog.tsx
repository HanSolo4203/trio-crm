"use client";

import { useQuery } from "@tanstack/react-query";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import { addPropertyContact, updatePropertyContact } from "@/lib/properties";
import { queryKeys } from "@/lib/queryKeys";
import { fetchPropertyContactRoles } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import type { PropertyContact } from "@/lib/types";

type PropertyContactFormDialogProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  propertyId: string;
  contact?: PropertyContact | null;
};

type FormState = {
  role: string;
  contact_name: string;
  company: string;
  phone: string;
  alt_phone: string;
  email: string;
  description: string;
};

const controlClass =
  "input mt-1.5 w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-mint/40 placeholder:text-muted/70 focus:border-navy focus:ring-2";

function emptyForm(): FormState {
  return {
    role: "",
    contact_name: "",
    company: "",
    phone: "",
    alt_phone: "",
    email: "",
    description: "",
  };
}

function formFromContact(contact: PropertyContact): FormState {
  return {
    role: contact.role,
    contact_name: contact.contact_name ?? "",
    company: contact.company ?? "",
    phone: contact.phone ?? "",
    alt_phone: contact.alt_phone ?? "",
    email: contact.email ?? "",
    description: contact.description ?? "",
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

export function PropertyContactFormDialog({
  open,
  onClose,
  onSaved,
  propertyId,
  contact = null,
}: PropertyContactFormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const roleRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const titleId = `${formId}-title`;
  const roleErrorId = `${formId}-role-error`;
  const formErrorId = `${formId}-form-error`;
  const rolesDatalistId = `${formId}-roles`;

  const rolesQuery = useQuery({
    queryKey: queryKeys.propertyContactRoles,
    queryFn: fetchPropertyContactRoles,
  });
  const roles = [...new Set((rolesQuery.data ?? []).map((role) => role.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );

  const [form, setForm] = useState<FormState>(emptyForm);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [prevOpen, setPrevOpen] = useState(false);
  const [prevEditingId, setPrevEditingId] = useState<string | null>(null);
  const editingId = contact?.id ?? null;

  if (open !== prevOpen || editingId !== prevEditingId) {
    setPrevOpen(open);
    setPrevEditingId(editingId);
    if (open) {
      setForm(contact ? formFromContact(contact) : emptyForm());
      setRoleError(null);
      setFormError(null);
      setSubmitting(false);
    }
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      roleRef.current?.focus();
      return;
    }

    if (dialog.open) dialog.close();
  }, [open]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "role") setRoleError(null);
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const role = form.role.trim();
    if (!role) {
      setRoleError("Enter a role.");
      roleRef.current?.focus();
      return;
    }
    setRoleError(null);

    setSubmitting(true);

    try {
      const supabase = createClient();
      const fields = {
        role,
        contact_name: form.contact_name,
        company: form.company,
        phone: form.phone,
        alt_phone: form.alt_phone,
        email: form.email,
        description: form.description,
      };
      if (contact) {
        await updatePropertyContact(supabase, contact.id, fields);
      } else {
        await addPropertyContact(supabase, propertyId, fields);
      }
      onSaved();
      onClose();
    } catch (error) {
      setFormError(
        error instanceof Error && error.message
          ? error.message
          : "Could not save this contact. Try again.",
      );
      setSubmitting(false);
    }
  }

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
            {contact ? "Edit contact" : "Add contact"}
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
              <Field id={`${formId}-role`} label="Role" required>
                <input
                  ref={roleRef}
                  id={`${formId}-role`}
                  name="role"
                  type="text"
                  required
                  maxLength={120}
                  autoComplete="off"
                  list={rolesDatalistId}
                  value={form.role}
                  aria-invalid={roleError ? true : undefined}
                  aria-describedby={roleError ? roleErrorId : undefined}
                  onChange={(event) => updateField("role", event.target.value)}
                  className={controlClass}
                />
                <datalist id={rolesDatalistId}>
                  {roles.map((role) => (
                    <option key={role} value={role} />
                  ))}
                </datalist>
                {roleError ? (
                  <p id={roleErrorId} role="alert" className="mt-1.5 text-sm text-danger">
                    {roleError}
                  </p>
                ) : null}
              </Field>

              <Field id={`${formId}-contact-name`} label="Contact name">
                <input
                  id={`${formId}-contact-name`}
                  name="contact_name"
                  type="text"
                  maxLength={160}
                  autoComplete="name"
                  value={form.contact_name}
                  onChange={(event) => updateField("contact_name", event.target.value)}
                  className={controlClass}
                />
              </Field>

              <Field id={`${formId}-company`} label="Company">
                <input
                  id={`${formId}-company`}
                  name="company"
                  type="text"
                  maxLength={240}
                  autoComplete="organization"
                  value={form.company}
                  onChange={(event) => updateField("company", event.target.value)}
                  className={controlClass}
                />
              </Field>

              <Field id={`${formId}-phone`} label="Phone">
                <input
                  id={`${formId}-phone`}
                  name="phone"
                  type="tel"
                  maxLength={80}
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  className={controlClass}
                />
              </Field>

              <Field id={`${formId}-alt-phone`} label="Alt phone/WhatsApp">
                <input
                  id={`${formId}-alt-phone`}
                  name="alt_phone"
                  type="tel"
                  maxLength={80}
                  autoComplete="tel"
                  value={form.alt_phone}
                  onChange={(event) => updateField("alt_phone", event.target.value)}
                  className={controlClass}
                />
              </Field>

              <Field id={`${formId}-email`} label="Email">
                <input
                  id={`${formId}-email`}
                  name="email"
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  className={controlClass}
                />
              </Field>

              <Field id={`${formId}-description`} label="Description" className="md:col-span-2">
                <textarea
                  id={`${formId}-description`}
                  name="description"
                  rows={3}
                  maxLength={2000}
                  placeholder="Who they are, when to call them, anything useful to know"
                  value={form.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  className={controlClass}
                />
              </Field>
            </div>
          </fieldset>
        </div>

        <footer className="sticky bottom-0 z-10 shrink-0 border-t border-line bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 md:px-6 md:py-4">
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
              {submitting ? "Saving…" : contact ? "Save changes" : "Add contact"}
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
