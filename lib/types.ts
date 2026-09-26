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
export type Role = "admin" | "member";

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: Role | null;
  created_at: string;
}

export interface Contact {
  id: string;
  owner_id: string | null;
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
  assigned_to: string | null;
}

export type ContractorStatus = "active" | "inactive";

export interface Contractor {
  id: string;
  owner_id: string | null;
  name: string;
  trade: string;
  company: string | null;
  phone: string | null;
  alt_phone: string | null;
  email: string | null;
  area_served: string | null;
  services_description: string | null;
  rating: number | null;
  status: ContractorStatus;
  created_at: string;
  updated_at: string;
}

export interface ContractorJob {
  id: string;
  contractor_id: string;
  job_date: string;
  business: Business | null;
  property_or_context: string | null;
  work_done: string;
  reason: string | null;
  cost: number | null;
  created_at: string;
}

export interface Property {
  id: string;
  owner_id: string | null;
  name: string;
  business: Business | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyContact {
  id: string;
  property_id: string;
  owner_id: string | null;
  role: string;
  contact_name: string | null;
  company: string | null;
  phone: string | null;
  alt_phone: string | null;
  email: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}
