"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { BusinessPill, useReportBusinessScope } from "@/components/BusinessSettingsProvider";
import { PropertyContactFormDialog } from "@/components/PropertyContactFormDialog";
import { PropertyFormDialog } from "@/components/PropertyFormDialog";
import { deleteProperty, deletePropertyContact } from "@/lib/properties";
import { queryKeys } from "@/lib/queryKeys";
import { fetchProperty, fetchPropertyContacts, invalidateProperties } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import type { PropertyContact } from "@/lib/types";

type PropertyDetailProps = {
  propertyId: string;
};

const secondaryButtonClass =
  "btn inline-flex items-center justify-center rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-page disabled:cursor-not-allowed disabled:opacity-60";

const primaryButtonClass =
  "btn btn-primary inline-flex items-center justify-center rounded-full bg-navy px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60";

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Something went wrong. Try again.";
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
  if (!href) return <span className="break-words whitespace-pre-wrap">{text}</span>;
  return (
    <a href={href} className="break-words text-blue underline-offset-2 hover:underline">
      {text}
    </a>
  );
}

function contactTitle(contact: PropertyContact) {
  const name = contact.contact_name?.trim() ?? "";
  if (name) return name;
  const company = contact.company?.trim() ?? "";
  if (company) return company;
  return contact.role.trim() || "Contact";
}

function contactCompanyLine(contact: PropertyContact) {
  const name = contact.contact_name?.trim() ?? "";
  const company = contact.company?.trim() ?? "";
  if (name && company) return company;
  return null;
}

function compareContacts(a: PropertyContact, b: PropertyContact) {
  const aName = a.contact_name?.trim() ?? "";
  const bName = b.contact_name?.trim() ?? "";
  if (!aName && bName) return 1;
  if (aName && !bName) return -1;
  const byName = aName.localeCompare(bName, undefined, { sensitivity: "base" });
  if (byName !== 0) return byName;
  return a.id.localeCompare(b.id);
}

function groupContacts(contacts: PropertyContact[]) {
  const groups = new Map<string, PropertyContact[]>();
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
      contacts: (groups.get(role) ?? []).slice().sort(compareContacts),
    }));
}

function ContactCard({
  contact,
  confirming,
  deleting,
  deleteError,
  onEdit,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  contact: PropertyContact;
  confirming: boolean;
  deleting: boolean;
  deleteError: string | null;
  onEdit: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const title = contactTitle(contact);
  const company = contactCompanyLine(contact);
  const phone = contact.phone?.trim() ?? "";
  const altPhone = contact.alt_phone?.trim() ?? "";
  const email = contact.email?.trim() ?? "";
  const description = contact.description?.trim() ?? "";
  const phoneLink = phone ? phoneHref(phone) : null;
  const altPhoneLink = altPhone ? phoneHref(altPhone) : null;
  const emailLink = email ? emailHref(email) : null;

  return (
    <li className="rounded-2xl border border-line/60 bg-page px-4 py-3">
      {confirming ? (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-ink">Delete this contact?</p>
            <button
              type="button"
              onClick={onCancelDelete}
              disabled={deleting}
              className={`${secondaryButtonClass} px-2.5 py-1.5`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirmDelete}
              disabled={deleting}
              className="btn inline-flex items-center justify-center rounded-lg bg-danger px-2.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
          {deleteError ? (
            <p role="alert" className="mt-2 text-sm text-danger">
              {deleteError}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{title}</p>
            {company ? <p className="mt-0.5 text-sm text-muted">{company}</p> : null}
            {phoneLink || altPhoneLink || emailLink ? (
              <div className="mt-2 space-y-1 text-sm">
                {phoneLink ? (
                  <p>
                    <a href={phoneLink} className="break-words text-blue underline-offset-2 hover:underline">
                      {phone}
                    </a>
                  </p>
                ) : null}
                {altPhoneLink ? (
                  <p>
                    <a href={altPhoneLink} className="break-words text-blue underline-offset-2 hover:underline">
                      {altPhone}
                    </a>
                  </p>
                ) : null}
                {emailLink ? (
                  <p>
                    <a href={emailLink} className="break-words text-blue underline-offset-2 hover:underline">
                      {email}
                    </a>
                  </p>
                ) : null}
              </div>
            ) : null}
            {description ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{description}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              aria-label={`Edit ${title}`}
              onClick={onEdit}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white hover:text-ink"
            >
              <Pencil aria-hidden="true" size={16} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              aria-label={`Delete ${title}`}
              onClick={onAskDelete}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white hover:text-danger"
            >
              <Trash2 aria-hidden="true" size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export function PropertyDetail({ propertyId }: PropertyDetailProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const propertyQuery = useQuery({
    queryKey: queryKeys.property(propertyId),
    queryFn: () => fetchProperty(propertyId),
    retry: (failureCount, error) =>
      !(error instanceof Error && error.name === "NotFound") && failureCount < 3,
  });
  const contactsQuery = useQuery({
    queryKey: queryKeys.propertyContacts(propertyId),
    queryFn: () => fetchPropertyContacts(propertyId),
  });

  const property = propertyQuery.data ?? null;
  useReportBusinessScope(property?.business);
  const contacts = contactsQuery.data ?? [];
  const missing = propertyQuery.error instanceof Error && propertyQuery.error.name === "NotFound";
  const loadError = propertyQuery.error && !missing ? errorMessage(propertyQuery.error) : null;
  const loading = !missing && !loadError && propertyQuery.isPending;

  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);

  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<PropertyContact | null>(null);
  const [confirmingContactId, setConfirmingContactId] = useState<string | null>(null);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
  const [contactDeleteError, setContactDeleteError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    await invalidateProperties(queryClient);
  }, [queryClient]);

  const refreshContacts = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.propertyContacts(propertyId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.propertyContactRoles }),
    ]);
  }, [propertyId, queryClient]);

  useEffect(() => {
    setEditing(false);
    setDeleteError(null);
    setConfirmingDelete(false);
    setContactDialogOpen(false);
    setEditingContact(null);
    setConfirmingContactId(null);
    setDeletingContactId(null);
    setContactDeleteError(null);
  }, [propertyId]);

  useEffect(() => {
    if (!property) return;
    const previous = document.title;
    document.title = `${property.name} · Trio CRM`;
    return () => {
      document.title = previous;
    };
  }, [property]);

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
    if (!property || deleting) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await deleteProperty(createClient(), property.id);
      await invalidateProperties(queryClient);
      router.push("/properties");
    } catch (error) {
      setDeleteError(errorMessage(error));
      setDeleting(false);
    }
  }

  async function handleDeleteContact(contactId: string) {
    if (deletingContactId) return;
    setContactDeleteError(null);
    setDeletingContactId(contactId);
    try {
      await deletePropertyContact(createClient(), contactId);
      await refreshContacts();
      setConfirmingContactId(null);
      setDeletingContactId(null);
    } catch (error) {
      setContactDeleteError(errorMessage(error));
      setDeletingContactId(null);
    }
  }

  if (!property || property.id !== propertyId) {
    if (!loading && missing) {
      return (
        <section className="rounded-2xl border border-line/60 bg-white shadow-card p-6">
          <h1 className="text-xl font-semibold text-navy">Property</h1>
          <p role="alert" className="mt-3 text-sm text-muted">
            This property could not be found.
          </p>
        </section>
      );
    }
    if (!loading && loadError) {
      return (
        <section className="rounded-2xl border border-line/60 bg-white shadow-card p-6">
          <h1 className="text-xl font-semibold text-navy">Property</h1>
          <p role="alert" className="mt-3 text-sm text-danger">
            {loadError}
          </p>
          <button
            type="button"
            onClick={() => {
              void propertyQuery.refetch();
            }}
            className={`btn mt-4 inline-flex items-center justify-center ${secondaryButtonClass}`}
          >
            Try again
          </button>
        </section>
      );
    }
    return <p className="text-sm text-muted">Loading property…</p>;
  }

  const groups = groupContacts(contacts);
  const contactsError = contactsQuery.error ? errorMessage(contactsQuery.error) : null;

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <section className="min-w-0 rounded-2xl border border-line/60 bg-white shadow-card p-5">
          <h1 className="text-2xl font-semibold text-navy">{property.name}</h1>
          {property.business ? (
            <div className="mt-3">
              <BusinessPill id={property.business} />
            </div>
          ) : null}

          <dl className="mt-5 space-y-4">
            <InfoItem label="Address">
              <TextValue value={property.address} />
            </InfoItem>
            <InfoItem label="Notes">
              <TextValue value={property.notes} />
            </InfoItem>
          </dl>

          <div className="mt-6 flex flex-col gap-2 border-t border-line pt-5">
            <button type="button" onClick={() => setEditing(true)} className={`${secondaryButtonClass} w-full md:w-auto`}>
              Edit property
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
              Delete property
            </button>
          </div>
        </section>

        <section className="min-w-0 rounded-2xl border border-line/60 bg-white shadow-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-navy">Points of contact</h2>
            <button
              type="button"
              onClick={() => {
                setEditingContact(null);
                setContactDialogOpen(true);
              }}
              className={primaryButtonClass}
            >
              Add contact
            </button>
          </div>

          {contactsQuery.isPending ? (
            <p className="mt-3 text-sm text-muted">Loading contacts…</p>
          ) : contactsError ? (
            <>
              <p role="alert" className="mt-3 text-sm text-danger">
                {contactsError}
              </p>
              <button
                type="button"
                onClick={() => {
                  void contactsQuery.refetch();
                }}
                className={`btn mt-4 inline-flex items-center justify-center ${secondaryButtonClass}`}
              >
                Try again
              </button>
            </>
          ) : contacts.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No points of contact added yet.</p>
          ) : (
            <div className="mt-6 space-y-6">
              {groups.map((group) => (
                <section key={group.role}>
                  <h3 className="text-sm font-semibold text-navy">{group.role}</h3>
                  <ul className="mt-2 space-y-3">
                    {group.contacts.map((contact) => (
                      <ContactCard
                        key={contact.id}
                        contact={contact}
                        confirming={confirmingContactId === contact.id}
                        deleting={deletingContactId === contact.id}
                        deleteError={confirmingContactId === contact.id ? contactDeleteError : null}
                        onEdit={() => {
                          setConfirmingContactId(null);
                          setContactDeleteError(null);
                          setEditingContact(contact);
                          setContactDialogOpen(true);
                        }}
                        onAskDelete={() => {
                          setContactDeleteError(null);
                          setConfirmingContactId(contact.id);
                        }}
                        onCancelDelete={() => {
                          if (deletingContactId) return;
                          setContactDeleteError(null);
                          setConfirmingContactId(null);
                        }}
                        onConfirmDelete={() => {
                          void handleDeleteContact(contact.id);
                        }}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>

      <PropertyFormDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSaved={() => {
          void reload();
        }}
        property={property}
      />

      <PropertyContactFormDialog
        open={contactDialogOpen}
        onClose={() => setContactDialogOpen(false)}
        onSaved={() => {
          void refreshContacts();
        }}
        propertyId={property.id}
        contact={editingContact}
      />

      <dialog
        ref={deleteDialogRef}
        aria-labelledby="delete-property-title"
        onCancel={(event) => {
          event.preventDefault();
          if (!deleting) setConfirmingDelete(false);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget && !deleting) setConfirmingDelete(false);
        }}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] max-w-full rounded-2xl border border-line/60 bg-white p-5 text-ink shadow-xl backdrop:bg-navy/40 md:p-6"
      >
        <h2 id="delete-property-title" className="text-lg font-semibold text-navy">
          Delete {property.name}?
        </h2>
        <p className="mt-3 text-sm text-ink">
          This also removes every contact listed for this property. This cannot be undone.
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
            {deleting ? "Deleting…" : "Delete property"}
          </button>
        </div>
      </dialog>
    </>
  );
}
