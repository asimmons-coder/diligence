import type { DetectedDocumentType, DocumentFolder } from "./types";

export interface Classification {
  type: DetectedDocumentType;
  period: string | null;
  entity: string | null;
  folder: DocumentFolder;
  format: string;
  confidence: number;
}

const TYPE_EXTS: Record<string, string> = {
  pdf: "pdf",
  xlsx: "xlsx",
  xls: "xls",
  csv: "csv",
  eml: "eml",
  msg: "msg",
  md: "md",
  txt: "txt",
};

export function fileFormat(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return TYPE_EXTS[ext] ?? ext ?? "unknown";
}

export function classifyFilename(
  filename: string,
  entityHint = "Hale & Mercer"
): Classification {
  const name = filename.toLowerCase();
  const format = fileFormat(filename);
  const period = detectPeriod(name);
  const entity = entityHint;

  if (/\.eml$|\.msg$|re:|fwd:|email/.test(name) && /lease|professional|services|occupancy/.test(name) || /\.eml$|\.msg$/.test(name)) {
    return { type: "email", period, entity, folder: "other", format, confidence: 0.86 };
  }
  if (/\.md$|transcript|meeting|notes?|granola/.test(name) && !/nda|loi|indication/.test(name)) {
    return {
      type: "meeting_note_transcript",
      period,
      entity,
      folder: "other",
      format,
      confidence: 0.84,
    };
  }
  if (/tax|1065|k-1|form_1065/.test(name)) {
    return { type: "tax_return", period, entity, folder: "tax", format, confidence: 0.94 };
  }
  if (/p&l|p \+ l|pnl|income statement|_pl\b|ttm.*pl|pl\.pdf/.test(name)) {
    return { type: "pnl", period, entity, folder: "financials", format, confidence: 0.93 };
  }
  if (/balance sheet|bs\.xlsx/.test(name)) {
    return { type: "balance_sheet", period, entity, folder: "financials", format, confidence: 0.9 };
  }
  if (/trial balance/.test(name)) {
    return { type: "trial_balance", period, entity, folder: "financials", format, confidence: 0.9 };
  }
  if (/\bgl\b|general ledger|gl_export|gl export/.test(name)) {
    return { type: "gl", period, entity, folder: "financials", format, confidence: 0.9 };
  }
  if (/payroll|comp register/.test(name)) {
    return { type: "payroll_register", period, entity, folder: "payroll", format, confidence: 0.91 };
  }
  if (/roster|headcount|org chart/.test(name)) {
    return {
      type: /org chart/.test(name) ? "other" : "employee_roster",
      period,
      entity,
      folder: "corporate",
      format,
      confidence: 0.88,
    };
  }
  if (/production|origination/.test(name)) {
    return {
      type: "production_report",
      period,
      entity,
      folder: "attorney_production",
      format,
      confidence: 0.9,
    };
  }
  if (/client matter|customer detail|collections by client/.test(name)) {
    return {
      type: "customer_client_detail",
      period,
      entity,
      folder: "client_matter",
      format,
      confidence: 0.9,
    };
  }
  if (/\bar\b|aging/.test(name)) {
    return { type: "ar", period, entity, folder: "financials", format, confidence: 0.9 };
  }
  if (/bank statement|qb export|quickbooks/.test(name)) {
    return {
      type: /qb export|quickbooks/.test(name) ? "pnl" : "bank_statement",
      period,
      entity,
      folder: "financials",
      format,
      confidence: 0.86,
    };
  }
  if (/lease|wacker|occupancy rent/.test(name)) {
    return { type: "lease", period, entity, folder: "real_estate", format, confidence: 0.92 };
  }
  if (/nda/.test(name)) {
    return { type: "legal", period, entity, folder: "legal", format, confidence: 0.93 };
  }
  if (/loi|indication|purchase agreement/.test(name)) {
    return {
      type: "purchase_agreement_loi",
      period,
      entity,
      folder: "legal",
      format,
      confidence: 0.9,
    };
  }
  return { type: "other", period, entity, folder: "other", format, confidence: 0.55 };
}

function detectPeriod(name: string): string | null {
  if (/ttm.?2025|ttm 2025/.test(name)) return "TTM 2025";
  if (/2024/.test(name) && /final updated|updated/.test(name)) return "FY2024";
  if (/2024/.test(name)) return "FY2024";
  if (/2023/.test(name)) return "FY2023";
  if (/2022/.test(name)) return "FY2022";
  if (/2025/.test(name)) return "FY2025";
  if (/jan-june|jan.?june|h1/.test(name)) return "H1 2025";
  return null;
}

export const HALE_MESSY_FILENAMES = [
  "Tax Return 2022.pdf",
  "Tax Return 2023.pdf",
  "Tax Return 2024.pdf",
  "P&L 2023.xlsx",
  "P&L 2024 FINAL.xlsx",
  "P&L 2024 FINAL UPDATED.xlsx",
  "Hale_Mercer_TTM_2025_PL.pdf",
  "QB export jan-june.xlsx",
  "GL_export.xlsx",
  "Payroll Detail v2.xlsx",
  "Attorney Production.xlsx",
  "Attorney Production NEW.xlsx",
  "Client Matter Revenue.xlsx",
  "AR Aging.xlsx",
  "Lease.pdf",
  "Org Chart.pdf",
  "NDA executed.pdf",
  "Indication_or_LOI.pdf",
  "RE professional services expenses.eml",
  "Re office lease 333 W Wacker.eml",
  "Partner retention discussion.md",
  "Occupancy and expenses post-close.md",
] as const;

export function isHaleMessyFilename(filename: string): boolean {
  const n = filename.trim().toLowerCase();
  return HALE_MESSY_FILENAMES.some((known) => known.toLowerCase() === n);
}

export function haleMessyMatchCount(filenames: string[]): number {
  return filenames.filter(isHaleMessyFilename).length;
}
