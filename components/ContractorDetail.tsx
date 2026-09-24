"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";

import { BusinessPill, BusinessSelectOptions } from "@/components/BusinessSettingsProvider";
import { ContractorFormDialog } from "@/components/ContractorFormDialog";
import { BUSINESSES, formatDate, formatRand, localDate } from "@/lib/constants";
import { addJob, deleteContractor } from "@/lib/contractors";
import { queryKeys } from "@/lib/queryKeys";
import { fetchContractor, fetchContractorJobs, fetchContractors, invalidateContractors } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import type { Business, ContractorJob } from "@/lib/types";

type ContractorDetailProps = {
  contractorId: string;
};

type JobFormState = {
  job_date: string;
  business: "" | Business;
  property_or_context: string;
  work_done: string;
  reason: string;
  cost: string;
};

const controlClass =
  "input mt-1.5 w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-mint/40 placeholder:text-muted/70 focus:border-navy focus:ring-2";

const secondaryButtonClass =
  "btn inline-flex items-center justify-center rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-page disabled:cursor-not-allowed disabled:opacity-60";

const primaryButtonClass =
  "btn btn-primary inline-flex items-center justify-center rounded-full bg-navy px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60";

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Something went wrong. Try again.";
}

function emptyJobForm(): JobFormState {
  return {
    job_date: "",
    business: "",
    property_or_context: "",
    work_done: "",
    reason: "",
    cost: "",
  };
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

function jobCost(job: ContractorJob) {
  if (job.cost == null) return null;
  const value = Number(job.cost);
  return Number.isFinite(value) ? value : null;
}

function compareJobs(a: ContractorJob, b: ContractorJob) {
  if (a.job_date !== b.job_date) return a.job_date < b.job_date ? 1 : -1;
  if (a.created_at === b.created_at) return 0;
  return a.created_at < b.created_at ? 1 : -1;
}

function InfoItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{children}</dd>
    </div>
  );
}

function TextValue({ value, href }: { value: string | null; href?: string | null }) {
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

function StarRating({ rating }: { rating: number | null }) {
  if (rating == null) return null;
  const filled = Math.min(5, Math.max(0, Math.round(rating)));
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${filled} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          aria-hidden="true"
          size={16}
          strokeWidth={1.75}
          className={value <= filled ? "fill-amber-400 text-amber-400" : "text-line"}
        />
      ))}
    </span>
  );
}

function LogJobForm({
  onSave,
}: {
  onSave: (fields: {
    job_date: string;
    business: Business | null;
    property_or_context: string;
    work_done: string;
    reason: string;
    cost: number | null;
  }) => Promise<void>;
}) {
  const formId = useId();
  const workRef = useRef<HTMLTextAreaElement>(null);
  const [form, setForm] = useState<JobFormState>(emptyJobForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setForm((current) => (current.job_date ? current : { ...current, job_date: localDate() }));
  }, []);

  function update<K extends keyof JobFormState>(key: K, value: JobFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "work_done") setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const workDone = form.work_done.trim();
    if (!workDone) {
      setError("Describe what was done.");
      workRef.current?.focus();
      return;
    }

    const costText = form.cost.trim();
    let cost: number | null = null;
    if (costText) {
      cost = Number(costText);
      if (!Number.isFinite(cost)) {
        setError("Enter a valid cost, or leave it blank.");
        return;
      }
    }

    const business = BUSINESSES.find((item) => item.id === form.business)?.id ?? null;

    setError(null);
    setSubmitting(true);
    try {
      await onSave({
        job_date: form.job_date || localDate(),
        business,
        property_or_context: form.property_or_context,
        work_done: workDone,
        reason: form.reason,
        cost,
      });
      setForm({ ...emptyJobForm(), job_date: localDate() });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line/60 bg-white shadow-card p-5">
      <h2 className="text-base font-semibold text-navy">Log a job</h2>
      <form onSubmit={handleSubmit} className="mt-4" noValidate>
        <fieldset disabled={submitting} className="min-w-0 space-y-4 border-0 p-0">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <FieldLabel htmlFor={`${formId}-date`}>Job date</FieldLabel>
              <input
                id={`${formId}-date`}
                name="job_date"
                type="date"
                required
                value={form.job_date}
                onChange={(event) => update("job_date", event.target.value)}
                className={controlClass}
              />
            </div>
            <div>
              <FieldLabel htmlFor={`${formId}-business`}>Business</FieldLabel>
              <select
                id={`${formId}-business`}
                name="business"
                value={form.business}
                onChange={(event) => update("business", event.target.value as JobFormState["business"])}
                className={controlClass}
              >
                <option value="">— none —</option>
                <BusinessSelectOptions />
              </select>
            </div>
          </div>

          <div>
            <FieldLabel htmlFor={`${formId}-property`}>Property/context</FieldLabel>
            <input
              id={`${formId}-property`}
              name="property_or_context"
              type="text"
              maxLength={350}
              placeholder='e.g. "Unit 408" or "RSL Express facility"'
              value={form.property_or_context}
              onChange={(event) => update("property_or_context", event.target.value)}
              className={controlClass}
            />
          </div>

          <div>
            <FieldLabel htmlFor={`${formId}-work`}>
              What was done
              <span className="text-danger" aria-hidden="true">
                {" *"}
              </span>
            </FieldLabel>
            <textarea
              ref={workRef}
              id={`${formId}-work`}
              name="work_done"
              required
              rows={3}
              maxLength={2000}
              value={form.work_done}
              aria-invalid={error && !form.work_done.trim() ? true : undefined}
              onChange={(event) => update("work_done", event.target.value)}
              className={controlClass}
            />
          </div>

          <div>
            <FieldLabel htmlFor={`${formId}-reason`}>Why</FieldLabel>
            <textarea
              id={`${formId}-reason`}
              name="reason"
              rows={2}
              maxLength={2000}
              placeholder='e.g. "burst pipe" or "routine service"'
              value={form.reason}
              onChange={(event) => update("reason", event.target.value)}
              className={controlClass}
            />
          </div>

          <div className="max-w-xs">
            <FieldLabel htmlFor={`${formId}-cost`}>Cost (R)</FieldLabel>
            <input
              id={`${formId}-cost`}
              name="cost"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.cost}
              onChange={(event) => update("cost", event.target.value)}
              className={controlClass}
            />
          </div>
        </fieldset>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={submitting} className={`${primaryButtonClass} mt-4`}>
          {submitting ? "Saving…" : "Log job"}
        </button>
      </form>
    </section>
  );
}

export function ContractorDetail({ contractorId }: ContractorDetailProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const contractorQuery = useQuery({
    queryKey: queryKeys.contractor(contractorId),
    queryFn: () => fetchContractor(contractorId),
    retry: (failureCount, error) =>
      !(error instanceof Error && error.name === "NotFound") && failureCount < 3,
  });
  const jobsQuery = useQuery({
    queryKey: queryKeys.contractorJobs(contractorId),
    queryFn: () => fetchContractorJobs(contractorId),
  });
  const contractorsQuery = useQuery({
    queryKey: queryKeys.contractors,
    queryFn: fetchContractors,
  });

  const contractor = contractorQuery.data ?? null;
  const jobs = jobsQuery.data ?? [];
  const trades = [...new Set((contractorsQuery.data ?? []).map((row) => row.trade.trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  );
  const missing = contractorQuery.error instanceof Error && contractorQuery.error.name === "NotFound";
  const loadErrorSource = [contractorQuery.error, jobsQuery.error].find(
    (error) => error && !(error instanceof Error && error.name === "NotFound"),
  );
  const loadError = loadErrorSource ? errorMessage(loadErrorSource) : null;
  const loading =
    !missing && !loadError && (contractorQuery.isPending || jobsQuery.isPending);

  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);

  const reload = useCallback(async () => {
    await invalidateContractors(queryClient);
  }, [queryClient]);

  useEffect(() => {
    setEditing(false);
    setDeleteError(null);
    setConfirmingDelete(false);
  }, [contractorId]);

  useEffect(() => {
    if (!contractor) return;
    const previous = document.title;
    document.title = `${contractor.name} · Trio CRM`;
    return () => {
      document.title = previous;
    };
  }, [contractor]);

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
    if (!contractor || deleting) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteContractor(createClient(), contractor.id);
      await invalidateContractors(queryClient);
      router.push("/contractors");
    } catch (error) {
      setDeleteError(errorMessage(error));
      setDeleting(false);
    }
  }

  if (!contractor || contractor.id !== contractorId) {
    if (!loading && missing) {
      return (
        <section className="rounded-2xl border border-line/60 bg-white shadow-card p-6">
          <h1 className="text-xl font-semibold text-navy">Contractor</h1>
          <p role="alert" className="mt-3 text-sm text-muted">
            This contractor could not be found.
          </p>
        </section>
      );
    }
    if (!loading && loadError) {
      return (
        <section className="rounded-2xl border border-line/60 bg-white shadow-card p-6">
          <h1 className="text-xl font-semibold text-navy">Contractor</h1>
          <p role="alert" className="mt-3 text-sm text-danger">
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => {
              void contractorQuery.refetch();
              void jobsQuery.refetch();
            }}
            className={`btn mt-4 inline-flex items-center justify-center ${secondaryButtonClass}`}
          >
            Try again
          </button>
        </section>
      );
    }
    return <p className="text-sm text-muted">Loading contractor…</p>;
  }

  const orderedJobs = jobs.slice().sort(compareJobs);
  const spent = orderedJobs.reduce((sum, job) => sum + (jobCost(job) ?? 0), 0);
  const services = contractor.services_description?.trim() ?? "";
  const active = contractor.status === "active";

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <section className="min-w-0 rounded-2xl border border-line/60 bg-white shadow-card p-5">
          <h1 className="text-2xl font-semibold text-navy">{contractor.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full bg-page px-2.5 py-1 text-xs font-semibold text-ink">
              {contractor.trade}
            </span>
            <StarRating rating={contractor.rating} />
            <span
              className={
                active
                  ? "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                  : "inline-flex rounded-full bg-line px-2.5 py-1 text-xs font-semibold text-muted"
              }
              style={active ? { backgroundColor: "#e6f5ee", color: "#267156" } : undefined}
            >
              {active ? "Active" : "Inactive"}
            </span>
          </div>

          <dl className="mt-5 space-y-4">
            <InfoItem label="Phone">
              <TextValue value={contractor.phone} href={contractor.phone ? phoneHref(contractor.phone) : null} />
            </InfoItem>
            <InfoItem label="Alt phone">
              <TextValue
                value={contractor.alt_phone}
                href={contractor.alt_phone ? phoneHref(contractor.alt_phone) : null}
              />
            </InfoItem>
            <InfoItem label="Email">
              <TextValue value={contractor.email} href={contractor.email ? emailHref(contractor.email) : null} />
            </InfoItem>
            <InfoItem label="Area served">
              <TextValue value={contractor.area_served} />
            </InfoItem>
          </dl>

          {services ? (
            <p className="mt-5 whitespace-pre-wrap text-sm text-ink">{services}</p>
          ) : null}

          <div className="mt-6 flex flex-col gap-2 border-t border-line pt-5">
            <button type="button" onClick={() => setEditing(true)} className={`${secondaryButtonClass} w-full md:w-auto`}>
              Edit contractor
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setConfirmingDelete(true);
              }}
              disabled={deleting}
              className="btn inline-flex w-full items-center justify-center rounded-lg border border-danger/30 px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
            >
              Delete contractor
            </button>
          </div>
        </section>

        <div className="min-w-0 space-y-6">
          <LogJobForm
            key={contractor.id}
            onSave={async (fields) => {
              await addJob(createClient(), contractor.id, fields);
              await queryClient.invalidateQueries({ queryKey: queryKeys.contractorJobs(contractor.id) });
            }}
          />

          <section className="rounded-2xl border border-line/60 bg-white shadow-card p-5">
            <h2 className="text-base font-semibold text-navy">Job history</h2>
            {orderedJobs.length > 0 ? (
              <p className="mt-2 text-sm text-muted">
                Total spent: <span className="font-medium tabular-nums text-ink">{formatRand(spent)}</span> across{" "}
                {orderedJobs.length} {orderedJobs.length === 1 ? "job" : "jobs"}
              </p>
            ) : null}
            {orderedJobs.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No jobs logged yet for this contractor.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {orderedJobs.map((job) => {
                  const cost = jobCost(job);
                  const property = job.property_or_context?.trim() ?? "";
                  const reason = job.reason?.trim() ?? "";
                  return (
                    <li key={job.id} className="rounded-2xl border border-line/60 bg-page px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-ink">{formatDate(job.job_date) || job.job_date}</p>
                        {job.business ? <BusinessPill id={job.business} /> : null}
                      </div>
                      {property ? <p className="mt-1 text-sm text-muted">{property}</p> : null}
                      <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{job.work_done}</p>
                      {reason ? (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-ink">
                          <span className="text-xs font-medium uppercase tracking-wide text-muted">Reason: </span>
                          {reason}
                        </p>
                      ) : null}
                      {cost != null ? (
                        <p className="mt-2 text-sm font-medium tabular-nums text-ink">{formatRand(cost)}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      <ContractorFormDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSaved={() => {
          void reload();
        }}
        trades={trades.length > 0 ? trades : contractor.trade.trim() ? [contractor.trade.trim()] : []}
        contractor={contractor}
      />

      <dialog
        ref={deleteDialogRef}
        aria-labelledby="delete-contractor-title"
        onCancel={(event) => {
          event.preventDefault();
          if (!deleting) setConfirmingDelete(false);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget && !deleting) setConfirmingDelete(false);
        }}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] max-w-full rounded-2xl border border-line/60 bg-white p-5 text-ink shadow-xl backdrop:bg-navy/40 md:p-6"
      >
        <h2 id="delete-contractor-title" className="text-lg font-semibold text-navy">
          Delete {contractor.name}?
        </h2>
        <p className="mt-3 text-sm text-ink">
          This also removes their full job history. This cannot be undone.
        </p>
        {deleteError ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {deleteError}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-2 md:flex-row md:justify-end">
          <button
            type="button"
            onClick={() => {
              setDeleteError(null);
              setConfirmingDelete(false);
            }}
            disabled={deleting}
            className={`${secondaryButtonClass} w-full md:w-auto`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void handleDelete();
            }}
            disabled={deleting}
            className="btn inline-flex w-full items-center justify-center rounded-lg bg-danger px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
          >
            {deleting ? "Deleting…" : "Delete contractor"}
          </button>
        </div>
      </dialog>
    </>
  );
}
