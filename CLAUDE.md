@AGENTS.md

# Diligence — agent notes

## Non-negotiable

AI never silently changes accepted financials. Proposed stays proposed until a human Accepts. Approving an interpretation may move an adjustment to `needs_review`; it must not silently reject.

- Normalized EBITDA = Reported + Accepted adjustments **excluding synergy**.
- Pro forma = Normalized + remaining Proposed (including synergy) + any accepted synergy.
- Hale TTM: Reported $2,100,000; accepted owner $310k + legal $85k → Normalized $2,495,000; proposed occupancy $120k + synergy $90k → Pro forma $2,705,000; ask $16,800,000 → 6.2x PF.
- Organization-scoped. Vertical metrics stay on `vertical` + `vertical_metrics`. No first-class law-firm columns — legal is an underwriting template.
- Mutations write `activities` + `audit_events`. Accept/reject/status also write `evaluation_events` and webhook-ready `change_events` (no outbound HTTP).
- Client store is the runtime (`diligence.store.v3`). SQL in `supabase/migrations` (`0001`–`0003`) matches `src/lib/types.ts` 1:1.

## Users

Northline Legal only. Default operator is **Giovanni Ackerman** (financial diligence associate). **Alex Chen** is Managing Partner — reviews Giovanni’s completed items and approves without redoing. **Elena Vargas** remains Hale deal lead. Switch users from the topbar. Do not add Michael/Justin/Rick as product users.

## Phase 2 surfaces (keep)

- `/deals/new` — document-first intake or manual create. **Load Hale messy folder** hydrates nested paths (e.g. `Financials/P&L 2024 FINAL.xlsx`).
- `/deals/[id]/intake` — received / extracted / conflicts / missing / law-firm template / preliminary underwriting.
- `/deals/[id]/evidence` — seeded Gmail-like threads and Granola-like notes + interpretation approval.
- `/deals/[id]/valuation` — Conservative / Base / Upside + negotiation. Scenario edits do not mutate accepted facts.

## Phase 3 surfaces

- `/queue` — Giovanni’s daily operating queue (classification, extractions, reconciliation, proposed adjustments, missing, seller questions, assignment filters, since last login, Alex review).
- `/evals` and `/deals/[id]/corrections` — evaluation/correction log (preparer vs reviewer).
- `/deals/[id]/package` — formal underwriting package + Excel/PDF/JSON export with live numbers. Valuation labeled **scenario analysis**.
- `/deals/[id]/baseline` — post-close baseline (read-only until a human edits). Actuals compared later.

Keep dashboard, pipeline, compare, financials bridge, diligence, documents, activity, and the assistant.

## Integration boundary (MyMavacy later)

MyMavacy (or any source system) may later send identity, documents, and comms. Diligence returns approved underwriting outputs and status. **Diligence remains authoritative for underwriting decisions.**

Each deal may carry `external_system`, `external_deal_id`, `external_deal_url`, and source-system timestamps plus `import_events`. `change_events` are webhook-ready (type, payload, created_at) and are **not** POSTed.

## Underwriting templates

`underwriting_templates` + `template_fields` + `deal_template_field_values`. Legal is one template (`tpl_law_firm`). Other verticals use `tpl_generic`. Field status: missing / extracted / reviewed / accepted / conflict.

## Evaluations

On Accept / Edit / Reject of an extraction, conflict interpretation, or recommendation, write `evaluation_events` (initial output, action, corrected answer, why-wrong required on edit/reject, controlling source, preparer, reviewer). Seed ~8–12 Hale corrections only — do not fake a 20-deal eval set.
