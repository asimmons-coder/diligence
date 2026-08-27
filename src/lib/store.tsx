"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { APP_AS_OF, CURRENT_USER_ID, STORE_KEY } from "./constants";
import {
  getDealView,
  getPortfolioMetrics,
  listDealViews,
  searchDeals,
} from "./derived";
import { cloneSeed } from "./seed";
import type {
  AdjustmentStatus,
  AiFinding,
  Database,
  DiligenceStatus,
  DocumentFolder,
  FindingStatus,
} from "./types";

export interface StoreApi {
  db: Database;
  ready: boolean;
  currentUser: Database["users"][number];
  currentOrg: Database["organizations"][number];
  assistantOpen: boolean;
  setAssistantOpen: (open: boolean) => void;
  resetSeed: () => void;
  views: ReturnType<typeof listDealViews>;
  portfolio: ReturnType<typeof getPortfolioMetrics>;
  dealView: (id: string) => ReturnType<typeof getDealView>;
  search: (q: string) => ReturnType<typeof searchDeals>;
  setAdjustmentStatus: (
    id: string,
    status: AdjustmentStatus,
    notes?: string
  ) => void;
  setTaskComplete: (id: string, completed: boolean) => void;
  setDiligenceStatus: (id: string, status: DiligenceStatus) => void;
  updateFinding: (
    id: string,
    patch: Partial<
      Pick<AiFinding, "status" | "assigned_user_id" | "edited_question" | "question">
    >
  ) => void;
  acceptFindingAsQuestion: (id: string) => void;
  uploadDocument: (input: {
    dealId: string;
    filename: string;
    folder: DocumentFolder;
    sizeBytes?: number;
  }) => string;
}

const StoreContext = createContext<StoreApi | null>(null);

function nowIso() {
  return `${APP_AS_OF}T${new Date().toISOString().slice(11)}`;
}

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function persist(db: Database) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
  } catch {
    // quota / private mode — UI still works in-memory
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database>(() => cloneSeed());
  const [ready, setReady] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Database;
        if (parsed?.deals?.length && parsed?.organizations?.length) {
          setDb(parsed);
        }
      }
    } catch {
      setDb(cloneSeed());
    }
    setReady(true);
  }, []);

  const commit = useCallback((updater: (prev: Database) => Database) => {
    setDb((prev) => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }, []);

  const currentUser = db.users.find((u) => u.id === CURRENT_USER_ID) ?? db.users[0];
  const currentOrg = db.organizations[0];

  const setAdjustmentStatus = useCallback<StoreApi["setAdjustmentStatus"]>(
    (id, status, notes) => {
      commit((prev) => {
        const existing = prev.ebitda_adjustments.find((a) => a.id === id);
        if (!existing) return prev;
        const at = nowIso();
        return {
          ...prev,
          ebitda_adjustments: prev.ebitda_adjustments.map((a) =>
            a.id === id
              ? {
                  ...a,
                  status,
                  user_notes: notes ?? a.user_notes,
                  provenance: {
                    ...a.provenance,
                    approval_status:
                      status === "accepted"
                        ? "approved_assumption"
                        : a.origin === "ai"
                          ? "ai_inference"
                          : a.provenance.approval_status,
                  },
                }
              : a
          ),
          deals: prev.deals.map((d) =>
            d.id === existing.deal_id ? { ...d, last_activity_at: at } : d
          ),
          activities: [
            {
              id: newId("act"),
              organization_id: existing.organization_id,
              deal_id: existing.deal_id,
              actor_user_id: CURRENT_USER_ID,
              kind: "adjustment_status",
              title: `${status === "accepted" ? "Accepted" : status === "rejected" ? "Rejected" : "Reopened"} ${existing.description}`,
              body: `${existing.description} is now ${status}. Amount ${existing.amount}.`,
              occurred_at: at,
              metadata: { adjustment_id: id, status },
            },
            ...prev.activities,
          ],
          audit_events: [
            {
              id: newId("aud"),
              organization_id: existing.organization_id,
              deal_id: existing.deal_id,
              actor_user_id: CURRENT_USER_ID,
              entity_type: "ebitda_adjustment",
              entity_id: id,
              action: "status_change",
              before: { status: existing.status },
              after: { status },
              occurred_at: at,
            },
            ...prev.audit_events,
          ],
        };
      });
    },
    [commit]
  );

  const setTaskComplete = useCallback<StoreApi["setTaskComplete"]>(
    (id, completed) => {
      commit((prev) => {
        const existing = prev.tasks.find((t) => t.id === id);
        if (!existing) return prev;
        const at = nowIso();
        return {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  completed,
                  completed_at: completed ? at : null,
                }
              : t
          ),
          deals: prev.deals.map((d) =>
            d.id === existing.deal_id ? { ...d, last_activity_at: at } : d
          ),
          activities: [
            {
              id: newId("act"),
              organization_id: existing.organization_id,
              deal_id: existing.deal_id,
              actor_user_id: CURRENT_USER_ID,
              kind: "task_complete",
              title: completed
                ? `Completed: ${existing.title}`
                : `Reopened: ${existing.title}`,
              body: existing.title,
              occurred_at: at,
              metadata: { task_id: id, completed },
            },
            ...prev.activities,
          ],
        };
      });
    },
    [commit]
  );

  const setDiligenceStatus = useCallback<StoreApi["setDiligenceStatus"]>(
    (id, status) => {
      commit((prev) => {
        const existing = prev.diligence_requests.find((r) => r.id === id);
        if (!existing) return prev;
        const at = nowIso();
        return {
          ...prev,
          diligence_requests: prev.diligence_requests.map((r) =>
            r.id === id ? { ...r, status } : r
          ),
          deals: prev.deals.map((d) =>
            d.id === existing.deal_id ? { ...d, last_activity_at: at } : d
          ),
          activities: [
            {
              id: newId("act"),
              organization_id: existing.organization_id,
              deal_id: existing.deal_id,
              actor_user_id: CURRENT_USER_ID,
              kind: "diligence_status",
              title: `Diligence status → ${status.replaceAll("_", " ")}`,
              body: existing.question,
              occurred_at: at,
              metadata: { request_id: id, from: existing.status, to: status },
            },
            ...prev.activities,
          ],
          audit_events: [
            {
              id: newId("aud"),
              organization_id: existing.organization_id,
              deal_id: existing.deal_id,
              actor_user_id: CURRENT_USER_ID,
              entity_type: "diligence_request",
              entity_id: id,
              action: "status_change",
              before: { status: existing.status },
              after: { status },
              occurred_at: at,
            },
            ...prev.audit_events,
          ],
        };
      });
    },
    [commit]
  );

  const updateFinding = useCallback<StoreApi["updateFinding"]>(
    (id, patch) => {
      commit((prev) => {
        const existing = prev.ai_findings.find((f) => f.id === id);
        if (!existing) return prev;
        const at = nowIso();
        const nextStatus = patch.status ?? existing.status;
        const title =
          nextStatus === "dismissed"
            ? "Dismissed AI finding"
            : nextStatus === "resolved"
              ? "Marked AI finding resolved"
              : nextStatus === "accepted"
                ? "Accepted AI finding as diligence question"
                : patch.assigned_user_id
                  ? "Assigned AI finding"
                  : "Edited AI finding";
        return {
          ...prev,
          ai_findings: prev.ai_findings.map((f) =>
            f.id === id
              ? {
                  ...f,
                  ...patch,
                  question: patch.question ?? f.question,
                  edited_question:
                    patch.edited_question ??
                    (patch.question && patch.question !== existing.question
                      ? patch.question
                      : f.edited_question),
                }
              : f
          ),
          deals: prev.deals.map((d) =>
            d.id === existing.deal_id ? { ...d, last_activity_at: at } : d
          ),
          activities: [
            {
              id: newId("act"),
              organization_id: existing.organization_id,
              deal_id: existing.deal_id,
              actor_user_id: CURRENT_USER_ID,
              kind: "finding_action",
              title,
              body: patch.question ?? existing.edited_question ?? existing.question,
              occurred_at: at,
              metadata: { finding_id: id, ...patch },
            },
            ...prev.activities,
          ],
        };
      });
    },
    [commit]
  );

  const acceptFindingAsQuestion = useCallback<StoreApi["acceptFindingAsQuestion"]>(
    (id) => {
      commit((prev) => {
        const existing = prev.ai_findings.find((f) => f.id === id);
        if (!existing) return prev;
        const at = nowIso();
        const requestId = existing.linked_request_id ?? newId("dil");
        const alreadyLinked = existing.linked_request_id
          ? prev.diligence_requests.some((r) => r.id === existing.linked_request_id)
          : false;
        const newRequest = alreadyLinked
          ? null
          : {
              id: requestId,
              organization_id: existing.organization_id,
              deal_id: existing.deal_id,
              category: "other" as const,
              question: existing.edited_question ?? existing.question,
              status: "requested" as const,
              owner_user_id: existing.assigned_user_id ?? CURRENT_USER_ID,
              counterparty_owner: null,
              due_date: null,
              supporting_document_ids: existing.source_document_ids,
              notes: "Accepted from AI finding",
              ai_generated: true,
              priority: "high" as const,
            };
        return {
          ...prev,
          ai_findings: prev.ai_findings.map((f) =>
            f.id === id
              ? { ...f, status: "accepted" as FindingStatus, linked_request_id: requestId }
              : f
          ),
          diligence_requests: newRequest
            ? [newRequest, ...prev.diligence_requests]
            : prev.diligence_requests,
          deals: prev.deals.map((d) =>
            d.id === existing.deal_id ? { ...d, last_activity_at: at } : d
          ),
          activities: [
            {
              id: newId("act"),
              organization_id: existing.organization_id,
              deal_id: existing.deal_id,
              actor_user_id: CURRENT_USER_ID,
              kind: "finding_action",
              title: "Accepted AI finding as diligence question",
              body: existing.edited_question ?? existing.question,
              occurred_at: at,
              metadata: { finding_id: id, request_id: requestId },
            },
            ...prev.activities,
          ],
        };
      });
    },
    [commit]
  );

  const uploadDocument = useCallback<StoreApi["uploadDocument"]>(
    ({ dealId, filename, folder, sizeBytes }) => {
      const id = newId("doc");
      const at = nowIso();
      commit((prev) => {
        const deal = prev.deals.find((d) => d.id === dealId);
        if (!deal) return prev;
        return {
          ...prev,
          documents: [
            {
              id,
              organization_id: deal.organization_id,
              deal_id: dealId,
              filename,
              folder,
              uploaded_at: at,
              uploaded_by: CURRENT_USER_ID,
              processing_status: "uploading",
              classification: null,
              extracted_payload: null,
              confidence: null,
              linked_request_ids: [],
              page_count: null,
              mime_type: null,
              size_bytes: sizeBytes ?? null,
            },
            ...prev.documents,
          ],
          deals: prev.deals.map((d) =>
            d.id === dealId ? { ...d, last_activity_at: at } : d
          ),
          activities: [
            {
              id: newId("act"),
              organization_id: deal.organization_id,
              deal_id: dealId,
              actor_user_id: CURRENT_USER_ID,
              kind: "document_upload",
              title: `Uploaded ${filename}`,
              body: `${filename} added to ${folder.replaceAll("_", " ")}.`,
              occurred_at: at,
              metadata: { document_id: id },
            },
            ...prev.activities,
          ],
        };
      });

      window.setTimeout(() => {
        commit((prev) => ({
          ...prev,
          documents: prev.documents.map((d) =>
            d.id === id ? { ...d, processing_status: "processing" } : d
          ),
        }));
      }, 700);

      window.setTimeout(() => {
        commit((prev) => ({
          ...prev,
          documents: prev.documents.map((d) =>
            d.id === id
              ? {
                  ...d,
                  processing_status: "analyzed",
                  classification: folder,
                  confidence: 0.7,
                  extracted_payload: {
                    pipeline: [
                      "classify",
                      "extract",
                      "update_financials",
                      "match_requests",
                      "flag_inconsistencies",
                      "generate_findings",
                      "update_summary",
                      "activity",
                    ],
                    staged: true,
                    filename,
                  },
                }
              : d
          ),
          activities: [
            {
              id: newId("act"),
              organization_id: prev.deals.find((x) => x.id === dealId)?.organization_id ?? "",
              deal_id: dealId,
              actor_user_id: CURRENT_USER_ID,
              kind: "document_status",
              title: `${filename} analyzed`,
              body: "Classification complete. Extraction pipeline is stubbed for a later LLM pass — no financials were silently changed.",
              occurred_at: nowIso(),
              metadata: { document_id: id, status: "analyzed" },
            },
            ...prev.activities,
          ],
        }));
      }, 1600);

      return id;
    },
    [commit]
  );

  const resetSeed = useCallback(() => {
    const next = cloneSeed();
    persist(next);
    setDb(next);
  }, []);

  const value = useMemo<StoreApi>(() => {
    return {
      db,
      ready,
      currentUser,
      currentOrg,
      assistantOpen,
      setAssistantOpen,
      resetSeed,
      views: listDealViews(db),
      portfolio: getPortfolioMetrics(db),
      dealView: (id) => getDealView(db, id),
      search: (q) => searchDeals(db, q),
      setAdjustmentStatus,
      setTaskComplete,
      setDiligenceStatus,
      updateFinding,
      acceptFindingAsQuestion,
      uploadDocument,
    };
  }, [
    db,
    ready,
    currentUser,
    currentOrg,
    assistantOpen,
    resetSeed,
    setAdjustmentStatus,
    setTaskComplete,
    setDiligenceStatus,
    updateFinding,
    acceptFindingAsQuestion,
    uploadDocument,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
