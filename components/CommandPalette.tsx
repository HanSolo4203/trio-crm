"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { business } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import type { Contact } from "@/lib/types";

type SearchContact = Pick<
  Contact,
  "id" | "name" | "company" | "phone" | "email" | "location" | "business" | "tags"
>;

const RESULT_LIMIT = 8;

function placeLine(contact: SearchContact) {
  return [contact.company?.trim(), contact.location?.trim()].filter(Boolean).join(" · ");
}

function matchesQuery(contact: SearchContact, needle: string) {
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
  const [contacts, setContacts] = useState<SearchContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);

  const trimmed = query.trim();
  const needle = trimmed.toLowerCase();
  const matches =
    needle === ""
      ? []
      : contacts
          .filter((contact) => matchesQuery(contact, needle))
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(0, RESULT_LIMIT);
  const activeIndex = matches.length === 0 ? 0 : Math.min(selected, matches.length - 1);
  const activeId = matches[activeIndex] ? `${listId}-option-${matches[activeIndex].id}` : undefined;

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

    let cancelled = false;
    setQuery("");
    setSelected(0);
    setContacts([]);
    setError(null);
    setLoading(true);
    inputRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    async function load() {
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from("crm_contacts")
        .select("id, name, company, phone, email, location, business, tags");

      if (cancelled) return;
      if (queryError) {
        setError(queryError.message);
        setContacts([]);
      } else {
        setContacts((data ?? []) as SearchContact[]);
      }
      setLoading(false);
    }

    load().catch((caught) => {
      if (cancelled) return;
      setError(caught instanceof Error ? caught.message : "Could not load contacts.");
      setLoading(false);
    });

    return () => {
      cancelled = true;
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
        if (matches.length === 0) return;
        setSelected((current) => Math.min(current + 1, matches.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelected((current) => Math.max(current - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        const contact = matches[activeIndex];
        if (!contact) return;
        event.preventDefault();
        onOpenChange(false);
        router.push(`/contacts/${contact.id}`);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, matches, activeIndex, onOpenChange, router]);

  useEffect(() => {
    if (!open || !activeId) return;
    document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [open, activeId]);

  function openContact(id: string) {
    onOpenChange(false);
    router.push(`/contacts/${id}`);
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
        aria-label="Search contacts"
        onMouseDown={(event) => event.stopPropagation()}
        className="flex max-h-[min(32rem,calc(100dvh-6rem))] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-line bg-white text-ink shadow-[0_20px_25px_-5px_rgb(0_0_0/0.1),0_8px_10px_-6px_rgb(0_0_0/0.1)]"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search aria-hidden="true" className="shrink-0 text-muted" size={18} strokeWidth={1.75} />
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
            placeholder="Search contacts"
            className="w-full bg-transparent py-3.5 text-ink outline-none placeholder:text-muted/70"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {trimmed === "" ? (
            <p className="px-4 py-6 text-sm text-muted">Start typing to search</p>
          ) : loading ? (
            <p className="px-4 py-6 text-sm text-muted">Searching…</p>
          ) : error ? (
            <p className="px-4 py-6 text-sm text-danger">{error}</p>
          ) : matches.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No contacts match &ldquo;{trimmed}&rdquo;</p>
          ) : (
            <ul id={listId} role="listbox" aria-label="Matching contacts" className="py-2">
              {matches.map((contact, index) => {
                const brand = business(contact.business);
                const place = placeLine(contact);
                const highlighted = index === activeIndex;
                return (
                  <li key={contact.id} role="presentation">
                    <button
                      id={`${listId}-option-${contact.id}`}
                      type="button"
                      role="option"
                      aria-selected={highlighted}
                      onMouseEnter={() => setSelected(index)}
                      onClick={() => openContact(contact.id)}
                      className={`block w-full px-4 py-3 text-left ${highlighted ? "bg-page" : "hover:bg-page"}`}
                    >
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <p className="truncate font-semibold text-navy">{contact.name}</p>
                        <span className="inline-flex shrink-0 items-center gap-2 text-sm text-ink">
                          <span
                            aria-hidden="true"
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: brand.color }}
                          />
                          {brand.name}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted">
                        {place || "No company or location"}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
