# Changelog

## Unreleased — M0 + M1

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
