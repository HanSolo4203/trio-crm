"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useId, useRef, useState, type ReactNode } from "react";

import {
  BusinessPill,
  BusinessSelectOptions,
  StatusDot,
  StatusPill,
  TagPill,
  statusPillClass,
  tagPillStyle,
} from "@/components/BusinessSettingsProvider";
import { formatDate, HEATS, isOpenStage, localDate, stage } from "@/lib/constants";
import { queryKeys } from "@/lib/queryKeys";
import { fetchContacts } from "@/lib/queries";
import type { Business, Contact } from "@/lib/types";

type BusinessFilter = "all" | Business;

const controlClass =
  "input mt-1.5 block w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-mint/40 focus:border-navy focus:ring-2 md:min-w-52";

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

function placeLine(contact: Contact) {
  return [contact.company?.trim(), contact.location?.trim()].filter(Boolean).join(" · ");
}

function compareLeads(a: Contact, b: Contact) {
  const aDate = a.follow_up?.trim() ?? "";
  const bDate = b.follow_up?.trim() ?? "";
  if (aDate !== bDate) {
    if (!aDate) return 1;
    if (!bDate) return -1;
    return aDate < bDate ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

function LaneBoard({ children }: { children: ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  function activeIndex() {
    const el = scrollerRef.current;
    if (!el) return 0;
    const viewCenter = el.getBoundingClientRect().left + el.clientWidth / 2;
    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    Array.from(el.children).forEach((lane, index) => {
      if (!(lane instanceof HTMLElement)) return;
      const rect = lane.getBoundingClientRect();
      const dist = Math.abs(rect.left + rect.width / 2 - viewCenter);
      if (dist < bestDist) {
        bestDist = dist;
        best = index;
      }
    });
    return best;
  }

  function scrollToLane(index: number) {
    const el = scrollerRef.current;
    const lane = el?.children[index];
    if (!el || !(lane instanceof HTMLElement)) return;
    const laneRect = lane.getBoundingClientRect();
    const scrollerRect = el.getBoundingClientRect();
    el.scrollTo({
      left:
        el.scrollLeft +
        (laneRect.left - scrollerRect.left) -
        (el.clientWidth - lane.clientWidth) / 2,
      behavior: "smooth",
    });
  }

  return (
    <div className="mt-8 min-w-0">
      <div
        ref={scrollerRef}
        onScroll={() => {
          const next = activeIndex();
          setActive((current) => (current === next ? current : next));
        }}
        className="flex w-full min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-2 md:grid md:snap-none md:grid-cols-2 md:overflow-visible md:pb-0 lg:grid-cols-4"
      >
        {children}
      </div>
      <div className="mt-1 flex justify-center md:hidden" role="group" aria-label="Lead categories">
        {HEATS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            aria-label={item.name}
            aria-current={index === active ? "true" : undefined}
            onClick={() => scrollToLane(index)}
            className="flex h-11 w-11 items-center justify-center"
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${index === active ? "bg-navy" : "bg-navy/25"}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function LeadCard({ contact }: { contact: Contact }) {
  const stageStyle = stage(contact.stage);
  const place = placeLine(contact);
  const overdue = Boolean(contact.follow_up && contact.follow_up < localDate());

  return (
    <Link
      href={`/contacts/${contact.id}`}
      className="block min-h-11 rounded-2xl border border-line/60 bg-white p-3 shadow-card transition-colors hover:border-navy/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
    >
      <p className="font-semibold text-navy">{contact.name}</p>
      {place ? <p className="mt-1 text-sm text-muted">{place}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <BusinessPill id={contact.business} />
        {(contact.tags ?? []).slice(0, 3).map((tag) => (
          <TagPill key={tag} tag={tag} />
        ))}
        {(contact.tags ?? []).length > 3 ? (
          <span className={statusPillClass} style={tagPillStyle(null)}>
            <StatusDot color={tagPillStyle(null).color} />
            +{(contact.tags ?? []).length - 3}
          </span>
        ) : null}
        <StatusPill label={stageStyle.name} bg={stageStyle.bg} ink={stageStyle.ink} />
      </div>
      <p className={`mt-3 text-xs font-semibold ${overdue ? "text-danger" : "text-muted"}`}>
        {dueLabel(contact.follow_up)}
      </p>
    </Link>
  );
}

export function Pipeline() {
  const filterId = useId();
  const [businessFilter, setBusinessFilter] = useState<BusinessFilter>("all");
  const contactsQuery = useQuery({
    queryKey: queryKeys.contacts,
    queryFn: fetchContacts,
  });

  const contacts = contactsQuery.data ?? [];
  const loading = contactsQuery.isPending;
  const error = contactsQuery.error ? errorMessage(contactsQuery.error) : null;

  const openContacts = contacts.filter((contact) => {
    if (!isOpenStage(contact.stage)) return false;
    if (businessFilter !== "all" && contact.business !== businessFilter) return false;
    return true;
  });

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-blue">Trio CRM</p>
          <h1 className="mt-2 text-3xl font-semibold text-navy">Leads</h1>
        </div>
        <div className="w-full md:w-auto">
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
      </div>

      {error ? (
        <section className="mt-8 rounded-2xl border border-line/60 bg-white shadow-card p-6">
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
          <button
            type="button"
            onClick={() => {
              void contactsQuery.refetch();
            }}
            className="btn mt-4 inline-flex items-center justify-center rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-page"
          >
            Try again
          </button>
        </section>
      ) : loading ? (
        <p className="mt-8 text-sm text-muted">Loading leads…</p>
      ) : (
        <LaneBoard>
          {HEATS.map((item) => {
            const leads = openContacts
              .filter((contact) => contact.heat === item.id)
              .sort(compareLeads);

            return (
              <section
                key={item.id}
                className="min-w-[85vw] max-w-[85vw] shrink-0 snap-center rounded-2xl p-3 md:min-w-0 md:max-w-none md:shrink md:snap-align-none"
                style={{ backgroundColor: item.bg }}
              >
                <div className="flex items-center justify-between gap-3 px-1" style={{ color: item.ink }}>
                  <h2 className="text-sm font-semibold">{item.name}</h2>
                  <span className="text-sm font-semibold tabular-nums">{leads.length}</span>
                </div>
                <div className="mt-3 flex flex-col gap-3">
                  {leads.length === 0 ? (
                    <p className="px-1 py-6 text-center text-sm text-muted">
                      No leads in this category.
                    </p>
                  ) : (
                    leads.map((contact) => <LeadCard key={contact.id} contact={contact} />)
                  )}
                </div>
              </section>
            );
          })}
        </LaneBoard>
      )}
    </>
  );
}
