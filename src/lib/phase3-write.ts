import { APP_AS_OF, CURRENT_USER_ID } from "./constants";
import type {
  ChangeEvent,
  Database,
  EvaluationAction,
  EvaluationEvent,
} from "./types";

function nowIso() {
  return `${APP_AS_OF}T${new Date().toISOString().slice(11)}`;
}

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

let actorOverride: string | null = null;

export function withActor<T>(actorId: string, fn: () => T): T {
  const prev = actorOverride;
  actorOverride = actorId;
  try {
    return fn();
  } finally {
    actorOverride = prev;
  }
}

export function actorId() {
  return actorOverride ?? CURRENT_USER_ID;
}

export interface EvaluationDraft {
  entity_type: string;
  entity_id: string;
  deal_id: string;
  organization_id: string;
  document_type?: string | null;
  financial_context?: string | null;
  initial_system_output: string;
  analyst_action: EvaluationAction;
  corrected_answer?: string | null;
  why_original_was_wrong?: string | null;
  controlling_source?: string | null;
  time_saved_minutes?: number | null;
  final_resolution: string;
  preparer_user_id?: string | null;
  reviewer_user_id?: string | null;
}

export function makeEvaluation(draft: EvaluationDraft): EvaluationEvent {
  return {
    id: newId("eval"),
    organization_id: draft.organization_id,
    deal_id: draft.deal_id,
    entity_type: draft.entity_type,
    entity_id: draft.entity_id,
    document_type: draft.document_type ?? null,
    financial_context: draft.financial_context ?? null,
    initial_system_output: draft.initial_system_output,
    analyst_action: draft.analyst_action,
    corrected_answer: draft.corrected_answer ?? null,
    why_original_was_wrong: draft.why_original_was_wrong ?? null,
    controlling_source: draft.controlling_source ?? null,
    time_saved_minutes: draft.time_saved_minutes ?? null,
    final_resolution: draft.final_resolution,
    preparer_user_id: draft.preparer_user_id ?? actorId(),
    reviewer_user_id: draft.reviewer_user_id ?? null,
    occurred_at: nowIso(),
  };
}

export function makeChangeEvent(
  organizationId: string,
  dealId: string,
  eventType: string,
  payload: Record<string, unknown>
): ChangeEvent {
  return {
    id: newId("chg"),
    organization_id: organizationId,
    deal_id: dealId,
    event_type: eventType,
    payload: { ...payload, actor_user_id: actorId() },
    created_at: nowIso(),
  };
}

export function appendPhase3Events(
  prev: Database,
  evaluation?: EvaluationEvent | null,
  change?: ChangeEvent | null
): Pick<Database, "evaluation_events" | "change_events"> {
  return {
    evaluation_events: evaluation
      ? [evaluation, ...prev.evaluation_events]
      : prev.evaluation_events,
    change_events: change ? [change, ...prev.change_events] : prev.change_events,
  };
}
