"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ContractorFormDialog } from "@/components/ContractorFormDialog";
import { queryKeys } from "@/lib/queryKeys";
import { fetchContractors, invalidateContractors } from "@/lib/queries";
import type { Contractor } from "@/lib/types";

type StatusFilter = "active" | "all";

const primaryButtonClass =
  "btn btn-primary inline-flex items-center justify-center rounded-full bg-navy px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-ink";

const pillClass = "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold";

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Something went wrong. Try again.";
}

function distinctTrades(contractors: Contractor[]) {
  const seen = new Set<string>();
  contractors.forEach((contractor) => {
    const trade = contractor.trade.trim();
    if (trade) seen.add(trade);
  });
  return [...seen].sort((a, b) => a.localeCompare(b));
}

function subline(contractor: Contractor) {
  return [contractor.company?.trim(), contractor.area_served?.trim()].filter(Boolean).join(" · ");
}

function servicesPreview(value: string | null) {
  const text = value?.trim() ?? "";
  if (!text) return "";
  if (text.length <= 100) return text;
  return `${text.slice(0, 100).trimEnd()}…`;
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
          size={14}
          strokeWidth={1.75}
          className={value <= filled ? "fill-amber-400 text-amber-400" : "text-line"}
        />
      ))}
    </span>
  );
}

function ContractorCard({ contractor }: { contractor: Contractor }) {
  const place = subline(contractor);
  const services = servicesPreview(contractor.services_description);
  const phone = contractor.phone?.trim() ?? "";

  return (
    <li className="rounded-2xl border border-line/60 bg-white p-4 shadow-card transition-colors hover:border-navy/30">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/contractors/${contractor.id}`}
          className="min-w-0 flex-1 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
        >
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-navy">{contractor.name}</span>
            <span className={`${pillClass} bg-page text-ink`}>{contractor.trade}</span>
            {contractor.status === "inactive" ? (
              <span className={`${pillClass} bg-line text-muted`}>Inactive</span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-sm text-muted">{place || "No company or area"}</span>
        </Link>
        <StarRating rating={contractor.rating} />
      </div>
      {phone ? (
        <a
          href={`tel:${phone}`}
          className="mt-3 inline-flex text-sm font-medium text-blue underline-offset-2 hover:underline"
        >
          {phone}
        </a>
      ) : null}
      {services ? <p className="mt-2 text-sm text-ink">{services}</p> : null}
    </li>
  );
}

export function Contractors() {
  const queryClient = useQueryClient();
  const contractorsQuery = useQuery({
    queryKey: queryKeys.contractors,
    queryFn: fetchContractors,
  });
  const [tradeFilter, setTradeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [adding, setAdding] = useState(false);

  const contractors = contractorsQuery.data ?? [];
  const loading = contractorsQuery.isPending;
  const error = contractorsQuery.error ? errorMessage(contractorsQuery.error) : null;

  const trades = distinctTrades(contractors);
  const visible = contractors.filter((contractor) => {
    if (statusFilter === "active" && contractor.status !== "active") return false;
    if (tradeFilter && contractor.trade.trim() !== tradeFilter) return false;
    return true;
  });

  const emptyMessage =
    contractors.length === 0
      ? "No contractors yet."
      : tradeFilter
        ? "No contractors for this trade."
        : "No active contractors.";

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-blue">Trio CRM</p>
          <h1 className="mt-2 text-3xl font-semibold text-navy">Contractors</h1>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center md:w-auto">
          <div role="group" aria-label="Status" className="inline-flex rounded-lg border border-line bg-white p-1">
            {(
              [
                ["active", "Active"],
                ["all", "All"],
              ] as const
            ).map(([value, label]) => {
              const active = statusFilter === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatusFilter(value)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    active ? "bg-navy text-white" : "text-ink hover:bg-page"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => setAdding(true)} className={`${primaryButtonClass} w-full sm:w-auto`}>
            Add contractor
          </button>
        </div>
      </div>

      {!error && !loading && trades.length > 0 ? (
        <div role="group" aria-label="Filter by trade" className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={tradeFilter == null}
            onClick={() => setTradeFilter(null)}
            className={
              tradeFilter == null
                ? "inline-flex rounded-full bg-navy px-2.5 py-1 text-xs font-semibold text-white"
                : `${pillClass} bg-page text-ink`
            }
          >
            All trades
          </button>
          {trades.map((trade) => {
            const active = tradeFilter === trade;
            return (
              <button
                key={trade}
                type="button"
                aria-pressed={active}
                onClick={() => setTradeFilter(active ? null : trade)}
                className={
                  active
                    ? "inline-flex rounded-full bg-navy px-2.5 py-1 text-xs font-semibold text-white"
                    : `${pillClass} bg-page text-ink`
                }
              >
                {trade}
              </button>
            );
          })}
        </div>
      ) : null}

      {error ? (
        <section className="mt-8 rounded-2xl border border-line/60 bg-white shadow-card p-6">
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
          <button
            type="button"
            onClick={() => {
              void contractorsQuery.refetch();
            }}
            className="btn mt-4 inline-flex items-center justify-center rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-page"
          >
            Try again
          </button>
        </section>
      ) : loading ? (
        <p className="mt-8 text-sm text-muted">Loading contractors…</p>
      ) : visible.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-line/60 bg-white shadow-card px-6 py-16 text-center">
          <p className="text-sm text-muted">{emptyMessage}</p>
          <button type="button" onClick={() => setAdding(true)} className={`mt-4 ${primaryButtonClass}`}>
            Add contractor
          </button>
        </section>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((contractor) => (
            <ContractorCard key={contractor.id} contractor={contractor} />
          ))}
        </ul>
      )}

      <ContractorFormDialog
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={() => {
          void invalidateContractors(queryClient);
        }}
        trades={trades}
      />
    </>
  );
}
