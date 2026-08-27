import type {
  AdjustmentCategory,
  DealSource,
  DealStage,
  DiligenceCategory,
  DiligenceStatus,
  DocumentFolder,
  DocumentStatus,
  FindingStatus,
  UserRole,
  Vertical,
} from "./types";

export const APP_AS_OF = "2026-08-27";
export const STALE_DAYS = 14;
export const UPCOMING_DEADLINE_DAYS = 7;
export const STORE_KEY = "diligence.store.v1";
export const PIPELINE_VIEW_KEY = "diligence.pipeline.view";

export const CURRENT_ORG_ID = "org_northline";
export const CURRENT_USER_ID = "user_elena";
export const HALE_DEAL_ID = "hale-mercer";
export const MILLER_DEAL_ID = "miller-law";

export const STAGE_LABELS: Record<DealStage, string> = {
  target: "Target",
  contacted: "Contacted",
  nda: "NDA",
  initial_data: "Initial Data",
  financial_review: "Financial Review",
  diligence: "Diligence",
  loi: "LOI",
  confirmatory_diligence: "Confirmatory Diligence",
  closing: "Closing",
  closed: "Closed",
  passed: "Passed",
};

export const SOURCE_LABELS: Record<DealSource, string> = {
  banker: "Banker",
  proprietary: "Proprietary",
  conference: "Conference",
  counsel_intro: "Counsel intro",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  deal_lead: "Deal Lead",
  financial_diligence: "Financial Diligence",
  vp_diligence: "VP Diligence",
  managing_partner: "Managing Partner",
  associate: "Associate",
};

export const VERTICAL_LABELS: Record<Vertical, string> = {
  legal: "Legal",
  accounting: "Accounting",
  wealth: "Wealth",
  insurance: "Insurance",
  hvac: "HVAC / Home services",
  dental: "Dental",
  veterinary: "Veterinary",
  restoration: "Restoration",
  other: "Other",
};

export const ADJUSTMENT_CATEGORY_LABELS: Record<AdjustmentCategory, string> = {
  compensation: "Compensation",
  one_time: "One-time",
  occupancy: "Occupancy",
  revenue: "Revenue",
  working_capital: "Working capital",
  synergy: "Synergy",
  other: "Other",
};

export const DILIGENCE_CATEGORY_LABELS: Record<DiligenceCategory, string> = {
  financial: "Financial",
  revenue_clients: "Revenue / Clients",
  employees_attorneys: "Employees / Attorneys",
  compensation: "Compensation",
  legal: "Legal",
  tax: "Tax",
  real_estate: "Real Estate",
  technology: "Technology",
  operations: "Operations",
  other: "Other",
};

export const DILIGENCE_STATUS_LABELS: Record<DiligenceStatus, string> = {
  not_requested: "Not Requested",
  requested: "Requested",
  received: "Received",
  under_review: "Under Review",
  follow_up_required: "Follow-Up Required",
  complete: "Complete",
  na: "N/A",
};

export const DOCUMENT_FOLDER_LABELS: Record<DocumentFolder, string> = {
  financials: "Financials",
  tax: "Tax",
  payroll: "Payroll",
  attorney_production: "Attorney Production",
  client_matter: "Client / Matter Data",
  legal: "Legal",
  real_estate: "Real Estate",
  corporate: "Corporate",
  other: "Other",
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  uploading: "Uploading",
  processing: "Processing",
  analyzed: "Analyzed",
  needs_review: "Needs Review",
  failed: "Failed",
};

export const FINDING_STATUS_LABELS: Record<FindingStatus, string> = {
  open: "Open",
  accepted: "Accepted as question",
  dismissed: "Dismissed",
  resolved: "Resolved",
};

export const FLAG_LABELS: Record<string, string> = {
  concentration: "Concentration",
  lease_expiry: "Lease expiry",
  missing_tax_return: "Missing 2025 tax return",
  stale: "Stale",
  financial_inconsistency: "Financial inconsistency",
  declining_book: "Declining book",
  key_person: "Key person",
  working_capital: "Working capital",
  malpractice: "Malpractice exposure",
  data_room_thin: "Thin data room",
};

export const OPEX_LABELS: Record<string, string> = {
  opex_owner: "Owner compensation",
  opex_staff: "Staff compensation",
  opex_occupancy: "Occupancy",
  opex_marketing: "Marketing",
  opex_professional_services: "Professional services",
  opex_insurance: "Insurance",
  opex_technology: "Technology",
  opex_other: "Other",
};

export const CLAIM_KIND_LABELS: Record<string, string> = {
  source_fact: "Source fact",
  approved_assumption: "Approved assumption",
  ai_inference: "AI inference",
};
