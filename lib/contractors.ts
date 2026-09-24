import type { SupabaseClient } from "@supabase/supabase-js";

import type { Business, Contractor, ContractorJob, ContractorStatus } from "./types";

export type ContractorDraft = {
  name: string;
  trade: string;
  company?: string | null;
  phone?: string | null;
  alt_phone?: string | null;
  email?: string | null;
  area_served?: string | null;
  services_description?: string | null;
  rating?: number | null;
  status?: ContractorStatus;
};

export type ContractorJobDraft = {
  job_date: string;
  business?: Business | null;
  property_or_context?: string | null;
  work_done: string;
  reason?: string | null;
  cost?: number | null;
};

const NULLABLE_CONTRACTOR_FIELDS = new Set<keyof ContractorDraft>([
  "company",
  "phone",
  "alt_phone",
  "email",
  "area_served",
  "services_description",
]);

function raise(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function blankToNull(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function contractorPayload(fields: Partial<ContractorDraft>) {
  const payload: Record<string, string | number | null> = {};

  (Object.keys(fields) as (keyof ContractorDraft)[]).forEach((key) => {
    const value = fields[key];

    if (key === "rating") {
      if (value === "" || value === undefined) return;
      payload[key] = value === null ? null : Number(value);
      return;
    }

    if (typeof value !== "string") {
      if (value === null) payload[key] = null;
      return;
    }

    if (NULLABLE_CONTRACTOR_FIELDS.has(key) && !value.trim()) {
      payload[key] = null;
      return;
    }

    payload[key] = value.trim();
  });

  return payload;
}

export async function listContractors(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("crm_contractors")
    .select("*")
    .order("name", { ascending: true });
  raise(error);
  return (data ?? []) as Contractor[];
}

export async function createContractor(
  supabase: SupabaseClient,
  fields: ContractorDraft,
) {
  const { data, error } = await supabase
    .from("crm_contractors")
    .insert(contractorPayload(fields))
    .select("*")
    .single();
  raise(error);
  return data as Contractor;
}

export async function updateContractor(
  supabase: SupabaseClient,
  id: string,
  fields: Partial<ContractorDraft>,
) {
  const payload = contractorPayload(fields);
  const { data, error } = await supabase
    .from("crm_contractors")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  raise(error);
  return data as Contractor;
}

export async function deleteContractor(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("crm_contractors").delete().eq("id", id);
  raise(error);
}

export async function addJob(
  supabase: SupabaseClient,
  contractorId: string,
  fields: ContractorJobDraft,
) {
  const { data, error } = await supabase
    .from("crm_contractor_jobs")
    .insert({
      contractor_id: contractorId,
      job_date: fields.job_date,
      business: fields.business ?? null,
      property_or_context: blankToNull(fields.property_or_context),
      work_done: fields.work_done.trim(),
      reason: blankToNull(fields.reason),
      cost: fields.cost == null || Number.isNaN(fields.cost) ? null : fields.cost,
    })
    .select("*")
    .single();
  raise(error);
  return data as ContractorJob;
}

export async function listJobs(supabase: SupabaseClient, contractorId: string) {
  const { data, error } = await supabase
    .from("crm_contractor_jobs")
    .select("*")
    .eq("contractor_id", contractorId)
    .order("job_date", { ascending: false });
  raise(error);
  return (data ?? []) as ContractorJob[];
}
