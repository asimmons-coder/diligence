# Diligence

System of record for an acquisition from first target through close. Built for serial acquirers. The running app is the product — there is no marketing site.

Design partner in this seed: **Northline Legal** (law-firm roll-up). The architecture is vertical-agnostic.

## Run locally

```bash
npm i
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You land inside the product as Elena Vargas at Northline Legal. No auth wall.

`npm run build` must succeed. Live Supabase credentials are not required for the demo.

Copy `.env.local.example` only if you later wire the SQL schema to a project:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Product thesis

CRM + Excel + a shared drive cannot execute a $100M acquisition book. Diligence is the operating system: organize targets, ingest financials, normalize EBITDA, raise diligence questions, track missing information, and keep a live understanding of every deal.

## Seed store vs Postgres

`supabase/migrations/0001_init.sql` plus `0002_evidence.sql` are the multi-tenant schema (every table has `organization_id`, RLS isolates orgs). TypeScript types in `src/lib/types.ts` match that schema 1:1.

The running app uses a typed in-memory store (`src/lib/seed.ts` + `src/lib/store.tsx`) that persists mutations to `localStorage` under `diligence.store.v2`. An old v1 seed will not load — reset or a fresh visit gets the Hale messy evidence pack.

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

Deal tabs: Overview · Intake · Financials · Diligence · Documents · Evidence · Valuation · Activity. Documents remains the data room; Intake is the review engine.

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
