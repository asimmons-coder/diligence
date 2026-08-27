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

`supabase/migrations/0001_init.sql` is the multi-tenant schema (every table has `organization_id`, RLS isolates orgs). TypeScript types in `src/lib/types.ts` match that schema 1:1.

The running MVP uses a typed in-memory store (`src/lib/seed.ts` + `src/lib/store.tsx`) that persists mutations to `localStorage`. Approve/reject, diligence status, findings, tasks, and uploads update the same derived metrics the dashboard, pipeline, compare, and assistant read.

## Vertical profile convention

Do not add industry-specific first-class columns. A deal has `vertical` (e.g. `legal`) and a `vertical_metrics` blob. Legal may carry attorney count, partner count, revenue per attorney, revenue-by-attorney, top-3 concentration, practice mix, and related production fields. Accounting, wealth, HVAC, dental, and the rest plug in the same way.

## AI never silently edits financials

- Reported EBITDA is a source fact.
- AI-proposed adjustments are dashed / amber and excluded from Normalized.
- Normalized EBITDA = Reported + sum(Accepted), **excluding Synergy**.
- Pro forma EBITDA = Normalized + remaining Proposed (including Synergy) + any accepted synergy.
- Provenance (document, section, extracted value, confidence, approval status) is inspectable on every AI claim.
- The assistant is a deterministic query layer over seed + state. It will not invent numbers that are not in the store.
