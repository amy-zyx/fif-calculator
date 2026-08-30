# Changelog

## Unreleased — M2

### M2 — The calculation engine
The engine now produces a FIF income figure. Scope screening (§5.1) classifies every
instrument in order — NZ-resident, Australian listed exemption, option contracts, then
everything else foreign — recording a reason for each exclusion and surfacing excluded
items rather than hiding them. A holdings ledger walks every transaction in date order
maintaining per-instrument quantity and NZD cost, which feeds both the de minimis daily
cost timeline (§5.2) and the per-interest FDR (§5.3), quick sale adjustment, and
Comparative Value (§5.4) calculations, with the election between the two methods made on
portfolio totals rather than per holding (§5.5). The FX resolver (§5.7) was built in this
milestone rather than alongside the price providers, because the de minimis verdict
depends on it: it normalises every rate to a multiplying `ConversionFactor` so the
IRD "foreign units per NZD" convention and brokers' opposite convention cannot be
confused, chains trade→base→NZD for non-NZD-based accounts, and blocks rather than
guessing on an inverted or implausible rate. Consolidation (§6) adds reference-based
deduplication and inter-broker transfer matching, both of which report rather than act
silently. **All of GT-1 … GT-12 are green**, along with the required invariants (FDR
income never negative, CV portfolio total never negative, no `fetch` in the engine).
108 engine tests in total. Per spec §10, there is no UI in this milestone — nothing in
`packages/web` changed.

Two things worth flagging for review:
- **Quick sale dividend attribution.** Under average-cost pooling individual shares
  cannot be traced, so branch (b) of the quick sale `min()` attributes proceeds and
  dividends pro rata by `min(acquired, disposed) / disposed`. This is an attribution
  convention, not a fact read off the transactions; it is recorded in the working's
  `notes` and does not affect GT-2/GT-3, which have no dividends.
- **`CanonicalTxn.fxRateToNzd` is a divisor, not a multiplier.** The field name is from
  the spec and was kept, but it holds an IRD-convention rate (foreign units per NZD)
  that you DIVIDE by. Inside the engine nothing passes a bare rate around — see the
  convention note at the top of `fx/types.ts`.

## M0 + M1

### M0 — Repo scaffold
- npm workspaces monorepo: `packages/engine` (pure calculation engine, no React/DOM deps)
  and `packages/web` (Vite + React + TypeScript app).
- Strict TypeScript everywhere (`strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`).
- `Money`/`Decimal` wrapper (`packages/engine/src/money.ts`) built on `decimal.js`.
  All money, share-quantity, and FX-rate arithmetic in the engine goes through this —
  never a native JS `number`. Covered by tests including a float-drift regression test.
- `tax-config.ts`: per-income-year configuration (de minimis threshold, FDR rate),
  each value tagged `status: 'enacted' | 'proposed'`. Seeded with 2025-26 (enacted,
  $50,000) and 2026-27 (proposed, $100,000 — not yet legislated as of 30 Aug 2026;
  expected in a separate taxation bill ~September 2026, retroactive to 1 Apr 2026 if
  passed).
- GitHub Actions CI: install, typecheck, lint, test on push/PR.

### M1 — Canonical model, ingestion, Column Mapping Wizard, IBKR adapter
- `CanonicalTxn` / `InstrumentRef` types and zod schemas (`packages/engine/src/types`).
- File ingestion pipeline: CSV via papaparse, XLSX via SheetJS, multi-section splitting
  for IBKR Activity Statements.
- Broker adapter registry with confidence-scored header-fingerprint detection.
- **Column Mapping Wizard**: the universal fallback UI when no adapter scores above the
  detection threshold. User drags their file's columns onto canonical fields, sees a
  live preview of the first 5 parsed rows, and can save the result as a reusable,
  exportable/importable adapter profile.
- IBKR adapter (Activity Statement CSV), `verified: false` (amber "beta" banner) until
  validated against a real anonymised export — per spec §4.2, no adapter ships
  `verified: true` without that validation.
- Fixture-based adapter tests using a synthetic (non-real) anonymised IBKR export.

### Deliberately deferred to later milestones
- shadcn/ui components are stubbed with plain Tailwind primitives for now — wiring the
  full shadcn CLI output is left for M3 (Results UI) when there's a fuller component
  surface to justify it.
- IndexedDB persistence (`idb`) and the "Clear all my data" control ship with M3+, once
  there's session state worth persisting.
- Engine milestones (scope screening, de minimis timeline, FDR/CV, FX resolver,
  golden tests GT-1..GT-12) are M2 — explicitly not started; see spec §10.
