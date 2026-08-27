import { APP_AS_OF, HALE_DEAL_ID, MILLER_DEAL_ID } from "./constants";
import { getDealView, getPortfolioMetrics, isActiveStage, listDealViews } from "./derived";
import {
  formatDate,
  formatMargin,
  formatMoneyCompact,
  formatMoneyExact,
  formatMultiple,
  formatPercentPoints,
  formatRelative,
  mondayOnOrBefore,
} from "./format";
import {
  ADJUSTMENT_CATEGORY_LABELS,
  CLAIM_KIND_LABELS,
  DILIGENCE_STATUS_LABELS,
  STAGE_LABELS,
} from "./constants";
import type { Database, DealView } from "./types";

export type CitationKind = "source_fact" | "approved_assumption" | "ai_inference";

export interface AssistantCitation {
  kind: CitationKind;
  label: string;
  detail: string;
}

export interface AssistantAnswer {
  title: string;
  summary: string;
  bullets: string[];
  citations: AssistantCitation[];
  matched: boolean;
}

function cite(
  kind: CitationKind,
  label: string,
  detail: string
): AssistantCitation {
  return { kind, label, detail };
}

function normalize(q: string) {
  return q.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
}

function dealNameMatch(q: string, name: string) {
  const n = name.toLowerCase();
  return q.includes(n) || n.split(/\s+/).some((part) => part.length > 3 && q.includes(part));
}

export function answerAssistant(
  db: Database,
  rawQuery: string,
  currentDealId?: string | null
): AssistantAnswer {
  const q = normalize(rawQuery);
  if (!q) {
    return {
      title: "Ask about the book",
      summary:
        "I only answer from the Northline store — seed facts, approved assumptions, and labeled inferences. I will not invent numbers.",
      bullets: [
        "Which deals need my attention today?",
        "Why did Hale & Mercer's adjusted EBITDA change?",
        "Compare the economics of our deals currently in diligence.",
        "What are we still waiting on from Miller Law?",
      ],
      citations: [],
      matched: false,
    };
  }

  if (
    /need(s)? (my )?attention|attention today|what('s| is) on fire|morning brief/.test(q)
  ) {
    return attentionAnswer(db);
  }
  if (
    /why.*(hale|mercer).*(ebitda|adjusted|normalization|bridge)/.test(q) ||
    /(hale|mercer).*(adjusted ebitda|ebitda change|bridge)/.test(q)
  ) {
    return haleBridgeAnswer(db);
  }
  if (/compare.*diligence|economics.*diligence|deals (currently )?in diligence/.test(q)) {
    return diligenceCompareAnswer(db);
  }
  if (/waiting on|outstanding|still need/.test(q) && /miller/.test(q)) {
    return millerWaitingAnswer(db);
  }
  if (/adjustment.*>\s*\$?100|above \$100|over \$100|100k/.test(q)) {
    return largeAdjustmentsAnswer(db);
  }
  if (
    /what diligence questions|questions should we ask|ask hale/.test(q) &&
    /hale|mercer/.test(q)
  ) {
    return haleQuestionsAnswer(db);
  }
  if (
    /changed|since monday|what('s| has) changed|everything that('s| has) changed/.test(q)
  ) {
    return changesSinceMondayAnswer(db, currentDealId);
  }
  if (/concentration|highest revenue concentration/.test(q)) {
    return concentrationAnswer(db);
  }

  return fallbackAnswer(db, q, currentDealId);
}

function attentionAnswer(db: Database): AssistantAnswer {
  const portfolio = getPortfolioMetrics(db);
  const items = portfolio.attention.slice(0, 10);
  return {
    title: "Needs attention today",
    summary: `${items.length} open attention items across ${portfolio.activeDeals} active deals. Ranked from overdue diligence and inconsistencies first. As-of ${formatDate(APP_AS_OF)}.`,
    bullets: items.map(
      (item) => `${item.dealName} — ${item.label}: ${item.detail}`
    ),
    citations: [
      cite(
        "source_fact",
        "Pipeline activity and request dates",
        "Last activity, diligence due dates, and flags on each deal record"
      ),
      cite(
        "ai_inference",
        "Attention ranking",
        "Overdue > inconsistency > missing document > upcoming deadline > stale (>14 days)"
      ),
    ],
    matched: true,
  };
}

function haleBridgeAnswer(db: Database): AssistantAnswer {
  const hale = getDealView(db, HALE_DEAL_ID);
  if (!hale) return unknownDeal("Hale & Mercer");
  const accepted = hale.adjustments.filter((a) => a.status === "accepted");
  const proposed = hale.adjustments.filter((a) => a.status === "proposed");
  return {
    title: "Hale & Mercer adjusted EBITDA",
    summary: `TTM 2025 reported EBITDA is ${formatMoneyExact(hale.reportedEbitda)}. Normalized (accepted only, excluding synergies) is ${formatMoneyExact(hale.normalizedEbitda)}. Pro forma (accepted + proposed, including synergies) is ${formatMoneyExact(hale.proFormaEbitda)}.`,
    bullets: [
      ...accepted.map(
        (a) =>
          `Accepted ${CLAIM_KIND_LABELS[a.provenance.approval_status]}: ${a.description} ${formatMoneyExact(a.amount)} — ${a.source}`
      ),
      ...proposed.map(
        (a) =>
          `Proposed ${CLAIM_KIND_LABELS[a.provenance.approval_status]}: ${a.description} ${formatMoneyExact(a.amount)} — ${a.source}. Not in normalized.`
      ),
      `Asking price ${formatMoneyExact(hale.purchasePrice)} → ${formatMultiple(hale.impliedMultipleReported)} reported / ${formatMultiple(hale.impliedMultipleNormalized)} normalized / ${formatMultiple(hale.impliedMultipleProForma)} pro forma.`,
    ],
    citations: hale.adjustments.map((a) =>
      cite(
        a.provenance.approval_status,
        a.description,
        `${a.source}${a.provenance.source_document_name ? ` · ${a.provenance.source_document_name}` : ""}`
      )
    ),
    matched: true,
  };
}

function diligenceCompareAnswer(db: Database): AssistantAnswer {
  const views = listDealViews(db).filter((v) =>
    ["diligence", "confirmatory_diligence"].includes(v.deal.stage)
  );
  return {
    title: "Deals in diligence",
    summary: `${views.length} live diligence processes (Diligence + Confirmatory). Economics below are from the latest period on each deal.`,
    bullets: views.map((v) => {
      return `${v.deal.name} (${STAGE_LABELS[v.deal.stage]}): ${formatMoneyCompact(v.revenue)} rev · ${formatMoneyCompact(v.reportedEbitda)} reported / ${formatMoneyCompact(v.normalizedEbitda)} normalized · ${formatMultiple(v.headerMultiple)} · ${v.diligencePct}% diligence · ${formatMoneyCompact(v.purchasePrice)} @ ${Math.round(v.deal.probability * 100)}%`;
    }),
    citations: [
      cite("source_fact", "Latest financial periods", "Reported revenue and EBITDA from uploaded P&Ls"),
      cite(
        "approved_assumption",
        "Normalized EBITDA",
        "Reported + accepted add-backs; synergies excluded"
      ),
    ],
    matched: true,
  };
}

function millerWaitingAnswer(db: Database): AssistantAnswer {
  const miller = getDealView(db, MILLER_DEAL_ID);
  if (!miller) return unknownDeal("Miller Law Group");
  const waiting = miller.diligence.filter(
    (r) => !["complete", "na"].includes(r.status)
  );
  return {
    title: "Waiting on Miller Law Group",
    summary: `${waiting.length} open confirmatory items. Seller contacts: ${miller.contacts.map((c) => c.name).join(", ")}.`,
    bullets: waiting.map(
      (r) =>
        `${DILIGENCE_STATUS_LABELS[r.status]} — ${r.question}${r.due_date ? ` (due ${formatDate(r.due_date)})` : ""}${r.counterparty_owner ? ` · ${r.counterparty_owner}` : ""}`
    ),
    citations: [
      cite(
        "source_fact",
        "Diligence request records",
        "Client list, 2025 tax return, malpractice claims history are the named outstanding items"
      ),
    ],
    matched: true,
  };
}

function largeAdjustmentsAnswer(db: Database): AssistantAnswer {
  const rows = db.ebitda_adjustments
    .filter((a) => Math.abs(a.amount) >= 100_000)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  return {
    title: "EBITDA adjustments ≥ $100k",
    summary: `${rows.length} adjustments in the store are at or above $100,000. Status is live — accepted items are in normalized (except synergies).`,
    bullets: rows.map((a) => {
      const deal = db.deals.find((d) => d.id === a.deal_id);
      return `${deal?.name ?? a.deal_id}: ${a.description} ${formatMoneyExact(a.amount)} · ${ADJUSTMENT_CATEGORY_LABELS[a.category]} · ${a.status} · ${a.origin === "ai" ? "AI-proposed" : "manual"}`;
    }),
    citations: rows.map((a) =>
      cite(
        a.status === "accepted" ? "approved_assumption" : "ai_inference",
        a.description,
        a.source
      )
    ),
    matched: true,
  };
}

function haleQuestionsAnswer(db: Database): AssistantAnswer {
  const hale = getDealView(db, HALE_DEAL_ID);
  if (!hale) return unknownDeal("Hale & Mercer");
  const openFindings = hale.findings.filter((f) => f.status === "open");
  const openRequests = hale.diligence.filter(
    (r) => !["complete", "na"].includes(r.status)
  );
  return {
    title: "Questions for Hale & Mercer",
    summary: `${openFindings.length} open AI findings and ${openRequests.length} open diligence requests. Findings are inferences until accepted onto the request list.`,
    bullets: [
      ...openFindings.map((f) => `Finding — ${f.edited_question ?? f.question}`),
      ...openRequests.slice(0, 8).map((r) => `Request (${DILIGENCE_STATUS_LABELS[r.status]}) — ${r.question}`),
    ],
    citations: [
      ...openFindings.map((f) =>
        cite(
          "ai_inference",
          f.title,
          f.provenance.source_document_name ?? "AI finding"
        )
      ),
      cite("source_fact", "Diligence request list", "Status and owners as stored"),
    ],
    matched: true,
  };
}

function changesSinceMondayAnswer(
  db: Database,
  currentDealId?: string | null
): AssistantAnswer {
  const monday = mondayOnOrBefore(APP_AS_OF);
  const dealId = currentDealId ?? HALE_DEAL_ID;
  const view = getDealView(db, dealId);
  if (!view) return unknownDeal(dealId);
  const changes = view.activities.filter((a) => a.occurred_at.slice(0, 10) >= monday);
  return {
    title: `Changes on ${view.deal.name} since Monday`,
    summary: `Monday is ${formatDate(monday)}. ${changes.length} activity events on or after that date. I am not inferring anything that is not in the activity log.`,
    bullets:
      changes.length === 0
        ? ["No stored activity on this deal since Monday."]
        : changes.map(
            (a) => `${formatRelative(a.occurred_at)} — ${a.title}${a.body ? `: ${a.body}` : ""}`
          ),
    citations: [
      cite("source_fact", "Activity log", `Deal ${view.deal.name}, occurred_at ≥ ${monday}`),
    ],
    matched: true,
  };
}

function concentrationAnswer(db: Database): AssistantAnswer {
  const rows = listDealViews(db)
    .filter((v) => isActiveStage(v.deal.stage))
    .map((v) => ({
      view: v,
      top3: Number(v.deal.vertical_metrics.revenue_concentration_top3 ?? 0),
      top2: Number(v.deal.vertical_metrics.revenue_concentration_top2 ?? 0),
    }))
    .sort((a, b) => (b.top2 || b.top3) - (a.top2 || a.top3));

  return {
    title: "Revenue concentration risk",
    summary:
      "Concentration is stored on each deal's vertical_metrics profile (not a first-class column). Active targets only.",
    bullets: rows.map(({ view, top3, top2 }) => {
      const largest = view.deal.vertical_metrics.revenue_by_attorney?.[0];
      return `${view.deal.name}: top-3 ${formatPercentPoints(top3, 0)}${top2 ? ` · top-2 ${formatPercentPoints(top2, 0)}` : ""}${largest ? ` · largest ${largest.name} ${formatPercentPoints(largest.share, 0)}` : ""}`;
    }),
    citations: [
      cite(
        "source_fact",
        "vertical_metrics.revenue_concentration_top3",
        "Attorney production / CIM where a production file exists; otherwise banker representation"
      ),
    ],
    matched: true,
  };
}

function fallbackAnswer(
  db: Database,
  q: string,
  currentDealId?: string | null
): AssistantAnswer {
  const views = listDealViews(db);
  const mentioned = views.filter((v) => dealNameMatch(q, v.deal.name));
  const focus: DealView | null =
    mentioned[0] ??
    (currentDealId ? getDealView(db, currentDealId) : null) ??
    null;

  if (/revenue|ebitda|price|multiple/.test(q) && focus) {
    return {
      title: focus.deal.name,
      summary: `I can only speak to stored figures for ${focus.deal.name}. I did not match a specific playbook query, so this is a fact sheet — not a new analysis.`,
      bullets: [
        `${formatMoneyExact(focus.revenue)} revenue · ${formatMoneyExact(focus.reportedEbitda)} reported EBITDA · ${formatMargin(focus.latest?.ebitdaMargin ?? null)} margin`,
        `Normalized ${formatMoneyExact(focus.normalizedEbitda)} (accepted only) · Pro forma ${formatMoneyExact(focus.proFormaEbitda)}`,
        `Price ${formatMoneyExact(focus.purchasePrice)} · ${formatMultiple(focus.headerMultiple)} on pro forma · ${STAGE_LABELS[focus.deal.stage]}`,
      ],
      citations: [
        cite("source_fact", "Latest period", focus.latest?.period.label ?? "n/a"),
        cite("approved_assumption", "Normalized EBITDA", "Accepted add-backs only"),
      ],
      matched: false,
    };
  }

  return {
    title: "Outside the query router",
    summary:
      "That question is not one of the playbook routes, and I will not invent an answer. I can report from the known book instead.",
    bullets: [
      `${getPortfolioMetrics(db).activeDeals} active deals; ${getPortfolioMetrics(db).attention.length} attention items.`,
      `Known firms: ${views.map((v) => v.deal.name).join(", ")}.`,
      "Try: attention today · Hale EBITDA bridge · diligence economics · waiting on Miller · adjustments above $100k · Hale questions · changes since Monday · concentration risk.",
    ],
    citations: [
      cite("source_fact", "Seed + live store", "No live LLM. Deterministic router only."),
    ],
    matched: false,
  };
}

function unknownDeal(name: string): AssistantAnswer {
  return {
    title: "Not in the store",
    summary: `${name} is not in the current organization store. I will not estimate it.`,
    bullets: [],
    citations: [],
    matched: false,
  };
}
