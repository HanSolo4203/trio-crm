export type Business = "right-stay" | "rsl-express" | "storey";
export type Heat = "general" | "cold" | "warm" | "hot";
export type Stage =
  | "new"
  | "contacted"
  | "meeting"
  | "proposal"
  | "client"
  | "closed";
export type HistoryType = "note" | "activity" | "followup" | "chat";
export type CommissionStatus = "none" | "pending" | "paid";

export interface Contact {
  id: string;
  owner_id: string;
  business: Business;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  backup_name: string | null;
  backup_role: string | null;
  backup_phone: string | null;
  backup_email: string | null;
  referral_source: string | null;
  commission_status: CommissionStatus;
  commission_amount: number | null;
  heat: Heat;
  stage: Stage;
  tags: string[];
  next_action: string | null;
  follow_up: string | null;
  created_at: string;
  updated_at: string;
}

export interface HistoryEntry {
  id: string;
  contact_id: string;
  type: HistoryType;
  text: string;
  at: string;
  date: string | null;
  channel: string | null;
}

export interface Task {
  id: string;
  contact_id: string;
  text: string;
  date: string | null;
  log_id: string | null;
  done_at: string | null;
}
