import { ALEX_USER_ID, GIOVANNI_USER_ID } from "./constants";
import { displayEvidencePath } from "./paths";
import type {
  Database,
  EvaluationEvent,
  QueueItem,
  QueueKind,
  QueuePriority,
} from "./types";

export type QueueFilter =
  | "all"
  | QueueKind
  | "assigned_to_me"
  | "assigned_to_giovanni"
  | "assigned_by_alex";

function dealName(db: Database, dealId: string) {
  return db.deals.find((d) => d.id === dealId)?.name ?? dealId;
}

function priFromMissing(p: string): QueuePriority {
  if (p === "blocking") return "critical";
  if (p === "high" || p === "critical") return p;
  if (p === "medium") return "medium";
  return "low";
}

export function buildQueue(db: Database, currentUserId: string): QueueItem[] {
  const items: QueueItem[] = [];

  for (const ev of db.evidence_items) {
    if (ev.human_review_status !== "unreviewed") continue;
    if (ev.processing_status === "analyzed" && ev.confidence != null && ev.confidence >= 0.9) continue;
    const needsClass =
      ev.human_review_status === "unreviewed" &&
      (ev.confidence == null || ev.confidence < 0.85 || ev.potential_duplicate_of || ev.superseded_by_id);
    if (!needsClass) continue;
    items.push({
      id: `q_class_${ev.id}`,
      kind: "classification",
      dealId: ev.deal_id,
      dealName: dealName(db, ev.deal_id),
      title: displayEvidencePath(ev),
      whyItMatters: ev.superseded_by_id
        ? "Revised version detected — confirm which file is current."
        : ev.potential_duplicate_of
          ? "Possible duplicate — confirm before extraction is accepted."
          : "Classification is uncertain. Confirm type/period before facts can be trusted.",
      priority: ev.superseded_by_id || ev.potential_duplicate_of ? "high" : "medium",
      href: `/deals/${ev.deal_id}/intake`,
      evidenceHref: `/deals/${ev.deal_id}/evidence`,
      assignedUserId: null,
      assignedByUserId: null,
      preparedByUserId: null,
      reviewerUserId: null,
      statusLabel: ev.processing_status,
      entityType: "evidence_item",
      entityId: ev.id,
      occurredAt: ev.ingested_at,
      actions: ["open"],
    });
  }

  for (const fact of db.extracted_facts) {
    if (fact.review_status !== "pending") continue;
    items.push({
      id: `q_fact_${fact.id}`,
      kind: "extraction",
      dealId: fact.deal_id,
      dealName: dealName(db, fact.deal_id),
      title: fact.label,
      whyItMatters:
        fact.conflicting_fact_ids.length > 0
          ? "Conflicts with another extraction. Do not auto-accept into reported/normalized."
          : "Extracted fact is pending. Accepting it does not silently rewrite accepted financials.",
      priority: fact.conflicting_fact_ids.length > 0 ? "high" : "medium",
      href: `/deals/${fact.deal_id}/intake`,
      evidenceHref: `/deals/${fact.deal_id}/intake`,
      assignedUserId: fact.assigned_user_id,
      assignedByUserId: fact.assigned_by_user_id ?? null,
      preparedByUserId: fact.prepared_by_user_id ?? null,
      reviewerUserId: fact.reviewer_user_id ?? null,
      statusLabel: fact.review_status,
      entityType: "extracted_fact",
      entityId: fact.id,
      occurredAt: db.extractions.find((e) => e.id === fact.extraction_id)?.completed_at ??
        db.deals.find((d) => d.id === fact.deal_id)?.last_activity_at ??
        "",
      actions: ["open", "assign", "approve", "edit", "reject"],
    });
  }

  for (const conflict of db.conflicts) {
    if (["resolved", "accepted_difference", "not_material"].includes(conflict.status)) continue;
    items.push({
      id: `q_cf_${conflict.id}`,
      kind: "reconciliation",
      dealId: conflict.deal_id,
      dealName: dealName(db, conflict.deal_id),
      title: conflict.description,
      whyItMatters: conflict.ai_interpretation,
      priority:
        conflict.materiality === "deal_breaking" || conflict.materiality === "material"
          ? "critical"
          : conflict.materiality === "notable"
            ? "high"
            : "medium",
      href: `/deals/${conflict.deal_id}/intake`,
      evidenceHref: `/deals/${conflict.deal_id}/evidence`,
      assignedUserId: conflict.owner_user_id,
      assignedByUserId: conflict.assigned_by_user_id ?? null,
      preparedByUserId: conflict.prepared_by_user_id ?? null,
      reviewerUserId: conflict.reviewer_user_id ?? null,
      statusLabel: conflict.status,
      entityType: "conflict",
      entityId: conflict.id,
      occurredAt: db.deals.find((d) => d.id === conflict.deal_id)?.last_activity_at ?? "",
      actions: ["open", "assign", "send_to_diligence"],
    });
  }

  for (const adj of db.ebitda_adjustments) {
    if (adj.status !== "proposed" && adj.status !== "needs_review") continue;
    items.push({
      id: `q_adj_${adj.id}`,
      kind: "adjustment",
      dealId: adj.deal_id,
      dealName: dealName(db, adj.deal_id),
      title: adj.description,
      whyItMatters:
        adj.status === "needs_review"
          ? "Flagged for review. Not in Normalized and not in Pro forma."
          : "Proposed only. Accepting is the only way this enters Normalized (except synergy).",
      priority: adj.category === "synergy" || adj.category === "occupancy" ? "high" : "medium",
      href: `/deals/${adj.deal_id}/financials`,
      assignedUserId: null,
      assignedByUserId: null,
      preparedByUserId: null,
      reviewerUserId: null,
      statusLabel: adj.status,
      entityType: "ebitda_adjustment",
      entityId: adj.id,
      occurredAt: db.deals.find((d) => d.id === adj.deal_id)?.last_activity_at ?? "",
      actions: ["open", "approve", "reject"],
    });
  }

  for (const miss of db.missing_items) {
    if (miss.status !== "open") continue;
    items.push({
      id: `q_miss_${miss.id}`,
      kind: "missing",
      dealId: miss.deal_id,
      dealName: dealName(db, miss.deal_id),
      title: miss.title,
      whyItMatters: miss.why_it_matters,
      priority: priFromMissing(miss.priority),
      href: `/deals/${miss.deal_id}/intake`,
      assignedUserId: miss.assigned_user_id ?? null,
      assignedByUserId: miss.assigned_by_user_id ?? null,
      preparedByUserId: null,
      reviewerUserId: null,
      statusLabel: miss.status,
      entityType: "missing_item",
      entityId: miss.id,
      occurredAt: db.deals.find((d) => d.id === miss.deal_id)?.last_activity_at ?? "",
      actions: ["open", "assign", "send_to_diligence"],
    });
    items.push({
      id: `q_ask_${miss.id}`,
      kind: "seller_question",
      dealId: miss.deal_id,
      dealName: dealName(db, miss.deal_id),
      title: miss.suggested_seller_request,
      whyItMatters: miss.why_it_matters,
      priority: priFromMissing(miss.priority),
      href: `/deals/${miss.deal_id}/diligence`,
      assignedUserId: miss.assigned_user_id ?? null,
      assignedByUserId: miss.assigned_by_user_id ?? null,
      preparedByUserId: null,
      reviewerUserId: null,
      statusLabel: miss.status,
      entityType: "missing_item",
      entityId: miss.id,
      occurredAt: db.deals.find((d) => d.id === miss.deal_id)?.last_activity_at ?? "",
      actions: ["open", "send_to_diligence"],
    });
  }

  for (const rec of db.recommendations) {
    if (rec.review_status !== "pending_review") continue;
    items.push({
      id: `q_rec_${rec.id}`,
      kind: "extraction",
      dealId: rec.deal_id,
      dealName: dealName(db, rec.deal_id),
      title: rec.title,
      whyItMatters: rec.body,
      priority: "high",
      href: `/deals/${rec.deal_id}/valuation`,
      assignedUserId: rec.assigned_user_id ?? null,
      assignedByUserId: rec.assigned_by_user_id ?? null,
      preparedByUserId: rec.prepared_by_user_id ?? null,
      reviewerUserId: rec.reviewer_user_id ?? null,
      statusLabel: rec.review_status,
      entityType: "recommendation",
      entityId: rec.id,
      occurredAt: db.deals.find((d) => d.id === rec.deal_id)?.last_activity_at ?? "",
      actions: ["open", "approve", "edit", "reject"],
    });
  }

  const awaiting = supervisorReviewItems(db);
  items.push(...awaiting);

  const user = db.users.find((u) => u.id === currentUserId);
  const lastSeen = user?.last_seen_at;
  if (lastSeen) {
    for (const act of db.activities) {
      if (act.occurred_at <= lastSeen) continue;
      if (act.actor_user_id === currentUserId) continue;
      items.push({
        id: `q_since_${act.id}`,
        kind: "since_last_login",
        dealId: act.deal_id,
        dealName: dealName(db, act.deal_id),
        title: act.title,
        whyItMatters: act.body,
        priority: "medium",
        href: `/deals/${act.deal_id}/activity`,
        assignedUserId: null,
        assignedByUserId: null,
        preparedByUserId: act.actor_user_id,
        reviewerUserId: null,
        statusLabel: "new",
        entityType: "activity",
        entityId: act.id,
        occurredAt: act.occurred_at,
        actions: ["open"],
      });
    }
  }

  return items.sort((a, b) => rank(b.priority) - rank(a.priority) || b.occurredAt.localeCompare(a.occurredAt));
}

function supervisorReviewItems(db: Database): QueueItem[] {
  const items: QueueItem[] = [];
  const evalsNeedingReview = db.evaluation_events.filter(
    (e) => e.preparer_user_id === GIOVANNI_USER_ID && !e.reviewer_user_id
  );
  for (const ev of evalsNeedingReview) {
    items.push({
      id: `q_sup_${ev.id}`,
      kind: "awaiting_supervisor",
      dealId: ev.deal_id,
      dealName: dealName(db, ev.deal_id),
      title: `${ev.analyst_action} · ${ev.financial_context ?? ev.entity_type}`,
      whyItMatters: ev.final_resolution,
      priority: ev.analyst_action === "rejected" || ev.analyst_action === "edited" ? "high" : "medium",
      href: `/evals?deal=${ev.deal_id}`,
      assignedUserId: ALEX_USER_ID,
      assignedByUserId: null,
      preparedByUserId: ev.preparer_user_id,
      reviewerUserId: ev.reviewer_user_id,
      statusLabel: "awaiting Alex",
      entityType: "evaluation_event",
      entityId: ev.id,
      occurredAt: ev.occurred_at,
      actions: ["open", "approve"],
    });
  }
  return items;
}

function rank(p: QueuePriority) {
  return p === "critical" ? 4 : p === "high" ? 3 : p === "medium" ? 2 : 1;
}

export function filterQueue(
  items: QueueItem[],
  filter: QueueFilter,
  currentUserId: string
): QueueItem[] {
  if (filter === "all") return items.filter((i) => i.kind !== "since_last_login");
  if (filter === "assigned_to_me") {
    return items.filter((i) => i.assignedUserId === currentUserId && i.kind !== "since_last_login");
  }
  if (filter === "assigned_to_giovanni") {
    return items.filter((i) => i.assignedUserId === GIOVANNI_USER_ID && i.kind !== "since_last_login");
  }
  if (filter === "assigned_by_alex") {
    return items.filter((i) => i.assignedByUserId === ALEX_USER_ID && i.kind !== "since_last_login");
  }
  return items.filter((i) => i.kind === filter);
}

export function queueCounts(items: QueueItem[], currentUserId: string) {
  const kinds: QueueFilter[] = [
    "classification",
    "extraction",
    "reconciliation",
    "adjustment",
    "missing",
    "seller_question",
    "assigned_to_me",
    "assigned_to_giovanni",
    "assigned_by_alex",
    "since_last_login",
    "awaiting_supervisor",
  ];
  const counts: Record<string, number> = { all: items.filter((i) => i.kind !== "since_last_login").length };
  for (const kind of kinds) {
    counts[kind] = filterQueue(items, kind, currentUserId).length;
  }
  return counts;
}

export function evaluationsForDeal(db: Database, dealId?: string): EvaluationEvent[] {
  const rows = dealId ? db.evaluation_events.filter((e) => e.deal_id === dealId) : db.evaluation_events;
  return [...rows].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}
