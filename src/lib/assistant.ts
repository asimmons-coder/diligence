import { APP_AS_OF, HALE_DEAL_ID, MILLER_DEAL_ID } from "./constants";
import { getDealView, getPortfolioMetrics, isActiveStage, listDealViews } from "./derived";
import { buildScenarioView } from "./derived-evidence";
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
  OVERALL_READINESS_LABELS,
  STAGE_LABELS,
} from "./constants";
import type { Database, DealView, VisualClaimKind } from "./types";

export type CitationKind =
  | "source_fact"
  | "approved_assumption"
  | "ai_inference"
  | VisualClaimKind;

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
        "What is in Giovanni's queue?",
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
  if (/giovanni'?s queue|analyst queue|what is in the queue|queue today/.test(q)) {
    return {
      title: "Analyst queue",
      summary:
        "Giovanni’s daily home is /queue — classification, extraction review, reconciliation, proposed adjustments, missing items, and seller questions. Alex reviews completed items without redoing them. Corrections write evaluation events.",
      bullets: [
        "Assigned-to-Giovanni and assigned-by-Alex filters are first-class.",
        "Accept/edit/reject logs why the original was wrong when Giovanni changes an extraction.",
        "Hale Normalized stays $2.495M until a human accepts another add-back.",
      ],
      citations: [
        cite("fact", "Queue", "/queue"),
        cite("assumption", "Hale normalized", "$2,495,000 accepted"),
      ],
      matched: true,
    };
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

  const haleish = /hale|mercer/.test(q) || currentDealId === HALE_DEAL_ID;
  const focusId =
    /hale|mercer/.test(q) ? HALE_DEAL_ID : currentDealId ?? HALE_DEAL_ID;

  if (/what have we received|files (did we |we )?receiv|received for/.test(q)) {
    return receivedAnswer(db, focusId);
  }
  if (/duplicate|supersed/.test(q)) {
    return supersededAnswer(db, focusId);
  }
  if (/reconstruct revenue|last three years|three years/.test(q) && /revenue|ebitda/.test(q)) {
    return reconstructYearsAnswer(db, focusId);
  }
  if (/do not reconcile|doesn't reconcile|not reconcile|discrepan/.test(q)) {
    return conflictsAnswer(db, focusId);
  }
  if (/still missing|what is missing|what information is still/.test(q)) {
    return missingAnswer(db, focusId);
  }
  if (/preventing.*loi|blocking.*loi|issuing an loi|ready for (an )?loi/.test(q)) {
    return blocksLoiAnswer(db, focusId);
  }
  if (/least defensible|weakest adjustment/.test(q)) {
    return leastDefensibleAnswer(db, focusId);
  }
  if (/seller say|professional.services|professional services/.test(q) && haleish) {
    return professionalServicesAnswer(db);
  }
  if (/meeting.*occupancy|occupancy expense|change our view of occupancy/.test(q)) {
    return occupancyMeetingAnswer(db);
  }
  if (/evidence behind.*owner|owner compensation adjustment/.test(q)) {
    return ownerCompEvidenceAnswer(db);
  }
  if (/compare conservative|base, and upside|valuation cases|valuation scenarios/.test(q)) {
    return valuationCompareAnswer(db, focusId);
  }
  if (/assumptions create the valuation gap|valuation gap/.test(q)) {
    return valuationGapAnswer(db, focusId);
  }
  if (/negotiation points|strongest factual support/.test(q)) {
    return negotiationSupportAnswer(db, focusId);
  }
  if (/draft the next seller|next seller diligence request/.test(q)) {
    return draftSellerRequestAnswer(db, focusId);
  }
  if (/5\.5x|5.5 x|purchase price be at/.test(q)) {
    return scenarioMultipleAnswer(db, focusId, 5.5);
  }
  if (/structure could bridge|bridge the valuation gap|without paying for unsupported/.test(q)) {
    return bridgeStructureAnswer(db, focusId);
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
  const digest = view.digest.filter((d) => d.requiresAction).slice(0, 8);
  return {
    title: `Changes on ${view.deal.name} since Monday`,
    summary: `Monday is ${formatDate(monday)}. ${changes.length} activity events on or after that date. Digest items below are linked to evidence and do not rewrite accepted financials unless a human accepted an adjustment.`,
    bullets: [
      ...digest.map(
        (d) =>
          `${d.whatChanged} — ${d.whyItMatters}${d.acceptedFinancialsChanged ? " (accepted financials changed)" : " (accepted financials unchanged)"}`
      ),
      ...(changes.length === 0 && digest.length === 0
        ? ["No stored activity on this deal since Monday."]
        : changes.map(
            (a) => `${formatRelative(a.occurred_at)} — ${a.title}${a.body ? `: ${a.body}` : ""}`
          )),
    ],
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

function haleOr(db: Database, id: string) {
  return getDealView(db, id) ?? getDealView(db, HALE_DEAL_ID);
}

function receivedAnswer(db: Database, dealId: string): AssistantAnswer {
  const view = haleOr(db, dealId);
  if (!view) return unknownDeal(dealId);
  return {
    title: `What we received — ${view.deal.name}`,
    summary: `${view.evidenceItems.length} evidence items in the intake pack. Classification is from filename + seeded metadata.`,
    bullets: view.evidenceItems.map((e) => {
      const flags = [
        e.superseded_by_id ? "superseded" : null,
        e.supersedes_id ? "current version" : null,
        e.potential_duplicate_of ? "possible duplicate" : null,
      ]
        .filter(Boolean)
        .join(", ");
      return `${e.filename ?? e.title} · ${e.detected_type.replaceAll("_", " ")} · ${e.detected_period ?? "n/a"} · ${e.processing_status}${flags ? ` · ${flags}` : ""}`;
    }),
    citations: [
      cite("fact", "Evidence items", "Intake pack on the deal"),
      cite("inference", "Classifier", "Deterministic filename rules — no live LLM"),
    ],
    matched: true,
  };
}

function supersededAnswer(db: Database, dealId: string): AssistantAnswer {
  const view = haleOr(db, dealId);
  if (!view) return unknownDeal(dealId);
  const rows = view.evidenceItems.filter((e) => e.superseded_by_id || e.supersedes_id || e.potential_duplicate_of);
  return {
    title: "Duplicates and superseded files",
    summary: `${rows.length} items are marked duplicate or versioned. P&L 2024 FINAL UPDATED supersedes FINAL. Attorney Production NEW supersedes the first production file.`,
    bullets: rows.map((e) => {
      const other = view.evidenceItems.find(
        (x) => x.id === e.superseded_by_id || x.id === e.supersedes_id || x.id === e.potential_duplicate_of
      );
      return `${e.filename ?? e.title}${other ? ` ↔ ${other.filename}` : ""}`;
    }),
    citations: [cite("conflict", "Document versions", "supersedes_id / potential_duplicate_of")],
    matched: true,
  };
}

function reconstructYearsAnswer(db: Database, dealId: string): AssistantAnswer {
  const view = haleOr(db, dealId);
  if (!view) return unknownDeal(dealId);
  return {
    title: "Reconstructed revenue and reported EBITDA",
    summary:
      "These are the accepted reconstructed years. Intake still shows conflicting extracts (tax cash, superseded FINAL, production) that were not written into this history.",
    bullets: view.periods.map(
      (p) =>
        `${p.period.label}: revenue ${formatMoneyExact(p.revenue)} · reported EBITDA ${formatMoneyExact(p.reportedEbitda)} · margin ${formatMargin(p.ebitdaMargin)}`
    ),
    citations: view.periods.map((p) =>
      cite("fact", p.period.label, "Accepted financial_metrics — not pending extracts")
    ),
    matched: true,
  };
}

function conflictsAnswer(db: Database, dealId: string): AssistantAnswer {
  const view = haleOr(db, dealId);
  if (!view) return unknownDeal(dealId);
  const open = view.conflicts.filter((c) =>
    ["unreviewed", "investigating", "follow_up_required"].includes(c.status)
  );
  return {
    title: "Values that do not reconcile",
    summary: `${open.length} open conflicts. Differences are intentional underwriting stories, not random noise.`,
    bullets: view.conflicts.map(
      (c) =>
        `${c.description} · ${c.value_a != null ? formatMoneyExact(c.value_a) : "—"} vs ${c.value_b != null ? formatMoneyExact(c.value_b) : "—"} · ${c.status.replaceAll("_", " ")}`
    ),
    citations: view.conflicts.map((c) => cite("conflict", c.source_a_label, c.source_b_label)),
    matched: true,
  };
}

function missingAnswer(db: Database, dealId: string): AssistantAnswer {
  const view = haleOr(db, dealId);
  if (!view) return unknownDeal(dealId);
  return {
    title: "Still missing",
    summary: `${view.missingItems.filter((m) => m.status === "open").length} open gaps. Blocking items keep us off a final indication.`,
    bullets: view.missingItems.map(
      (m) =>
        `${m.blocking ? "Blocking" : "Non-blocking"} · ${m.title} — ${m.why_it_matters}`
    ),
    citations: [cite("inference", "Missing-item analysis", "Prioritized against the reconstructed book")],
    matched: true,
  };
}

function blocksLoiAnswer(db: Database, dealId: string): AssistantAnswer {
  const view = haleOr(db, dealId);
  if (!view) return unknownDeal(dealId);
  return {
    title: "What is preventing an LOI",
    summary: `${OVERALL_READINESS_LABELS[view.readiness.overall]}. ${view.readiness.summary}`,
    bullets: view.readiness.dimensions
      .filter((d) => d.status !== "ready")
      .map((d) => `${d.label}: ${d.blockingItems[0] ?? d.nextAction}`),
    citations: [
      cite("assumption", "Readiness model", "Dimensions, not a fake percentage"),
      cite("conflict", "Open conflicts", `${view.openConflictCount} still open`),
    ],
    matched: true,
  };
}

function leastDefensibleAnswer(db: Database, dealId: string): AssistantAnswer {
  const view = haleOr(db, dealId);
  if (!view) return unknownDeal(dealId);
  const ranked = view.adjustments
    .slice()
    .sort((a, b) => (a.confidence ?? 1) - (b.confidence ?? 1));
  return {
    title: "Least defensible EBITDA adjustments",
    summary:
      "Synergy is unsupported. Occupancy is challenged by the latest meeting. Owner add-back is accepted but payroll does not corroborate the P&L line.",
    bullets: ranked.map(
      (a) =>
        `${a.description} ${formatMoneyExact(a.amount)} · ${a.status} · conf ${a.confidence != null ? Math.round(a.confidence * 100) + "%" : "—"} · ${a.source}`
    ),
    citations: ranked.map((a) =>
      cite(
        a.status === "accepted" ? "assumption" : a.status === "proposed" ? "proposed" : "inference",
        a.description,
        a.source
      )
    ),
    matched: true,
  };
}

function professionalServicesAnswer(db: Database): AssistantAnswer {
  const view = getDealView(db, HALE_DEAL_ID);
  if (!view) return unknownDeal("Hale & Mercer");
  const email = view.evidenceItems.find((e) => e.id.includes("email_ps") || /professional services/i.test(e.filename ?? ""));
  return {
    title: "What the seller said about professional services",
    summary:
      "Claire Hoffman (25 Aug) explained $40k of the $180k unexplained remainder as Relativity / e-discovery on Patel. ~$140k is still unexplained. The $85k Schiff Hardin item is already an accepted add-back.",
    bullets: [
      email?.body ?? "Seller email is in the evidence pack.",
      `TTM professional services ${formatMoneyExact(248000)} · accepted one-time ${formatMoneyExact(85000)} · unexplained ${formatMoneyExact(180000)} · email support ${formatMoneyExact(40000)}.`,
      "Suggested diligence update is pending your approval on Evidence — I will not mark the request complete.",
    ],
    citations: [
      cite("fact", "TTM P&L professional services", "248000"),
      cite("inference", "Seller email (partial)", email?.filename ?? "RE professional services expenses.eml"),
    ],
    matched: true,
  };
}

function occupancyMeetingAnswer(db: Database): AssistantAnswer {
  const view = getDealView(db, HALE_DEAL_ID);
  if (!view) return unknownDeal("Hale & Mercer");
  const note = view.evidenceItems.find((e) => e.id.includes("note_occupancy") || /occupancy/i.test(e.filename ?? ""));
  const occ = view.adjustments.find((a) => a.category === "occupancy");
  return {
    title: "Did the latest meeting change occupancy?",
    summary:
      "Yes, as an interpretation — not as a silent reject. Management said they will stay at 333 W Wacker and the cost does not disappear at close. Approving the interpretation on Evidence moves occupancy to needs-review.",
    bullets: [
      note?.snippet ?? "Expenses remain after close.",
      `Occupancy adjustment is currently ${occ?.status ?? "missing"} · ${formatMoneyExact(occ?.amount ?? 120000)}.`,
      `Normalized stays ${formatMoneyExact(view.normalizedEbitda)} until a human accepts or rejects the add-back.`,
    ],
    citations: [
      cite("inference", "Meeting note", note?.filename ?? "Occupancy and expenses post-close.md"),
      cite("proposed", "Excess occupancy", "Buyer construct until reviewed"),
    ],
    matched: true,
  };
}

function ownerCompEvidenceAnswer(db: Database): AssistantAnswer {
  const view = getDealView(db, HALE_DEAL_ID);
  if (!view) return unknownDeal("Hale & Mercer");
  const adj = view.adjustments.find((a) => a.category === "compensation");
  return {
    title: "Evidence behind the owner compensation adjustment",
    summary:
      "Accepted assumption: P&L owner $1,420,000 vs a $1,110,000 replacement stack → $310k. Payroll Detail v2 only shows $980k partner draws and does not separate owner.",
    bullets: [
      `Adjustment ${formatMoneyExact(adj?.amount ?? 310000)} · ${adj?.status} · ${adj?.source}`,
      "Source fact: TTM P&L owner compensation $1,420,000.",
      "Conflicting fact (pending): payroll partner draws $980,000.",
      "This is why partner-level detail is a blocking missing item.",
    ],
    citations: [
      cite("fact", "TTM P&L owner compensation", "1420000"),
      cite("assumption", "Replacement-cost stack", "Approved $310k add-back"),
      cite("conflict", "Payroll Detail v2", "980000 partner draws"),
    ],
    matched: true,
  };
}

function valuationCompareAnswer(db: Database, dealId: string): AssistantAnswer {
  const view = haleOr(db, dealId);
  if (!view) return unknownDeal(dealId);
  const rows = view.valuationScenarios.map((s) =>
    buildScenarioView(view.reportedEbitda, view.normalizedEbitda, view.adjustments, s)
  );
  return {
    title: "Conservative / Base / Upside",
    summary:
      "Scenario analysis only. I did not change accepted financials. Seller ask is $16.8M / 6.2x pro forma.",
    bullets: rows.map(
      (r) =>
        `${r.scenario.name}: EBITDA ${formatMoneyExact(r.selectedEbitda)} × ${formatMultiple(r.selectedMultiple)} = EV ${formatMoneyExact(r.ev)} · equity ${formatMoneyExact(r.indicatedEquity)} · gap vs seller ${formatMoneyExact(r.gapToSeller)} · includes ${r.includedTreatments.join(", ") || "accepted stack only"}`
    ),
    citations: [cite("scenario", "Valuation scenarios", "User-editable cases on the Valuation tab")],
    matched: true,
  };
}

function valuationGapAnswer(db: Database, dealId: string): AssistantAnswer {
  const view = haleOr(db, dealId);
  if (!view) return unknownDeal(dealId);
  const base = view.valuationScenarios.find((s) => s.key === "base");
  const sv = base
    ? buildScenarioView(view.reportedEbitda, view.normalizedEbitda, view.adjustments, base)
    : null;
  return {
    title: "What creates the valuation gap",
    summary: sv
      ? `Seller ${formatMoneyExact(sv.sellerExpectation)} vs base EV ${formatMoneyExact(sv.ev)} = ${formatMoneyExact(sv.gapToSeller)}. The ask prices pro forma $2.705M (occupancy + synergy). Base uses accepted normalized $2.495M × 6.0x.`
      : "No base scenario stored.",
    bullets: [
      "Seller prices proposed occupancy $120k and unsupported synergy $90k.",
      "Concentration / unsigned Mercer retention argues for a haircut (conservative).",
      "Meeting note says occupancy expense remains after close.",
      "Changing a scenario multiple does not rewrite accepted EBITDA.",
    ],
    citations: [
      cite("scenario", "Base case", "Accepted normalized × 6.0x"),
      cite("proposed", "Occupancy + synergy", "In seller PF, not in Normalized"),
    ],
    matched: true,
  };
}

function negotiationSupportAnswer(db: Database, dealId: string): AssistantAnswer {
  const view = haleOr(db, dealId);
  if (!view) return unknownDeal(dealId);
  const strong = view.negotiationPositions.filter((p) => p.strength === "strong");
  return {
    title: "Negotiation points with the strongest factual support",
    summary: "Strongest buyer arguments are sourced. Weak arguments are labeled.",
    bullets: [
      ...strong.map((p) => `${p.title} — ${p.body}`),
      ...view.negotiationPositions
        .filter((p) => p.strength === "weak")
        .map((p) => `Weak: ${p.title} — ${p.body}`),
    ],
    citations: strong.map((p) => cite("recommendation", p.title, p.related_issue)),
    matched: true,
  };
}

function draftSellerRequestAnswer(db: Database, dealId: string): AssistantAnswer {
  const view = haleOr(db, dealId);
  if (!view) return unknownDeal(dealId);
  const next = view.missingItems.find((m) => m.blocking && m.status === "open") ?? view.missingItems[0];
  return {
    title: "Draft next seller diligence request",
    summary: next
      ? "This is a draft from the missing-item list. Sending it onto the diligence list is a human action on Intake."
      : "No open missing items.",
    bullets: next
      ? [
          next.suggested_seller_request,
          `Why: ${next.why_it_matters}`,
          `Related line: ${next.related_line ?? "—"} · ${next.blocking ? "Blocking" : "Non-blocking"}`,
        ]
      : [],
    citations: [cite("recommendation", "Missing-item analysis", next?.title ?? "")],
    matched: true,
  };
}

function scenarioMultipleAnswer(db: Database, dealId: string, multiple: number): AssistantAnswer {
  const view = haleOr(db, dealId);
  if (!view) return unknownDeal(dealId);
  const price = view.normalizedEbitda * multiple;
  return {
    title: `Illustrative price at ${multiple.toFixed(1)}x accepted normalized`,
    summary: `${formatMoneyExact(view.normalizedEbitda)} × ${multiple.toFixed(1)} = ${formatMoneyExact(price)}. This is a scenario output. I did not write it into accepted financials, asking price, or the Base case.`,
    bullets: [
      `Accepted normalized (live) ${formatMoneyExact(view.normalizedEbitda)}`,
      `Illustrative EV ${formatMoneyExact(price)}`,
      `Seller ask ${formatMoneyExact(view.purchasePrice)} · gap ${formatMoneyExact((view.purchasePrice ?? 0) - price)}`,
      `Current asking multiple on pro forma ${formatMultiple(view.headerMultiple)}`,
    ],
    citations: [
      cite("scenario", `${multiple.toFixed(1)}x on accepted normalized`, "Not persisted"),
      cite("assumption", "Normalized EBITDA", "Accepted add-backs only, synergies excluded"),
    ],
    matched: true,
  };
}

function bridgeStructureAnswer(db: Database, dealId: string): AssistantAnswer {
  const view = haleOr(db, dealId);
  if (!view) return unknownDeal(dealId);
  const rec = view.recommendations[0];
  return {
    title: "Structure to bridge the gap without paying unsupported EBITDA at close",
    summary:
      rec?.body ??
      "Cash at close on accepted normalized. Contingent consideration for retention and disputed add-backs.",
    bullets: [
      "Cash at close on accepted normalized ($2.495M), not pro forma.",
      "Seller note / earnout / retention holdback for Mercer book.",
      "Escrow or contingent payment for occupancy and remaining professional services.",
      "NWC peg so AR/WIP timing does not hide the QB-vs-TTM difference.",
      rec ? `Alternatives: ${rec.alternatives}` : "",
    ].filter(Boolean),
    citations: [
      cite("recommendation", rec?.title ?? "Structure recommendation", "Pending human review — not legal advice"),
    ],
    matched: true,
  };
}
