"use client";

import { Star } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import { createContractor, updateContractor } from "@/lib/contractors";
import { createClient } from "@/lib/supabase/client";
import type { Contractor, ContractorStatus } from "@/lib/types";

type ContractorFormDialogProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  trades: string[];
  contractor?: Contractor | null;
};

type FormState = {
  name: string;
  trade: string;
  company: string;
  phone: string;
  alt_phone: string;
  email: string;
  area_served: string;
  services_description: string;
  rating: number | null;
  status: ContractorStatus;
};

const controlClass =
  "input mt-1.5 w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-mint/40 placeholder:text-muted/70 focus:border-navy focus:ring-2";

function emptyForm(): FormState {
  return {
    name: "",
    trade: "",
    company: "",
    phone: "",
    alt_phone: "",
    email: "",
    area_served: "",
    services_description: "",
    rating: null,
    status: "active",
  };
}

function formFromContractor(contractor: Contractor): FormState {
  return {
    name: contractor.name,
    trade: contractor.trade,
    company: contractor.company ?? "",
    phone: contractor.phone ?? "",
    alt_phone: contractor.alt_phone ?? "",
    email: contractor.email ?? "",
    area_served: contractor.area_served ?? "",
    services_description: contractor.services_description ?? "",
    rating: contractor.rating,
    status: contractor.status,
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

export function ContractorFormDialog({
  open,
  onClose,
  onSaved,
  trades,
  contractor = null,
}: ContractorFormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const tradeRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const titleId = `${formId}-title`;
  const nameErrorId = `${formId}-name-error`;
  const tradeErrorId = `${formId}-trade-error`;
  const formErrorId = `${formId}-form-error`;
  const tradeListId = `${formId}-trades`;

  const [form, setForm] = useState<FormState>(emptyForm);
  const [nameError, setNameError] = useState<string | null>(null);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [prevOpen, setPrevOpen] = useState(false);
  const [prevEditingId, setPrevEditingId] = useState<string | null>(null);
  const editingId = contractor?.id ?? null;

  if (open !== prevOpen || editingId !== prevEditingId) {
    setPrevOpen(open);
    setPrevEditingId(editingId);
    if (open) {
      setForm(contractor ? formFromContractor(contractor) : emptyForm());
      setNameError(null);
      setTradeError(null);
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
    if (key === "trade") setTradeError(null);
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const name = form.name.trim();
    const trade = form.trade.trim();
    let invalid = false;

    if (!name) {
      setNameError("Enter a contractor name.");
      invalid = true;
    } else {
      setNameError(null);
    }

    if (!trade) {
      setTradeError("Enter a trade.");
      invalid = true;
    } else {
      setTradeError(null);
    }

    if (invalid) {
      if (!name) nameRef.current?.focus();
      else tradeRef.current?.focus();
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();
      const fields = {
        name,
        trade,
        company: form.company,
        phone: form.phone,
        alt_phone: form.alt_phone,
        email: form.email,
        area_served: form.area_served,
        services_description: form.services_description,
        rating: form.rating,
        status: form.status,
      };
      if (contractor) {
        await updateContractor(supabase, contractor.id, fields);
      } else {
        await createContractor(supabase, fields);
      }
      onSaved();
      onClose();
    } catch (error) {
      setFormError(
        error instanceof Error && error.message
          ? error.message
          : "Could not save this contractor. Try again.",
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
            {contractor ? "Edit contractor" : "Add contractor"}
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

              <Field id={`${formId}-trade`} label="Trade" required>
                <input
                  ref={tradeRef}
                  id={`${formId}-trade`}
                  name="trade"
                  type="text"
                  required
                  maxLength={120}
                  autoComplete="off"
                  list={tradeListId}
                  value={form.trade}
                  aria-invalid={tradeError ? true : undefined}
                  aria-describedby={tradeError ? tradeErrorId : undefined}
                  onChange={(event) => updateField("trade", event.target.value)}
                  className={controlClass}
                />
                <datalist id={tradeListId}>
                  {trades.map((trade) => (
                    <option key={trade} value={trade} />
                  ))}
                </datalist>
                {tradeError ? (
                  <p id={tradeErrorId} role="alert" className="mt-1.5 text-sm text-danger">
                    {tradeError}
                  </p>
                ) : null}
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

              <Field id={`${formId}-area`} label="Area served" className="md:col-span-2">
                <input
                  id={`${formId}-area`}
                  name="area_served"
                  type="text"
                  maxLength={240}
                  value={form.area_served}
                  onChange={(event) => updateField("area_served", event.target.value)}
                  className={controlClass}
                />
              </Field>

              <Field
                id={`${formId}-services`}
                label="Services description"
                className="md:col-span-2"
              >
                <textarea
                  id={`${formId}-services`}
                  name="services_description"
                  rows={3}
                  maxLength={2000}
                  value={form.services_description}
                  onChange={(event) =>
                    updateField("services_description", event.target.value)
                  }
                  className={controlClass}
                />
              </Field>

              <div className="min-w-0">
                <p id={`${formId}-rating-label`} className="text-sm font-medium text-ink">
                  Rating
                </p>
                <div
                  role="radiogroup"
                  aria-labelledby={`${formId}-rating-label`}
                  className="mt-1.5 flex gap-1"
                >
                  {[1, 2, 3, 4, 5].map((value) => {
                    const filled = form.rating != null && value <= form.rating;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={form.rating === value}
                        aria-label={`${value} star${value === 1 ? "" : "s"}`}
                        onClick={() =>
                          updateField("rating", form.rating === value ? null : value)
                        }
                        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-page hover:text-navy"
                      >
                        <Star
                          aria-hidden="true"
                          size={20}
                          strokeWidth={1.75}
                          className={filled ? "fill-amber-400 text-amber-400" : undefined}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <Field id={`${formId}-status`} label="Status">
                <select
                  id={`${formId}-status`}
                  name="status"
                  value={form.status}
                  onChange={(event) =>
                    updateField("status", event.target.value as ContractorStatus)
                  }
                  className={controlClass}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
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
              {submitting ? "Saving…" : contractor ? "Save changes" : "Add contractor"}
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
