export const queryKeys = {
  contacts: ["contacts"] as const,
  tasks: ["tasks"] as const,
  history: ["history"] as const,
  contractors: ["contractors"] as const,
  contact: (id: string) => ["contacts", id] as const,
  contactHistory: (id: string) => ["history", id] as const,
  contactTasks: (id: string) => ["tasks", id] as const,
  contractor: (id: string) => ["contractors", id] as const,
  contractorJobs: (id: string) => ["contractor-jobs", id] as const,
};
