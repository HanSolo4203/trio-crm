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

import { BusinessSelectOptions } from "@/components/BusinessSettingsProvider";
import { BUSINESSES } from "@/lib/constants";
import { createProperty, updateProperty } from "@/lib/properties";
import { createClient } from "@/lib/supabase/client";
import type { Business, Property } from "@/lib/types";

type PropertyFormDialogProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  property?: Property | null;
};

type FormState = {
  name: string;
  business: Business | "";
  address: string;
  notes: string;
};

const controlClass =
  "input mt-1.5 w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-mint/40 placeholder:text-muted/70 focus:border-navy focus:ring-2";

function emptyForm(): FormState {
  return {
    name: "",
    business: "",
    address: "",
    notes: "",
  };
}

function formFromProperty(property: Property): FormState {
  return {
    name: property.name,
    business: property.business ?? "",
    address: property.address ?? "",
    notes: property.notes ?? "",
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

export function PropertyFormDialog({
  open,
  onClose,
  onSaved,
  property = null,
}: PropertyFormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const titleId = `${formId}-title`;
  const nameErrorId = `${formId}-name-error`;
  const formErrorId = `${formId}-form-error`;

  const [form, setForm] = useState<FormState>(emptyForm);
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [prevOpen, setPrevOpen] = useState(false);
  const [prevEditingId, setPrevEditingId] = useState<string | null>(null);
  const editingId = property?.id ?? null;

  if (open !== prevOpen || editingId !== prevEditingId) {
    setPrevOpen(open);
    setPrevEditingId(editingId);
    if (open) {
      setForm(property ? formFromProperty(property) : emptyForm());
      setNameError(null);
      setFormError(null);
      setSubmitting(false);
    }
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      nameRef.current?.focus();
      return;
    }

    if (dialog.open) dialog.close();
  }, [open]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "name") setNameError(null);
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const name = form.name.trim();
    if (!name) {
      setNameError("Enter a property name.");
      nameRef.current?.focus();
      return;
    }
    setNameError(null);

    const business = BUSINESSES.find((item) => item.id === form.business)?.id ?? null;

    setSubmitting(true);

    try {
      const supabase = createClient();
      const fields = {
        name,
        business,
        address: form.address,
        notes: form.notes,
      };
      if (property) {
        await updateProperty(supabase, property.id, fields);
      } else {
        await createProperty(supabase, fields);
      }
      onSaved();
      onClose();
    } catch (error) {
      setFormError(
        error instanceof Error && error.message
          ? error.message
          : "Could not save this property. Try again.",
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
            {property ? "Edit property" : "Add property"}
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
              <Field id={`${formId}-name`} label="Name" required>
                <input
                  ref={nameRef}
                  id={`${formId}-name`}
                  name="name"
                  type="text"
                  required
                  maxLength={160}
                  autoComplete="off"
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

              <Field id={`${formId}-business`} label="Business">
                <select
                  id={`${formId}-business`}
                  name="business"
                  value={form.business}
                  onChange={(event) => updateField("business", event.target.value as FormState["business"])}
                  className={controlClass}
                >
                  <option value="">— none —</option>
                  <BusinessSelectOptions />
                </select>
              </Field>

              <Field id={`${formId}-address`} label="Address" className="md:col-span-2">
                <input
                  id={`${formId}-address`}
                  name="address"
                  type="text"
                  maxLength={350}
                  autoComplete="street-address"
                  value={form.address}
                  onChange={(event) => updateField("address", event.target.value)}
                  className={controlClass}
                />
              </Field>

              <Field id={`${formId}-notes`} label="Notes" className="md:col-span-2">
                <textarea
                  id={`${formId}-notes`}
                  name="notes"
                  rows={3}
                  maxLength={2000}
                  value={form.notes}
                  onChange={(event) => updateField("notes", event.target.value)}
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
              {submitting ? "Saving…" : property ? "Save changes" : "Add property"}
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
