import type { SupabaseClient } from "@supabase/supabase-js";

import { formatDate, stage } from "./constants";
import type { CommissionStatus, Contact, Heat, HistoryType, Stage } from "./types";

export type ContactDraft = {
  business: Contact["business"];
  name: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  location?: string | null;
  backup_name?: string | null;
  backup_role?: string | null;
  backup_phone?: string | null;
  backup_email?: string | null;
  referral_source?: string | null;
  commission_status?: CommissionStatus;
  commission_amount?: number | null;
  heat?: Heat;
  stage?: Stage;
  tags?: string[];
};

export type FollowUpDraft = {
  text: string;
  date?: string | null;
};

export type ContactExtras = {
  followUp?: FollowUpDraft | null;
  note?: string | null;
};

export type ConversationInput = {
  text?: string | null;
  date?: string | null;
  channel?: string | null;
  action?: string | null;
  due?: string | null;
};

const NULLABLE_CONTACT_FIELDS = new Set<keyof ContactDraft>([
  "company",
  "phone",
  "email",
  "location",
  "backup_name",
  "backup_role",
  "backup_phone",
  "backup_email",
  "referral_source",
]);

type TaskDate = { text: string; date: string | null };

function raise(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function blankToNull(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function contactPayload(fields: Partial<ContactDraft>) {
  const payload: Record<string, string | number | string[] | null> = {};

  (Object.keys(fields) as (keyof ContactDraft)[]).forEach((key) => {
    const value = fields[key];

    if (key === "tags") {
      if (value === undefined) return;
      payload[key] = Array.isArray(value) ? value : [];
      return;
    }

    if (key === "commission_amount") {
      if (value === "" || value === undefined || value === null) {
        payload[key] = null;
      } else {
        payload[key] = Number(value);
      }
      return;
    }

    if (typeof value !== "string") {
      if (value === null) payload[key] = null;
      return;
    }
    if (NULLABLE_CONTACT_FIELDS.has(key) && !value.trim()) {
      payload[key] = null;
      return;
    }
    payload[key] = value.trim();
  });

  return payload;
}

function comparePendingDates(a: string | null, b: string | null) {
  const aDate = a?.trim() ?? "";
  const bDate = b?.trim() ?? "";
  if (!aDate && !bDate) return 0;
  if (!aDate) return 1;
  if (!bDate) return -1;
  if (aDate < bDate) return -1;
  if (aDate > bDate) return 1;
  return 0;
}

async function fetchContact(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from("crm_contacts")
    .select("*")
    .eq("id", id)
    .single();
  raise(error);
  return data as Contact;
}

async function insertHistory(
  supabase: SupabaseClient,
  row: {
    contact_id: string;
    type: HistoryType;
    text: string;
    date?: string | null;
    channel?: string | null;
  },
) {
  const { data, error } = await supabase
    .from("crm_history")
    .insert({
      contact_id: row.contact_id,
      type: row.type,
      text: row.text,
      date: blankToNull(row.date),
      channel: blankToNull(row.channel),
    })
    .select("id")
    .single();
  raise(error);
  return (data as { id: string }).id;
}

async function insertTask(
  supabase: SupabaseClient,
  row: {
    contact_id: string;
    text: string;
    date?: string | null;
    log_id?: string | null;
  },
) {
  const { data, error } = await supabase
    .from("crm_tasks")
    .insert({
      contact_id: row.contact_id,
      text: row.text,
      date: blankToNull(row.date),
      log_id: row.log_id ?? null,
    })
    .select("id")
    .single();
  raise(error);
  return (data as { id: string }).id;
}

async function maybeAddNote(
  supabase: SupabaseClient,
  contactId: string,
  note?: string | null,
) {
  const text = note?.trim() ?? "";
  if (!text) return;
  await insertHistory(supabase, {
    contact_id: contactId,
    type: "note",
    text,
  });
}

async function maybeAddFollowUp(
  supabase: SupabaseClient,
  contactId: string,
  leadStage: Stage,
  followUp?: FollowUpDraft | null,
) {
  const text = followUp?.text.trim() ?? "";
  if (!text || leadStage === "closed") return;
  await insertTask(supabase, {
    contact_id: contactId,
    text,
    date: followUp?.date,
  });
}

// Copies the soonest pending task onto the contact so lists and stats
// don't need a live join on every render.
export async function syncNext(supabase: SupabaseClient, contactId: string) {
  const { data, error } = await supabase
    .from("crm_tasks")
    .select("text, date")
    .eq("contact_id", contactId)
    .is("done_at", null);
  raise(error);

  const pending = ([...(data ?? [])] as TaskDate[]).sort((a, b) =>
    comparePendingDates(a.date, b.date),
  );
  const soonest = pending[0];

  const { error: updateError } = await supabase
    .from("crm_contacts")
    .update({
      next_action: soonest ? soonest.text : null,
      follow_up: blankToNull(soonest?.date),
    })
    .eq("id", contactId);
  raise(updateError);
}

export async function createContact(
  supabase: SupabaseClient,
  fields: ContactDraft,
  extras?: ContactExtras,
) {
  const { data, error } = await supabase
    .from("crm_contacts")
    .insert(contactPayload({ ...fields, tags: fields.tags ?? [] }))
    .select("*")
    .single();
  raise(error);
  const contact = data as Contact;

  await insertHistory(supabase, {
    contact_id: contact.id,
    type: "activity",
    text: "Contact added.",
  });
  await maybeAddNote(supabase, contact.id, extras?.note);
  await maybeAddFollowUp(
    supabase,
    contact.id,
    contact.stage,
    extras?.followUp,
  );
  await syncNext(supabase, contact.id);
  return fetchContact(supabase, contact.id);
}

export async function updateContact(
  supabase: SupabaseClient,
  id: string,
  fields: Partial<ContactDraft>,
  extras?: ContactExtras,
) {
  const existing = await fetchContact(supabase, id);
  const payload = contactPayload(fields);
  let leadStage = existing.stage;

  if (Object.keys(payload).length > 0) {
    const { data, error } = await supabase
      .from("crm_contacts")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    raise(error);
    leadStage = (data as Contact).stage;
  }

  if (typeof payload.stage === "string" && payload.stage !== existing.stage) {
    await insertHistory(supabase, {
      contact_id: id,
      type: "activity",
      text: `Sales stage changed from ${stage(existing.stage).name} to ${stage(payload.stage as Stage).name}.`,
    });
  }

  await maybeAddNote(supabase, id, extras?.note);
  await maybeAddFollowUp(supabase, id, leadStage, extras?.followUp);
  await syncNext(supabase, id);
  return fetchContact(supabase, id);
}

export async function addConversation(
  supabase: SupabaseClient,
  contactId: string,
  isClosed: boolean,
  input: ConversationInput,
) {
  const text = input.text?.trim() ?? "";
  const action = input.action?.trim() ?? "";
  const due = input.due?.trim() ?? "";

  if (!text && !action && !due) {
    throw new Error("Add a conversation or a follow-up.");
  }
  if (action && !due) {
    throw new Error("Choose a date for this follow-up.");
  }
  if (due && isClosed) {
    throw new Error("Reopen this lead before scheduling a follow-up.");
  }

  let logId: string | null = null;
  if (text) {
    logId = await insertHistory(supabase, {
      contact_id: contactId,
      type: "chat",
      text,
      date: input.date,
      channel: input.channel,
    });
  }

  if (action || due) {
    await insertTask(supabase, {
      contact_id: contactId,
      text: action,
      date: due,
      log_id: logId,
    });
  }

  await syncNext(supabase, contactId);
}

export async function linkFollowup(
  supabase: SupabaseClient,
  contactId: string,
  logId: string,
  text: string,
  date: string | null,
  isClosed: boolean,
) {
  const action = text.trim();
  const due = date?.trim() ?? "";

  if (action && !due) {
    throw new Error("Choose a date for this follow-up.");
  }
  if (due && isClosed) {
    throw new Error("Reopen this lead before scheduling a follow-up.");
  }

  await insertTask(supabase, {
    contact_id: contactId,
    text: action,
    date: due,
    log_id: logId,
  });
  await syncNext(supabase, contactId);
}

export async function completeFollowup(
  supabase: SupabaseClient,
  contactId: string,
  taskId: string,
  taskText: string,
  taskDate: string | null,
) {
  const { error } = await supabase
    .from("crm_tasks")
    .update({ done_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("contact_id", contactId);
  raise(error);

  const scheduled = taskDate?.trim() ?? "";
  await insertHistory(supabase, {
    contact_id: contactId,
    type: "followup",
    text: scheduled ? `${taskText} (scheduled for ${scheduled})` : taskText,
  });
  await syncNext(supabase, contactId);
}

export async function rescheduleTask(
  supabase: SupabaseClient,
  contactId: string,
  taskId: string,
  oldDate: string | null,
  newDate: string | null,
) {
  const nextDate = blankToNull(newDate);
  const { error } = await supabase
    .from("crm_tasks")
    .update({ date: nextDate })
    .eq("id", taskId)
    .eq("contact_id", contactId);
  raise(error);

  const from = formatDate(oldDate) || "no date";
  const to = formatDate(nextDate) || "no date";
  await insertHistory(supabase, {
    contact_id: contactId,
    type: "activity",
    text: `Follow-up rescheduled from ${from} to ${to}.`,
  });
  await syncNext(supabase, contactId);
}

export async function setLeadPosition(
  supabase: SupabaseClient,
  contactId: string,
  key: "heat" | "stage",
  newValue: Heat | Stage,
  oldValue: Heat | Stage,
  oldLabel: string,
  newLabel: string,
) {
  if (newValue === oldValue) return;

  const { error } = await supabase
    .from("crm_contacts")
    .update({ [key]: newValue })
    .eq("id", contactId);
  raise(error);

  await insertHistory(supabase, {
    contact_id: contactId,
    type: "activity",
    text:
      key === "heat"
        ? `Lead category changed from ${oldLabel} to ${newLabel}.`
        : `Sales stage changed from ${oldLabel} to ${newLabel}.`,
  });
  await syncNext(supabase, contactId);
}

export async function deleteContact(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("crm_contacts").delete().eq("id", id);
  raise(error);
}
