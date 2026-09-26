"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { BusinessMark, useBusinessDisplay } from "@/components/BusinessSettingsProvider";
import { queryKeys } from "@/lib/queryKeys";
import { fetchContacts, fetchContractors, fetchProperties } from "@/lib/queries";
import type { Business, Contact, Contractor, Property } from "@/lib/types";

type SearchContact = Pick<
  Contact,
  "id" | "name" | "company" | "phone" | "email" | "location" | "business" | "tags"
>;

type SearchContractor = Pick<Contractor, "id" | "name" | "trade" | "company" | "phone">;

type SearchProperty = Pick<Property, "id" | "name" | "address" | "business">;

type SearchResult =
  | { kind: "contact"; item: SearchContact }
  | { kind: "contractor"; item: SearchContractor }
  | { kind: "property"; item: SearchProperty };

const RESULT_LIMIT = 8;

function placeLine(contact: SearchContact) {
  return [contact.company?.trim(), contact.location?.trim()].filter(Boolean).join(" · ");
}

function SearchBusiness({ id }: { id: Business }) {
  const brand = useBusinessDisplay(id);
  return (
    <span className="inline-flex shrink-0 items-center gap-2 text-sm text-ink">
      <BusinessMark id={id} />
      {brand.name}
    </span>
  );
}

function matchesContact(contact: SearchContact, needle: string) {
  const fields = [
    contact.name,
    contact.company,
    contact.phone,
    contact.email,
    contact.location,
    ...(contact.tags ?? []),
  ];
  return fields.some((field) => field?.toLowerCase().includes(needle));
}

function matchesContractor(contractor: SearchContractor, needle: string) {
  const fields = [contractor.name, contractor.trade, contractor.company, contractor.phone];
  return fields.some((field) => field?.toLowerCase().includes(needle));
}

function contractorLine(contractor: SearchContractor) {
  return [contractor.company?.trim(), contractor.phone?.trim()].filter(Boolean).join(" · ");
}

function matchesProperty(property: SearchProperty, needle: string) {
  const fields = [property.name, property.address];
  return fields.some((field) => field?.toLowerCase().includes(needle));
}

function resultHref(result: SearchResult) {
  if (result.kind === "contact") return `/contacts/${result.item.id}`;
  if (result.kind === "contractor") return `/contractors/${result.item.id}`;
  return `/properties/${result.item.id}`;
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const pathnameRef = useRef(pathname);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const contactsQuery = useQuery({
    queryKey: queryKeys.contacts,
    queryFn: fetchContacts,
    enabled: open,
  });
  const contractorsQuery = useQuery({
    queryKey: queryKeys.contractors,
    queryFn: fetchContractors,
    enabled: open,
  });
  const propertiesQuery = useQuery({
    queryKey: queryKeys.properties,
    queryFn: fetchProperties,
    enabled: open,
  });
  const contacts = contactsQuery.data ?? [];
  const contractors = contractorsQuery.data ?? [];
  const properties = propertiesQuery.data ?? [];
  const loading =
    contactsQuery.isPending || contractorsQuery.isPending || propertiesQuery.isPending;
  const errorSource = contactsQuery.error ?? contractorsQuery.error ?? propertiesQuery.error;
  const error = errorSource
    ? errorSource instanceof Error
      ? errorSource.message
      : "Could not load search results."
    : null;

  const trimmed = query.trim();
  const needle = trimmed.toLowerCase();
  const contactMatches =
    needle === ""
      ? []
      : contacts
          .filter((contact) => matchesContact(contact, needle))
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, RESULT_LIMIT);
  const contractorMatches =
    needle === ""
      ? []
      : contractors
          .filter((contractor) => matchesContractor(contractor, needle))
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, RESULT_LIMIT);
  const propertyMatches =
    needle === ""
      ? []
      : properties
          .filter((property) => matchesProperty(property, needle))
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, RESULT_LIMIT);
  const results: SearchResult[] = [
    ...contactMatches.map((item) => ({ kind: "contact" as const, item })),
    ...contractorMatches.map((item) => ({ kind: "contractor" as const, item })),
    ...propertyMatches.map((item) => ({ kind: "property" as const, item })),
  ];
  const activeIndex = results.length === 0 ? 0 : Math.min(selected, results.length - 1);
  const active = results[activeIndex];
  const activeId = active ? `${listId}-option-${active.kind}-${active.item.id}` : undefined;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(true);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  useEffect(() => {
    if (pathnameRef.current === pathname) return;
    pathnameRef.current = pathname;
    onOpenChange(false);
  }, [pathname, onOpenChange]);

  useEffect(() => {
    if (!open) return;

    setQuery("");
    setSelected(0);
    inputRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (results.length === 0) return;
        setSelected((current) => Math.min(current + 1, results.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelected((current) => Math.max(current - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        const result = results[activeIndex];
        if (!result) return;
        event.preventDefault();
        onOpenChange(false);
        router.push(resultHref(result));
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, activeIndex, onOpenChange, router]);

  useEffect(() => {
    if (!open || !activeId) return;
    document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [open, activeId]);

  function openResult(result: SearchResult) {
    onOpenChange(false);
    router.push(resultHref(result));
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-navy/40 px-4 pt-[max(4.5rem,12vh)]"
      onMouseDown={() => onOpenChange(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search contacts, contractors, and properties"
        onMouseDown={(event) => event.stopPropagation()}
        className="flex max-h-[min(32rem,calc(100dvh-6rem))] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-line bg-white text-ink shadow-[0_20px_25px_-5px_rgb(0_0_0/0.1),0_8px_10px_-6px_rgb(0_0_0/0.1)]"
      >
        <div className="p-3">
          <div className="flex items-center gap-2.5 rounded-full border border-line/60 bg-page px-2 py-1.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-accentFrom to-accentTo text-white">
              <Search aria-hidden="true" size={16} strokeWidth={1.75} />
            </span>
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={activeId}
              aria-autocomplete="list"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelected(0);
              }}
              placeholder="Search contacts, contractors, and properties"
              className="w-full bg-transparent py-1 text-ink outline-none placeholder:text-muted/70"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {trimmed === "" ? (
            <p className="px-4 py-6 text-sm text-muted">Start typing to search</p>
          ) : loading ? (
            <p className="px-4 py-6 text-sm text-muted">Searching…</p>
          ) : error ? (
            <p className="px-4 py-6 text-sm text-danger">{error}</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No matches for &ldquo;{trimmed}&rdquo;</p>
          ) : (
            <div id={listId} role="listbox" aria-label="Search results" className="py-2">
              {contactMatches.length > 0 ? (
                <ul role="group" aria-label="Contacts">
                  {contactMatches.map((contact, index) => {
                    const place = placeLine(contact);
                    const highlighted = index === activeIndex;
                    return (
                      <li key={contact.id} role="presentation">
                        <button
                          id={`${listId}-option-contact-${contact.id}`}
                          type="button"
                          role="option"
                          aria-selected={highlighted}
                          onMouseEnter={() => setSelected(index)}
                          onClick={() => openResult({ kind: "contact", item: contact })}
                          className={`block w-full px-4 py-3 text-left ${highlighted ? "bg-page" : "hover:bg-page"}`}
                        >
                          <div className="flex min-w-0 items-center justify-between gap-3">
                            <p className="truncate font-semibold text-navy">{contact.name}</p>
                            <SearchBusiness id={contact.business} />
                          </div>
                          <p className="mt-0.5 truncate text-sm text-muted">
                            {place || "No company or location"}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {contractorMatches.length > 0 ? (
                <div
                  role="group"
                  aria-label="Contractors"
                  className={contactMatches.length > 0 ? "mt-1 border-t border-line" : undefined}
                >
                  <p className="px-4 pb-1 pt-3 text-xs font-medium text-muted">Contractors</p>
                  <ul>
                    {contractorMatches.map((contractor, index) => {
                      const resultIndex = contactMatches.length + index;
                      const highlighted = resultIndex === activeIndex;
                      const place = contractorLine(contractor);
                      return (
                        <li key={contractor.id} role="presentation">
                          <button
                            id={`${listId}-option-contractor-${contractor.id}`}
                            type="button"
                            role="option"
                            aria-selected={highlighted}
                            onMouseEnter={() => setSelected(resultIndex)}
                            onClick={() => openResult({ kind: "contractor", item: contractor })}
                            className={`block w-full px-4 py-3 text-left ${highlighted ? "bg-page" : "hover:bg-page"}`}
                          >
                            <div className="flex min-w-0 items-center justify-between gap-3">
                              <p className="truncate font-semibold text-navy">{contractor.name}</p>
                              <span className="shrink-0 text-sm text-ink">{contractor.trade}</span>
                            </div>
                            <p className="mt-0.5 truncate text-sm text-muted">
                              {place || "No company or phone"}
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              {propertyMatches.length > 0 ? (
                <div
                  role="group"
                  aria-label="Properties"
                  className={
                    contactMatches.length > 0 || contractorMatches.length > 0
                      ? "mt-1 border-t border-line"
                      : undefined
                  }
                >
                  <p className="px-4 pb-1 pt-3 text-xs font-medium text-muted">Properties</p>
                  <ul>
                    {propertyMatches.map((property, index) => {
                      const resultIndex = contactMatches.length + contractorMatches.length + index;
                      const highlighted = resultIndex === activeIndex;
                      const address = property.address?.trim() ?? "";
                      return (
                        <li key={property.id} role="presentation">
                          <button
                            id={`${listId}-option-property-${property.id}`}
                            type="button"
                            role="option"
                            aria-selected={highlighted}
                            onMouseEnter={() => setSelected(resultIndex)}
                            onClick={() => openResult({ kind: "property", item: property })}
                            className={`block w-full px-4 py-3 text-left ${highlighted ? "bg-page" : "hover:bg-page"}`}
                          >
                            <div className="flex min-w-0 items-center justify-between gap-3">
                              <p className="truncate font-semibold text-navy">{property.name}</p>
                              {property.business ? <SearchBusiness id={property.business} /> : null}
                            </div>
                            <p className="mt-0.5 truncate text-sm text-muted">
                              {address || "No address"}
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
