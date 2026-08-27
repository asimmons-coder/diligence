import type {
  AdjustmentStatus,
  Database,
  DiligenceStatus,
  DocumentFolder,
  FindingStatus,
} from "./types";
import { cloneSeed } from "./seed";
import { getSupabaseBrowserClient } from "./supabase";

/**
 * Persistence contract. The demo uses MemoryRepository + localStorage.
 * A later SupabaseRepository should implement the same methods against
 * the SQL schema in supabase/migrations — types already match 1:1.
 */
export interface DiligenceRepository {
  load(): Promise<Database>;
  save(db: Database): Promise<void>;
}

export class MemoryRepository implements DiligenceRepository {
  constructor(private snapshot: Database = cloneSeed()) {}

  async load(): Promise<Database> {
    return structuredClone(this.snapshot);
  }

  async save(db: Database): Promise<void> {
    this.snapshot = structuredClone(db);
  }
}

export function createRepository(): DiligenceRepository {
  const client = getSupabaseBrowserClient();
  if (!client) return new MemoryRepository();
  return new MemoryRepository();
}

export type MutationContract = {
  setAdjustmentStatus: (id: string, status: AdjustmentStatus, notes?: string) => void;
  setDiligenceStatus: (id: string, status: DiligenceStatus) => void;
  setFindingStatus: (id: string, status: FindingStatus) => void;
  uploadDocument: (dealId: string, filename: string, folder: DocumentFolder) => void;
};
