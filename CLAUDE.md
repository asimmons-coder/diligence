@AGENTS.md

# Diligence — agent notes

## Non-negotiable

AI never silently changes accepted financials. Proposed stays proposed until a human Accepts. Approving an interpretation may move an adjustment to `needs_review`; it must not silently reject.

- Normalized EBITDA = Reported + Accepted adjustments **excluding synergy**.
- Pro forma = Normalized + remaining Proposed (including synergy) + any accepted synergy.
- Hale TTM: Reported $2,100,000; accepted owner $310k + legal $85k → Normalized $2,495,000; proposed occupancy $120k + synergy $90k → Pro forma $2,705,000; ask $16,800,000 → 6.2x PF.
- Organization-scoped. Vertical metrics stay on `vertical` + `vertical_metrics`.
- Mutations write `activities` + `audit_events`.
- Client store is the runtime (`diligence.store.v2`). SQL in `supabase/migrations` matches `src/lib/types.ts` 1:1.

## Phase 2 surfaces

- `/deals/new` — document-first intake or manual create. **Load Hale messy folder** hydrates the flagship pack immediately.
- `/deals/[id]/intake` — received / extracted / conflicts / missing / preliminary underwriting.
- `/deals/[id]/evidence` — seeded Gmail-like threads and Granola-like notes + interpretation approval.
- `/deals/[id]/valuation` — Conservative / Base / Upside + negotiation. Scenario edits do not mutate accepted facts.

Keep dashboard, pipeline, compare, financials bridge, diligence, documents, activity, and the assistant. They consume readiness, open conflicts, and valuation gap from the same store.
