"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { BusinessPill, useBusinessDisplay, useReportBusinessScope } from "@/components/BusinessSettingsProvider";
import { PropertyFormDialog } from "@/components/PropertyFormDialog";
import { BUSINESSES } from "@/lib/constants";
import type { PropertyListContact, PropertyListItem } from "@/lib/properties";
import { queryKeys } from "@/lib/queryKeys";
import { fetchProperties, invalidateProperties } from "@/lib/queries";
import type { Business } from "@/lib/types";

const primaryButtonClass =
  "btn btn-primary inline-flex items-center justify-center rounded-full bg-navy px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-ink";

const pillClass = "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold";

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Something went wrong. Try again.";
}

function notesPreview(value: string | null) {
  const text = value?.trim() ?? "";
  if (!text) return "";
  if (text.length <= 100) return text;
  return `${text.slice(0, 100).trimEnd()}…`;
}

function BusinessFilterButton({
  id,
  active,
  onClick,
}: {
  id: Business;
  active: boolean;
  onClick: () => void;
}) {
  const { name } = useBusinessDisplay(id);
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        active
          ? "inline-flex rounded-full bg-navy px-2.5 py-1 text-xs font-semibold text-white"
          : `${pillClass} bg-page text-ink`
      }
    >
      {name}
    </button>
  );
}

function contactLabel(contact: PropertyListContact) {
  const name = contact.contact_name?.trim() ?? "";
  const company = contact.company?.trim() ?? "";
  return [name, company].filter(Boolean).join(" · ");
}

function groupRoles(contacts: PropertyListContact[]) {
  const groups = new Map<string, PropertyListContact[]>();
  for (const contact of contacts) {
    const role = contact.role.trim() || "Role";
    const list = groups.get(role) ?? [];
    list.push(contact);
    groups.set(role, list);
  }

  return [...groups.keys()]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
    .map((role) => ({
      role,
      contacts: (groups.get(role) ?? []).slice().sort((a, b) => {
        const aName = a.contact_name?.trim() ?? "";
        const bName = b.contact_name?.trim() ?? "";
        return aName.localeCompare(bName, undefined, { sensitivity: "base" });
      }),
    }));
}

function RoleDropdown({ contacts }: { contacts: PropertyListContact[] }) {
  const groups = groupRoles(contacts);
  if (groups.length === 0) return null;

  return (
    <div className="mt-2 space-y-0.5">
      {groups.map((group) => (
        <details key={group.role} className="group">
          <summary className="flex min-h-8 cursor-pointer list-none items-center gap-1.5 rounded-md text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
            <ChevronDown
              aria-hidden="true"
              size={14}
              strokeWidth={2}
              className="-rotate-90 shrink-0 text-muted transition-transform group-open:rotate-0"
            />
            <span className="min-w-0 truncate">{group.role}</span>
          </summary>
          <ul className="space-y-0.5 pb-1 pl-5">
            {group.contacts.map((contact) => (
              <li key={contact.id} className="text-sm text-muted">
                {contactLabel(contact) || "No contact details"}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

function PropertyCard({ property }: { property: PropertyListItem }) {
  const address = property.address?.trim() ?? "";
  const notes = notesPreview(property.notes);

  return (
    <li className="rounded-2xl border border-line/60 bg-white p-4 shadow-card transition-colors hover:border-navy/30">
      <Link
        href={`/properties/${property.id}`}
        className="block min-w-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-navy">{property.name}</span>
          {property.business ? <BusinessPill id={property.business} /> : null}
        </span>
      </Link>
      <RoleDropdown contacts={property.contacts} />
      <p className="mt-1 text-sm text-muted">{address || "No address"}</p>
      {notes ? <p className="mt-2 text-sm text-ink">{notes}</p> : null}
    </li>
  );
}

export function Properties() {
  const queryClient = useQueryClient();
  const propertiesQuery = useQuery({
    queryKey: queryKeys.properties,
    queryFn: fetchProperties,
  });
  const [businessFilter, setBusinessFilter] = useState<Business | null>(null);
  useReportBusinessScope(businessFilter);
  const [adding, setAdding] = useState(false);

  const properties = propertiesQuery.data ?? [];
  const loading = propertiesQuery.isPending;
  const error = propertiesQuery.error ? errorMessage(propertiesQuery.error) : null;

  const visible = properties.filter((property) => {
    if (businessFilter && property.business !== businessFilter) return false;
    return true;
  });

  const emptyMessage =
    properties.length === 0
      ? "No properties yet."
      : "No properties for this business.";

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-blue">Trio CRM</p>
          <h1 className="mt-2 text-3xl font-semibold text-navy">Properties</h1>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className={`${primaryButtonClass} w-full sm:w-auto`}
        >
          Add property
        </button>
      </div>

      {!error && !loading ? (
        <div role="group" aria-label="Filter by business" className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={businessFilter == null}
            onClick={() => setBusinessFilter(null)}
            className={
              businessFilter == null
                ? "inline-flex rounded-full bg-navy px-2.5 py-1 text-xs font-semibold text-white"
                : `${pillClass} bg-page text-ink`
            }
          >
            All businesses
          </button>
          {BUSINESSES.map((item) => (
            <BusinessFilterButton
              key={item.id}
              id={item.id}
              active={businessFilter === item.id}
              onClick={() => setBusinessFilter(businessFilter === item.id ? null : item.id)}
            />
          ))}
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
              void propertiesQuery.refetch();
            }}
            className="btn mt-4 inline-flex items-center justify-center rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-page"
          >
            Try again
          </button>
        </section>
      ) : loading ? (
        <p className="mt-8 text-sm text-muted">Loading properties…</p>
      ) : visible.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-line/60 bg-white shadow-card px-6 py-16 text-center">
          <p className="text-sm text-muted">{emptyMessage}</p>
          <button type="button" onClick={() => setAdding(true)} className={`mt-4 ${primaryButtonClass}`}>
            Add property
          </button>
        </section>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </ul>
      )}

      <PropertyFormDialog
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={() => {
          void invalidateProperties(queryClient);
        }}
      />
    </>
  );
}
