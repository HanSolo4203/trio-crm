"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useId, useState } from "react";

import {
  BusinessMark,
  BusinessPill,
  BusinessSelectOptions,
  StatusDot,
  StatusPill,
  TagPill,
  statusPillClass,
  tagPillStyle,
  useBusinessDisplay,
  useTagColors,
} from "@/components/BusinessSettingsProvider";
import { ContactFormDialog } from "@/components/ContactFormDialog";
import { BUSINESSES, formatDate, heat, localDate, stage } from "@/lib/constants";
import { queryKeys } from "@/lib/queryKeys";
import { fetchContacts, invalidateCrm } from "@/lib/queries";
import type { Business, Contact } from "@/lib/types";

type BusinessFilter = "all" | Business;

const controlClass =
  "input mt-1.5 block w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-mint/40 focus:border-navy focus:ring-2 md:min-w-52";

const primaryButtonClass =
  "btn btn-primary inline-flex items-center justify-center rounded-full bg-navy px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-ink";

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

function compareContacts(a: Contact, b: Contact) {
  return a.name.localeCompare(b.name);
}

const tagPillClass = statusPillClass;

function TagPills({ tags, limit }: { tags: string[] | null | undefined; limit?: number }) {
  const list = tags ?? [];
  if (list.length === 0) return null;
  const shown = limit == null ? list : list.slice(0, limit);
  const extra = list.length - shown.length;
  return (
    <>
      {shown.map((tag) => (
        <TagPill key={tag} tag={tag} />
      ))}
      {extra > 0 ? (
        <span className={tagPillClass} style={tagPillStyle(null)}>
          <StatusDot color={tagPillStyle(null).color} />
          +{extra}
        </span>
      ) : null}
    </>
  );
}

function tagsByFrequency(contacts: Contact[]) {
  const counts = new Map<string, number>();
  contacts.forEach((contact) => {
    const seen = new Set<string>();
    (contact.tags ?? []).forEach((tag) => {
      const value = tag.trim();
      if (!value || seen.has(value)) return;
      seen.add(value);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}

function ContactRow({ contact }: { contact: Contact }) {
  const brand = useBusinessDisplay(contact.business);
  const heatStyle = heat(contact.heat);
  const stageStyle = stage(contact.stage);
  const place = placeLine(contact);
  const nextAction = contact.next_action?.trim() ?? "";
  const overdue = Boolean(contact.follow_up && contact.follow_up < localDate());

  return (
    <li>
      <Link
        href={`/contacts/${contact.id}`}
        className="block rounded-2xl border border-line/60 bg-white p-4 shadow-card transition-colors hover:border-navy/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-center md:gap-6 md:rounded-none md:border-0 md:bg-transparent md:px-4 md:py-4 md:shadow-none md:hover:border-transparent md:hover:bg-page"
      >
        <div className="md:hidden">
          <p className="font-semibold text-navy">{contact.name}</p>
          <p className="mt-0.5 text-sm text-muted">{place || "No company or location"}</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="inline-flex min-w-0 items-center gap-2 text-sm text-ink">
              <BusinessMark id={contact.business} />
              <span className="truncate">{brand.name}</span>
            </span>
            <StatusPill
              className="shrink-0"
              label={heatStyle.name}
              bg={heatStyle.bg}
              ink={heatStyle.ink}
            />
          </div>
          {(contact.tags ?? []).length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <TagPills tags={contact.tags} limit={3} />
            </div>
          ) : null}
          <p className={`mt-3 text-sm font-semibold ${overdue ? "text-danger" : "text-muted"}`}>
            {dueLabel(contact.follow_up)}
          </p>
        </div>

        <div className="hidden min-w-0 md:block">
          <p className="truncate font-semibold text-navy">{contact.name}</p>
          <p className="mt-0.5 truncate text-sm text-muted">{place || "No company or location"}</p>
        </div>
        <div className="hidden min-w-0 md:block">
          <p className="truncate text-sm text-ink">{nextAction || "No follow-up"}</p>
          <p className={`mt-0.5 text-xs font-semibold ${overdue ? "text-danger" : "text-muted"}`}>
            {dueLabel(contact.follow_up)}
          </p>
        </div>
        <div className="hidden flex-wrap gap-2 md:flex">
          <BusinessPill id={contact.business} />
          <TagPills tags={contact.tags} limit={3} />
          <StatusPill label={heatStyle.name} bg={heatStyle.bg} ink={heatStyle.ink} />
          <StatusPill label={stageStyle.name} bg={stageStyle.bg} ink={stageStyle.ink} />
        </div>
      </Link>
    </li>
  );
}

export function Contacts() {
  const filterId = useId();
  const queryClient = useQueryClient();
  const tagColors = useTagColors();
  const [businessFilter, setBusinessFilter] = useState<BusinessFilter>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const contactsQuery = useQuery({
    queryKey: queryKeys.contacts,
    queryFn: fetchContacts,
  });

  const contacts = contactsQuery.data ?? [];
  const loading = contactsQuery.isPending;
  const error = contactsQuery.error ? errorMessage(contactsQuery.error) : null;

  const tagChoices = tagsByFrequency(contacts);
  const visible = contacts
    .filter((contact) => businessFilter === "all" || contact.business === businessFilter)
    .filter((contact) => {
      if (selectedTags.length === 0) return true;
      const tags = contact.tags ?? [];
      return selectedTags.some((tag) => tags.includes(tag));
    })
    .sort(compareContacts);

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  }

  const defaultBusiness: Business =
    businessFilter === "all" ? BUSINESSES[0].id : businessFilter;

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-blue">Trio CRM</p>
          <h1 className="mt-2 text-3xl font-semibold text-navy">Contacts</h1>
        </div>
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-end">
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
          <button type="button" onClick={() => setAdding(true)} className={`${primaryButtonClass} w-full md:w-auto`}>
            Add contact
          </button>
        </div>
      </div>

      {!error && !loading && tagChoices.length > 0 ? (
        <div role="group" aria-label="Filter by tag" className="mt-6 flex flex-wrap gap-2">
          {tagChoices.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={active}
                onClick={() => toggleTag(tag)}
                className={
                  active
                    ? `${tagPillClass} bg-navy text-white`
                    : tagPillClass
                }
                style={active ? undefined : tagPillStyle(tagColors[tag])}
              >
                <StatusDot color={active ? "#ffffff" : tagPillStyle(tagColors[tag]).color} />
                {tag}
              </button>
            );
          })}
        </div>
      ) : null}

      {error ? (
        <section className="mt-8 rounded-2xl border border-line/60 bg-white p-6 shadow-card">
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
        <p className="mt-8 text-sm text-muted">Loading contacts…</p>
      ) : visible.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-line/60 bg-white px-6 py-16 text-center shadow-card">
          <p className="text-sm text-muted">
            {contacts.length === 0
              ? "No contacts yet."
              : selectedTags.length > 0
                ? "No contacts with these tags."
                : "No contacts for this business."}
          </p>
          <button type="button" onClick={() => setAdding(true)} className={`mt-4 ${primaryButtonClass}`}>
            Add contact
          </button>
        </section>
      ) : (
        <ul className="mt-8 flex flex-col gap-3 md:block md:divide-y md:divide-line md:gap-0 md:overflow-hidden md:rounded-2xl md:border md:border-line/60 md:bg-white md:shadow-card">
          {visible.map((contact) => (
            <ContactRow key={contact.id} contact={contact} />
          ))}
        </ul>
      )}

      <ContactFormDialog
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={() => {
          void invalidateCrm(queryClient);
        }}
        editingContact={null}
        defaultBusiness={defaultBusiness}
        contacts={loading || error ? undefined : contacts}
      />
    </>
  );
}
