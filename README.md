# Diligence

System of record for an acquisition from first target through close. Built for serial acquirers. The running app is the product — there is no marketing site.

Design partner in this seed: **Northline Legal** (law-firm roll-up). The architecture is vertical-agnostic.

## Run locally

```bash
npm i
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You land inside the product as **Giovanni Ackerman** (financial diligence associate) at Northline Legal. Switch to **Alex Chen** from the topbar to review without redoing. No auth wall.

`npm run build` must succeed. Live Supabase credentials are not required for the demo.

Copy `.env.local.example` only if you later wire the SQL schema to a project:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Product thesis

CRM + Excel + a shared drive cannot execute a $100M acquisition book. Diligence is the operating system: organize targets, ingest financials, normalize EBITDA, raise diligence questions, track missing information, and keep a live understanding of every deal.

## Seed store vs Postgres

`supabase/migrations/0001_init.sql`, `0002_evidence.sql`, and `0003_phase3.sql` are the multi-tenant schema (every table has `organization_id`, RLS isolates orgs). TypeScript types in `src/lib/types.ts` match that schema 1:1.

The running app uses a typed in-memory store (`src/lib/seed.ts` + `src/lib/store.tsx`) that persists mutations to `localStorage` under `diligence.store.v3`. An older v1/v2 seed will not load — reset or a fresh visit gets the Phase 3 book (queue, templates, evals, package, baseline).

Approve/reject, extraction review, conflict conversion, interpretation approval, diligence status, findings, tasks, uploads, and valuation-scenario edits update the same derived metrics the dashboard, pipeline, compare, and assistant read.

## Vertical profile convention

Do not add industry-specific first-class columns. A deal has `vertical` (e.g. `legal`) and a `vertical_metrics` blob. Legal may carry attorney count, partner count, revenue per attorney, revenue-by-attorney, top-3 concentration, practice mix, and related production fields. Accounting, wealth, HVAC, dental, and the rest plug in the same way.

## Evidence model (Phase 2)

The core loop is: drop a messy deal folder → classify/extract (deterministic, not a live LLM) → review facts and conflicts → reconstruct a source-linked underwriting position.

- `evidence_items` cover documents, emails, meeting notes/transcripts, plus connector fields (`source_system`, `external_thread_id`, `external_meeting_id`, …). Live Gmail/Granola is not implemented.
- `extracted_facts` stay `pending` until a human Accepts / Rejects / Edits. Accepting a fact does **not** silently rewrite accepted financial statements.
- `conflicts` can become a seller request, a proposed adjustment, or a task — those objects still need their own human accept.
- `communication_interpretations` propose diligence-status or adjustment-posture changes. Approving the occupancy meeting interpretation moves occupancy to `needs_review` (not a silent reject).
- Valuation is three editable scenarios (Conservative / Base / Upside). Editing a scenario never mutates accepted financials.
- Readiness is a set of dimensions, not one fake percentage. Hale is **not** ready for a final indication.

Deal tabs: Overview · Intake · Financials · Diligence · Documents · Evidence · Valuation · Package · Baseline · Corrections · Activity. Documents remains the data room; Intake is the review engine; Queue is the analyst OS.

## Analyst queue and corrections

`/queue` is Giovanni’s daily home — not another exec dashboard. Rows cover documents needing classification, extractions, reconciliation conflicts, proposed adjustments, missing information, seller questions to draft, assignment filters (me / Giovanni / assigned by Alex), and changes since last login. Alex sees Giovanni’s completed items and can approve without redoing. Preparer vs reviewer is stored.

`/evals` (and deal **Corrections**) lists evaluation events: initial system output, analyst action, corrected answer, why the original was wrong, controlling source, time saved, final resolution.

## Law-firm underwriting template

The engine stays horizontal. `underwriting_templates` + `template_fields` make legal one configurable profile (revenue by attorney, originations/collections, concentration, partner/owner compensation, roster, AR, contingent-fee inventory, referral sources, lease, retention, trust account, practice mix, state ownership, standard request pack). Hale is seeded against it so gaps populate the queue. Other verticals use a generic template.

## Underwriting package and baseline

**Package** is a reviewable decision-meeting output: executive brief, reconstructed financials, EBITDA bridge, adjustment support, reconciliation, risks, open diligence, valuation **scenario analysis**, evidence appendix, decision history. Export Excel, PDF, or structured JSON with the live Hale numbers.

**Baseline** stores underwritten revenue/EBITDA, accepted adjustments, expected synergies, retention, NWC, price/structure, and first-year assumptions. Read-only until a human edits. Actuals will be compared later.

## Integration boundary

Deals can carry `external_system`, `external_deal_id`, `external_deal_url`, and source-system timestamps plus import history. Change events are written on accept/reject/status (webhook-ready; no outbound HTTP). MyMavacy is a future source system — Diligence remains authoritative for underwriting decisions.

## AI never silently edits financials

- Reported EBITDA is a source fact.
- AI-proposed adjustments are dashed / amber and excluded from Normalized.
- Normalized EBITDA = Reported + sum(Accepted), **excluding Synergy**.
- Pro forma EBITDA = Normalized + remaining Proposed (including Synergy) + any accepted synergy.
- `needs_review` is neither accepted nor rejected — it leaves Normalized and leaves Pro forma.
- Provenance (document, section, extracted value, confidence, approval status) is inspectable on every AI claim.
- Claims are labeled fact / assumption / proposed / inference / conflict / scenario / recommendation.
- The assistant is a deterministic query layer over seed + state. Scenario questions (including 5.5x) do not write back to accepted data.
- The assistant will not invent numbers that are not in the store.
