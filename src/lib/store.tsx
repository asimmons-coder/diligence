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
import { APP_AS_OF, CURRENT_USER_ID, CURRENT_USER_KEY, STORE_KEY } from "./constants";
import {
  getDealView,
  getPortfolioMetrics,
  listDealViews,
  searchDeals,
} from "./derived";
import { ensureDatabase } from "./empty-evidence";
import { withActor } from "./phase3-write";
import { cloneSeed } from "./seed";
import {
  applyAdjustmentStatus,
  applyAdvanceProcessing,
  applyAssign,
  applyBaselinePatch,
  applyConflictStatus,
  applyConvertConflict,
  applyCreateDeal,
  applyEvidenceCorrection,
  applyFactReview,
  applyHaleMessyHydrate,
  applyIngestFilenames,
  applyInterpretation,
  applyMarkReviewed,
  applyPackageExport,
  applyRecommendationReview,
  applySendMissing,
  applySupervisorApprove,
  applySwitchUser,
  applyValuationPatch,
  createDealRecord,
  type EvaluationInput,
} from "./store-actions";
import type {
  AdjustmentStatus,
  AiFinding,
  ConflictStatus,
  Database,
  Deal,
  DetectedDocumentType,
  DiligenceStatus,
  DocumentFolder,
  EvidenceHumanReview,
  FactReviewStatus,
  FindingStatus,
  IngestFile,
  PostCloseBaseline,
  RecommendationReview,
  ValuationScenario,
  Vertical,
} from "./types";

export interface StoreApi {
  db: Database;
  ready: boolean;
  currentUser: Database["users"][number];
  currentUserId: string;
  currentOrg: Database["organizations"][number];
  assistantOpen: boolean;
  setAssistantOpen: (open: boolean) => void;
  switchUser: (userId: string) => void;
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
  createDeal: (input: {
    name: string;
    vertical: Vertical;
    ownerId: string;
    city?: string;
    state?: string;
    sourceDetail?: string;
    askingPrice?: number | null;
  }) => Deal;
  ingestFilenames: (dealId: string, files: Array<string | IngestFile>) => { hydrated: boolean };
  loadHaleMessyFolder: (dealId: string) => void;
  correctEvidence: (
    id: string,
    patch: {
      detected_type?: DetectedDocumentType;
      detected_period?: string | null;
      detected_entity?: string | null;
      human_review_status?: EvidenceHumanReview;
    }
  ) => void;
  reviewFact: (
    id: string,
    status: FactReviewStatus,
    edits?: {
      numeric_value?: number;
      text_value?: string;
      extracted_value?: string;
      assigned_user_id?: string | null;
    },
    evaluation?: EvaluationInput
  ) => void;
  setConflictStatus: (
    id: string,
    status: ConflictStatus,
    notes?: string,
    evaluation?: EvaluationInput
  ) => void;
  convertConflict: (id: string, kind: "diligence" | "adjustment" | "task") => void;
  sendMissingToDiligence: (id: string) => void;
  reviewInterpretation: (id: string, decision: "approved" | "dismissed") => void;
  updateValuationScenario: (id: string, patch: Partial<ValuationScenario>) => void;
  markDealReviewed: (dealId: string) => void;
  assignItem: (entityType: string, entityId: string, userId: string) => void;
  approvePrepared: (evaluationId: string) => void;
  reviewRecommendation: (
    id: string,
    status: RecommendationReview,
    evaluation?: EvaluationInput
  ) => void;
  updateBaseline: (dealId: string, patch: Partial<PostCloseBaseline>) => void;
  recordPackageExport: (dealId: string, kind: "xlsx" | "pdf" | "json") => void;
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
  const [currentUserId, setCurrentUserId] = useState(CURRENT_USER_ID);

  useEffect(() => {
    let next = cloneSeed();
    let userId = CURRENT_USER_ID;
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Database;
        if (parsed?.deals?.length && parsed?.organizations?.length) {
          next = ensureDatabase(parsed);
        }
      }
      const savedUser = localStorage.getItem(CURRENT_USER_KEY);
      if (savedUser && next.users.some((u) => u.id === savedUser)) {
        userId = savedUser;
      }
    } catch {
      next = cloneSeed();
    }
    queueMicrotask(() => {
      setDb(next);
      setCurrentUserId(userId);
      setReady(true);
    });
  }, []);

  const commit = useCallback((updater: (prev: Database) => Database) => {
    setDb((prev) => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }, []);

  const run = useCallback(
    (fn: (prev: Database) => Database) => {
      commit((prev) => withActor(currentUserId, () => fn(prev)));
    },
    [commit, currentUserId]
  );

  const currentUser = db.users.find((u) => u.id === currentUserId) ?? db.users[0];
  const currentOrg = db.organizations[0];

  const setAdjustmentStatus = useCallback<StoreApi["setAdjustmentStatus"]>(
    (id, status, notes) => {
      run((prev) => applyAdjustmentStatus(prev, id, status, notes));
    },
    [run]
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
              actor_user_id: currentUserId,
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
    [commit, currentUserId]
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
              actor_user_id: currentUserId,
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
              actor_user_id: currentUserId,
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
    [commit, currentUserId]
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
              actor_user_id: currentUserId,
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
    [commit, currentUserId]
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
              owner_user_id: existing.assigned_user_id ?? currentUserId,
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
              actor_user_id: currentUserId,
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
    [commit, currentUserId]
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
              uploaded_by: currentUserId,
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
              actor_user_id: currentUserId,
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
              actor_user_id: currentUserId,
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
    [commit, currentUserId]
  );

  const createDeal = useCallback<StoreApi["createDeal"]>((input) => {
    const deal = createDealRecord(input);
    run((prev) => applyCreateDeal(prev, deal));
    return deal;
  }, [run]);

  const ingestFilenames = useCallback<StoreApi["ingestFilenames"]>((dealId, filenames) => {
    let hydrated = false;
    run((prev) => {
      const result = applyIngestFilenames(prev, dealId, filenames);
      hydrated = result.hydrated;
      return result.next;
    });
    if (!hydrated) {
      window.setTimeout(() => {
        run((prev) => applyAdvanceProcessing(prev, dealId, "processing"));
      }, 700);
      window.setTimeout(() => {
        run((prev) => applyAdvanceProcessing(prev, dealId, "analyzed"));
      }, 1600);
    }
    return { hydrated };
  }, [run]);

  const loadHaleMessyFolder = useCallback<StoreApi["loadHaleMessyFolder"]>(
    (dealId) => {
      run((prev) => applyHaleMessyHydrate(prev, dealId));
    },
    [run]
  );

  const correctEvidence = useCallback<StoreApi["correctEvidence"]>(
    (id, patch) => {
      run((prev) => applyEvidenceCorrection(prev, id, patch));
    },
    [run]
  );

  const reviewFact = useCallback<StoreApi["reviewFact"]>(
    (id, status, edits, evaluation) => {
      run((prev) => applyFactReview(prev, id, status, edits, evaluation));
    },
    [run]
  );

  const setConflictStatus = useCallback<StoreApi["setConflictStatus"]>(
    (id, status, notes, evaluation) => {
      run((prev) => applyConflictStatus(prev, id, status, notes, evaluation));
    },
    [run]
  );

  const convertConflict = useCallback<StoreApi["convertConflict"]>(
    (id, kind) => {
      run((prev) => applyConvertConflict(prev, id, kind));
    },
    [run]
  );

  const sendMissingToDiligence = useCallback<StoreApi["sendMissingToDiligence"]>(
    (id) => {
      run((prev) => applySendMissing(prev, id));
    },
    [run]
  );

  const reviewInterpretation = useCallback<StoreApi["reviewInterpretation"]>(
    (id, decision) => {
      run((prev) => applyInterpretation(prev, id, decision));
    },
    [run]
  );

  const updateValuationScenario = useCallback<StoreApi["updateValuationScenario"]>(
    (id, patch) => {
      run((prev) => applyValuationPatch(prev, id, patch));
    },
    [run]
  );

  const markDealReviewed = useCallback<StoreApi["markDealReviewed"]>(
    (dealId) => {
      run((prev) => applyMarkReviewed(prev, dealId));
    },
    [run]
  );

  const assignItem = useCallback<StoreApi["assignItem"]>(
    (entityType, entityId, userId) => {
      run((prev) => applyAssign(prev, entityType, entityId, userId));
    },
    [run]
  );

  const approvePrepared = useCallback<StoreApi["approvePrepared"]>(
    (evaluationId) => {
      run((prev) => applySupervisorApprove(prev, evaluationId));
    },
    [run]
  );

  const reviewRecommendation = useCallback<StoreApi["reviewRecommendation"]>(
    (id, status, evaluation) => {
      run((prev) => applyRecommendationReview(prev, id, status, evaluation));
    },
    [run]
  );

  const updateBaseline = useCallback<StoreApi["updateBaseline"]>(
    (dealId, patch) => {
      run((prev) => applyBaselinePatch(prev, dealId, patch));
    },
    [run]
  );

  const recordPackageExport = useCallback<StoreApi["recordPackageExport"]>(
    (dealId, kind) => {
      run((prev) => applyPackageExport(prev, dealId, kind));
    },
    [run]
  );

  const switchUser = useCallback<StoreApi["switchUser"]>(
    (userId) => {
      const from = currentUserId;
      run((prev) => applySwitchUser(prev, from, userId));
      setCurrentUserId(userId);
      try {
        localStorage.setItem(CURRENT_USER_KEY, userId);
      } catch {
        /* ignore */
      }
    },
    [run, currentUserId]
  );

  const resetSeed = useCallback(() => {
    const next = cloneSeed();
    persist(next);
    setDb(next);
    setCurrentUserId(CURRENT_USER_ID);
    try {
      localStorage.setItem(CURRENT_USER_KEY, CURRENT_USER_ID);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<StoreApi>(() => {
    return {
      db,
      ready,
      currentUser,
      currentUserId,
      currentOrg,
      assistantOpen,
      setAssistantOpen,
      switchUser,
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
      createDeal,
      ingestFilenames,
      loadHaleMessyFolder,
      correctEvidence,
      reviewFact,
      setConflictStatus,
      convertConflict,
      sendMissingToDiligence,
      reviewInterpretation,
      updateValuationScenario,
      markDealReviewed,
      assignItem,
      approvePrepared,
      reviewRecommendation,
      updateBaseline,
      recordPackageExport,
    };
  }, [
    db,
    ready,
    currentUser,
    currentUserId,
    currentOrg,
    assistantOpen,
    resetSeed,
    setAdjustmentStatus,
    setTaskComplete,
    setDiligenceStatus,
    updateFinding,
    acceptFindingAsQuestion,
    uploadDocument,
    createDeal,
    ingestFilenames,
    loadHaleMessyFolder,
    correctEvidence,
    reviewFact,
    setConflictStatus,
    convertConflict,
    sendMissingToDiligence,
    reviewInterpretation,
    updateValuationScenario,
    markDealReviewed,
    assignItem,
    approvePrepared,
    reviewRecommendation,
    updateBaseline,
    recordPackageExport,
    switchUser,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
