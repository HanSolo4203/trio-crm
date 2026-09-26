import type { SupabaseClient } from "@supabase/supabase-js";

import type { Business, Property, PropertyContact } from "./types";

export type PropertyDraft = {
  name: string;
  business?: Business | null;
  address?: string | null;
  notes?: string | null;
};

export type PropertyContactDraft = {
  role: string;
  contact_name?: string | null;
  company?: string | null;
  phone?: string | null;
  alt_phone?: string | null;
  email?: string | null;
  description?: string | null;
};

const NULLABLE_PROPERTY_FIELDS = new Set<keyof PropertyDraft>(["business", "address", "notes"]);

const NULLABLE_CONTACT_FIELDS = new Set<keyof PropertyContactDraft>([
  "contact_name",
  "company",
  "phone",
  "alt_phone",
  "email",
  "description",
]);

function raise(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function textPayload<T extends string>(
  fields: Partial<Record<T, string | null | undefined>>,
  nullable: Set<T>,
) {
  const payload: Record<string, string | null> = {};

  (Object.keys(fields) as T[]).forEach((key) => {
    const value = fields[key];

    if (typeof value !== "string") {
      if (value === null) payload[key] = null;
      return;
    }

    if (nullable.has(key) && !value.trim()) {
      payload[key] = null;
      return;
    }

    payload[key] = value.trim();
  });

  return payload;
}

function propertyPayload(fields: Partial<PropertyDraft>) {
  return textPayload(fields, NULLABLE_PROPERTY_FIELDS);
}

function contactPayload(fields: Partial<PropertyContactDraft>) {
  return textPayload(fields, NULLABLE_CONTACT_FIELDS);
}

export type PropertyListContact = Pick<
  PropertyContact,
  "id" | "role" | "contact_name" | "company"
>;

export type PropertyListItem = Property & {
  contacts: PropertyListContact[];
};

type PropertyListRow = Property & {
  crm_property_contacts: PropertyListContact[] | null;
};

export async function listProperties(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("crm_properties")
    .select("*, crm_property_contacts(id, role, contact_name, company)")
    .order("name", { ascending: true });
  raise(error);
  return ((data ?? []) as PropertyListRow[]).map((row) => {
    const { crm_property_contacts, ...property } = row;
    return {
      ...property,
      contacts: crm_property_contacts ?? [],
    };
  });
}

export async function createProperty(supabase: SupabaseClient, fields: PropertyDraft) {
  const { data, error } = await supabase
    .from("crm_properties")
    .insert(propertyPayload(fields))
    .select("*")
    .single();
  raise(error);
  return data as Property;
}

export async function updateProperty(
  supabase: SupabaseClient,
  id: string,
  fields: Partial<PropertyDraft>,
) {
  const { data, error } = await supabase
    .from("crm_properties")
    .update(propertyPayload(fields))
    .eq("id", id)
    .select("*")
    .single();
  raise(error);
  return data as Property;
}

export async function deleteProperty(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("crm_properties").delete().eq("id", id);
  raise(error);
}

export async function listPropertyContacts(supabase: SupabaseClient, propertyId: string) {
  const { data, error } = await supabase
    .from("crm_property_contacts")
    .select("*")
    .eq("property_id", propertyId)
    .order("role", { ascending: true })
    .order("contact_name", { ascending: true });
  raise(error);
  return (data ?? []) as PropertyContact[];
}

export async function listAllPropertyContactRoles(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("crm_property_contacts").select("role");
  raise(error);
  return (data ?? []).map((row) => row.role as string);
}

export async function addPropertyContact(
  supabase: SupabaseClient,
  propertyId: string,
  fields: PropertyContactDraft,
) {
  const { data, error } = await supabase
    .from("crm_property_contacts")
    .insert({ ...contactPayload(fields), property_id: propertyId })
    .select("*")
    .single();
  raise(error);
  return data as PropertyContact;
}

export async function updatePropertyContact(
  supabase: SupabaseClient,
  id: string,
  fields: Partial<PropertyContactDraft>,
) {
  const { data, error } = await supabase
    .from("crm_property_contacts")
    .update(contactPayload(fields))
    .eq("id", id)
    .select("*")
    .single();
  raise(error);
  return data as PropertyContact;
}

export async function deletePropertyContact(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("crm_property_contacts").delete().eq("id", id);
  raise(error);
}
