"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

import { ContactFormDialog } from "@/components/ContactFormDialog";
import {
  BUSINESSES,
  business,
  formatDate,
  heat,
  localDate,
  stage,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { Business, Contact } from "@/lib/types";

type BusinessFilter = "all" | Business;

const controlClass =
  "input mt-1.5 block w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-mint/40 focus:border-navy focus:ring-2 md:min-w-52";

const primaryButtonClass =
  "btn inline-flex items-center justify-center rounded-lg bg-navy px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-ink";

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

function ContactRow({ contact }: { contact: Contact }) {
  const brand = business(contact.business);
  const heatStyle = heat(contact.heat);
  const stageStyle = stage(contact.stage);
  const place = placeLine(contact);
  const nextAction = contact.next_action?.trim() ?? "";
  const overdue = Boolean(contact.follow_up && contact.follow_up < localDate());

  return (
    <li>
      <Link
        href={`/contacts/${contact.id}`}
        className="block rounded-xl border border-line bg-white p-4 transition-colors hover:border-navy/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-center md:gap-6 md:rounded-none md:border-0 md:bg-transparent md:px-4 md:py-4 md:hover:border-transparent md:hover:bg-page"
      >
        <div className="md:hidden">
          <p className="font-semibold text-navy">{contact.name}</p>
          <p className="mt-0.5 text-sm text-muted">{place || "No company or location"}</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="inline-flex min-w-0 items-center gap-2 text-sm text-ink">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: brand.color }}
              />
              <span className="truncate">{brand.name}</span>
            </span>
            <span
              className="inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ backgroundColor: heatStyle.bg, color: heatStyle.ink }}
            >
              {heatStyle.name}
            </span>
          </div>
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
          <span
            className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: brand.color }}
          >
            {brand.name}
          </span>
          <span
            className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ backgroundColor: heatStyle.bg, color: heatStyle.ink }}
          >
            {heatStyle.name}
          </span>
          <span
            className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ backgroundColor: stageStyle.bg, color: stageStyle.ink }}
          >
            {stageStyle.name}
          </span>
        </div>
      </Link>
    </li>
  );
}

export function Contacts() {
  const filterId = useId();
  const [businessFilter, setBusinessFilter] = useState<BusinessFilter>("all");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const { data, error: queryError } = await supabase.from("crm_contacts").select("*");

      if (cancelled) return;
      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      setContacts((data ?? []) as Contact[]);
      setLoading(false);
    }

    load().catch((caught) => {
      if (cancelled) return;
      setError(errorMessage(caught));
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [loadKey]);

  const visible = contacts
    .filter((contact) => businessFilter === "all" || contact.business === businessFilter)
    .sort(compareContacts);

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
              {BUSINESSES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <button type="button" onClick={() => setAdding(true)} className={`${primaryButtonClass} w-full md:w-auto`}>
            Add contact
          </button>
        </div>
      </div>

      {error ? (
        <section className="mt-8 rounded-2xl border border-line bg-white p-6">
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
          <button
            type="button"
            onClick={() => setLoadKey((value) => value + 1)}
            className="btn mt-4 inline-flex items-center justify-center rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-page"
          >
            Try again
          </button>
        </section>
      ) : loading ? (
        <p className="mt-8 text-sm text-muted">Loading contacts…</p>
      ) : visible.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-line bg-white px-6 py-16 text-center">
          <p className="text-sm text-muted">
            {contacts.length === 0 ? "No contacts yet." : "No contacts for this business."}
          </p>
          <button type="button" onClick={() => setAdding(true)} className={`mt-4 ${primaryButtonClass}`}>
            Add contact
          </button>
        </section>
      ) : (
        <ul className="mt-8 flex flex-col gap-3 md:block md:divide-y md:divide-line md:gap-0 md:overflow-hidden md:rounded-2xl md:border md:border-line md:bg-white">
          {visible.map((contact) => (
            <ContactRow key={contact.id} contact={contact} />
          ))}
        </ul>
      )}

      <ContactFormDialog
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={() => setLoadKey((value) => value + 1)}
        editingContact={null}
        defaultBusiness={defaultBusiness}
      />
    </>
  );
}
