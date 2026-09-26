import type { QueryClient } from "@tanstack/react-query";

import { listContractors, listJobs } from "@/lib/contractors";
import {
  listAllPropertyContactRoles,
  listProperties,
  listPropertyContacts,
} from "@/lib/properties";
import { queryKeys } from "@/lib/queryKeys";
import { createClient } from "@/lib/supabase/client";
import type { Contact, Contractor, HistoryEntry, Profile, Property, Task } from "@/lib/types";

function raise(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function fetchContacts() {
  const supabase = createClient();
  const { data, error } = await supabase.from("crm_contacts").select("*");
  raise(error);
  return (data ?? []) as Contact[];
}

export async function fetchTasks() {
  const supabase = createClient();
  const { data, error } = await supabase.from("crm_tasks").select("*");
  raise(error);
  return (data ?? []) as Task[];
}

export async function fetchHistory() {
  const supabase = createClient();
  const { data, error } = await supabase.from("crm_history").select("*");
  raise(error);
  return (data ?? []) as HistoryEntry[];
}

export async function fetchProfiles() {
  const supabase = createClient();
  const { data, error } = await supabase.from("crm_profiles").select("*");
  raise(error);
  return (data ?? []) as Profile[];
}

export async function fetchContact(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("crm_contacts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  raise(error);
  if (!data) {
    const missing = new Error("This contact could not be found.");
    missing.name = "NotFound";
    throw missing;
  }
  return data as Contact;
}

export async function fetchContactHistory(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("crm_history")
    .select("*")
    .eq("contact_id", id);
  raise(error);
  return (data ?? []) as HistoryEntry[];
}

export async function fetchContactTasks(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase.from("crm_tasks").select("*").eq("contact_id", id);
  raise(error);
  return (data ?? []) as Task[];
}

export async function fetchContractors() {
  return listContractors(createClient());
}

export async function fetchContractor(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("crm_contractors")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  raise(error);
  if (!data) {
    const missing = new Error("This contractor could not be found.");
    missing.name = "NotFound";
    throw missing;
  }
  return data as Contractor;
}

export async function fetchContractorJobs(id: string) {
  return listJobs(createClient(), id);
}

export function invalidateCrm(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.contacts }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks }),
    queryClient.invalidateQueries({ queryKey: queryKeys.history }),
  ]);
}

export function invalidateContractors(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.contractors }),
    queryClient.invalidateQueries({ queryKey: ["contractor-jobs"] }),
  ]);
}

export async function fetchProperties() {
  return listProperties(createClient());
}

export async function fetchProperty(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("crm_properties")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  raise(error);
  if (!data) {
    const missing = new Error("This property could not be found.");
    missing.name = "NotFound";
    throw missing;
  }
  return data as Property;
}

export async function fetchPropertyContacts(id: string) {
  return listPropertyContacts(createClient(), id);
}

export async function fetchPropertyContactRoles() {
  return listAllPropertyContactRoles(createClient());
}

export function invalidateProperties(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.properties }),
    queryClient.invalidateQueries({ queryKey: ["property-contacts"] }),
    queryClient.invalidateQueries({ queryKey: queryKeys.propertyContactRoles }),
  ]);
}
