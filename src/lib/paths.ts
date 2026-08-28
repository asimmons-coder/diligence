import type { EvidenceItem, IngestFile } from "./types";

export function fileBasename(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || path;
}

export function folderPathOf(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  const i = normalized.lastIndexOf("/");
  return i === -1 ? "" : normalized.slice(0, i);
}

export function displayEvidencePath(item: Pick<EvidenceItem, "folder_path" | "basename" | "filename">): string {
  if (item.folder_path && item.basename) return `${item.folder_path}/${item.basename}`;
  return item.filename ?? item.basename ?? "—";
}

export function stubContentHash(input: {
  path?: string;
  basename: string;
  sizeBytes?: number | null;
  lastModified?: number | null;
}): string {
  const raw = `${input.path ?? input.basename}|${input.basename}|${input.sizeBytes ?? 0}|${input.lastModified ?? 0}`;
  let h = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv1a:${(h >>> 0).toString(16)}`;
}

export function ingestFromPath(path: string, sizeBytes?: number | null, lastModified?: number | null): IngestFile {
  const basename = fileBasename(path);
  return { path, basename, sizeBytes: sizeBytes ?? null, lastModified: lastModified ?? null };
}

const VERSION_TOKEN = /\b(final updated|updated|v2|v3|new|revised|rev)\b/i;

export function looksLikeRevision(name: string): boolean {
  return VERSION_TOKEN.test(name);
}

export function stemForVersionCompare(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/\b(final updated|final|updated|v\d+|new|revised|rev)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function detectDuplicatesAndRevisions(items: EvidenceItem[]): EvidenceItem[] {
  const next = items.map((item) => ({ ...item }));
  for (let i = 0; i < next.length; i += 1) {
    for (let j = i + 1; j < next.length; j += 1) {
      const a = next[i];
      const b = next[j];
      if (a.deal_id !== b.deal_id) continue;
      const sameHash = Boolean(a.content_hash && a.content_hash === b.content_hash);
      const sameNameSize =
        a.basename.toLowerCase() === b.basename.toLowerCase() &&
        a.size_bytes != null &&
        a.size_bytes === b.size_bytes;
      const samePeriodType =
        a.detected_type === b.detected_type &&
        a.detected_period != null &&
        a.detected_period === b.detected_period &&
        stemForVersionCompare(a.basename) === stemForVersionCompare(b.basename) &&
        stemForVersionCompare(a.basename).length > 2;

      if (sameHash || sameNameSize) {
        if (!a.potential_duplicate_of) a.potential_duplicate_of = b.id;
        if (!b.potential_duplicate_of) b.potential_duplicate_of = a.id;
      }

      if (samePeriodType && (looksLikeRevision(a.basename) || looksLikeRevision(b.basename))) {
        const aNewer = revisionRank(a.basename) >= revisionRank(b.basename);
        const newer = aNewer ? a : b;
        const older = aNewer ? b : a;
        if (!older.superseded_by_id) older.superseded_by_id = newer.id;
        if (!newer.supersedes_id) newer.supersedes_id = older.id;
      }
    }
  }
  return next;
}

function revisionRank(name: string): number {
  const n = name.toLowerCase();
  if (n.includes("final updated") || n.includes("updated")) return 4;
  if (/\bv3\b/.test(n)) return 3;
  if (/\bnew\b/.test(n) || /\bv2\b/.test(n)) return 2;
  if (n.includes("final")) return 1;
  return 0;
}

export const HALE_FOLDER_BY_BASENAME: Record<string, string> = {
  "Tax Return 2022.pdf": "Tax",
  "Tax Return 2023.pdf": "Tax",
  "Tax Return 2024.pdf": "Tax",
  "Hale_Mercer_2024_Form_1065.pdf": "Tax",
  "P&L 2023.xlsx": "Financials",
  "Hale_Mercer_FY2023_PL.pdf": "Financials",
  "P&L 2024 FINAL.xlsx": "Financials",
  "P&L 2024 FINAL UPDATED.xlsx": "Financials",
  "Hale_Mercer_TTM_2025_PL.pdf": "Financials",
  "QB export jan-june.xlsx": "Financials",
  "GL_export.xlsx": "Financials",
  "AR Aging.xlsx": "Financials",
  "Payroll Detail v2.xlsx": "Payroll",
  "Hale_Mercer_Payroll_Register_TTM.xlsx": "Payroll",
  "Attorney Production.xlsx": "Production",
  "Attorney Production NEW.xlsx": "Production",
  "Client Matter Revenue.xlsx": "Clients",
  "Lease.pdf": "Real Estate",
  "333_W_Wacker_Office_Lease.pdf": "Real Estate",
  "Org Chart.pdf": "Corporate",
  "NDA executed.pdf": "Legal",
  "Indication_or_LOI.pdf": "Legal",
  "RE professional services expenses.eml": "Emails",
  "Re office lease 333 W Wacker.eml": "Emails",
  "Partner retention discussion.md": "Meetings",
  "Occupancy and expenses post-close.md": "Meetings",
};

export function haleFolderForBasename(basename: string): string {
  return HALE_FOLDER_BY_BASENAME[basename] ?? folderFromDetectedName(basename);
}

function folderFromDetectedName(basename: string): string {
  const n = basename.toLowerCase();
  if (/tax|1065/.test(n)) return "Tax";
  if (/payroll/.test(n)) return "Payroll";
  if (/production|origination/.test(n)) return "Production";
  if (/client|matter/.test(n)) return "Clients";
  if (/lease|wacker/.test(n)) return "Real Estate";
  if (/nda|loi|indication/.test(n)) return "Legal";
  if (/\.eml$|\.msg$/.test(n)) return "Emails";
  if (/\.md$|meeting|transcript/.test(n)) return "Meetings";
  if (/org chart|roster/.test(n)) return "Corporate";
  if (/p&l|pnl|gl|qb|aging|balance/.test(n)) return "Financials";
  return "";
}

export const HALE_MESSY_PATHS = [
  "Tax/Tax Return 2022.pdf",
  "Tax/Tax Return 2023.pdf",
  "Tax/Tax Return 2024.pdf",
  "Financials/P&L 2023.xlsx",
  "Financials/P&L 2024 FINAL.xlsx",
  "Financials/P&L 2024 FINAL UPDATED.xlsx",
  "Financials/Hale_Mercer_TTM_2025_PL.pdf",
  "Financials/QB export jan-june.xlsx",
  "Financials/GL_export.xlsx",
  "Payroll/Payroll Detail v2.xlsx",
  "Production/Attorney Production.xlsx",
  "Production/Attorney Production NEW.xlsx",
  "Clients/Client Matter Revenue.xlsx",
  "Financials/AR Aging.xlsx",
  "Real Estate/Lease.pdf",
  "Corporate/Org Chart.pdf",
  "Legal/NDA executed.pdf",
  "Legal/Indication_or_LOI.pdf",
  "Emails/RE professional services expenses.eml",
  "Emails/Re office lease 333 W Wacker.eml",
  "Meetings/Partner retention discussion.md",
  "Meetings/Occupancy and expenses post-close.md",
] as const;
