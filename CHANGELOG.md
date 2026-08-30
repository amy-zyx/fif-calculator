# Changelog

## Unreleased — M4

### M4 — Working paper, PDF summary, and carry-forward
Three exports from the results screen. The **xlsx working paper** is the
accountant-facing deliverable, with one tab per section: Summary, De minimis timeline,
Per-holding FDR, Quick sale workings (both branches of the `min()` and which one bound),
Per-holding CV, Foreign tax credits, FX rates, All transactions with their verbatim
source row, and Assumptions & warnings. Amounts are written as numbers rather than
preformatted strings, so a reviewer can total and re-check a column in Excel; they are
rounded to cents at that boundary, having been carried at full Decimal precision
throughout. Built with SheetJS, already a dependency for reading broker exports, rather
than adding exceljs for the write path alone.

The **PDF summary** is a short one-to-two page record to file alongside the return, and
the **`.fifsession.json`** carries this year's closing position forward as next year's
*proposed* opening holdings.

`filing-config.ts` holds per-year filing guidance with a `sourceUrl` and a `verifiedOn`
date. Per spec §8 it never asserts a box number — box numbering changes between years
and a stale number is worse than none because it reads as authoritative. Every year is
currently `verifiedOn: null`, and both the UI and every export say plainly that the
guidance is unverified until a human checks it.

**Fixed: the instrument-identity trap flagged in M3.** Broker adapters often leave
`exchange` null, so a user who typed an exchange when entering an opening holding
created a different instrument key; the holding silently failed to attach to the traded
position and FDR was computed off an opening market value of zero. Hand-entered
instruments are now reconciled onto the transaction's own identity when the ticker
matches — the imported file being the authoritative record of what was traded. A ticker
that appears under two identities (the same symbol on two exchanges) is deliberately
left unreconciled, since only the user's entry can distinguish those. Confirmed in the
browser: the Prices screen previously asked for the same closing price twice and now
asks once, and FDR comes out at NZD 8,333.33 rather than zero.

`HoldingYearSummary` gained `closingCostNzd` — the remaining cost basis at year end.
Carry-forward needs it, and it must not be confused with closing *market* value: cost
drives the de minimis test, market value drives FDR, and substituting one for the other
silently changes the threshold verdict.

187 tests (132 engine, 55 web). Verified end to end in a browser: all three exports
produce real files (34.9 KB xlsx, 5.6 KB PDF, 857-byte session file) with no console
errors.

## Unreleased — M3

### M3 — Results UI with drill-down, and the upload/review/prices flow
The app now runs end to end: set up → upload → review → prices → results. The engine
built in M2 is wired in behind `runCalculation`, and the results screen renders the
de minimis verdict, the FDR vs Comparative Value comparison with the recommended
(lower) figure, the per-holding breakdown, foreign tax credits, and the "not included
in FIF" panel.

**Every figure on the results screen is clickable** and opens a drill-down showing the
formula, each input, the rule behind it, and the source transactions — the de minimis
number opens the full running cost timeline; a per-holding FDR figure opens the whole
quick sale working including both branches of the `min()` and which one bound.

Gating is enforced rather than advisory. Possible inter-broker transfers must each be
confirmed before Review will continue, because assuming one manufactures a quick sale
that never happened. Prices and FX rates must all be present before Calculate is
enabled, and a missing value blocks with a named blocker rather than defaulting to
zero.

Prices, FX rates, and opening holdings are all entered by hand. That is the
ManualEntryProvider path and it is deliberately complete on its own — the app works
with no API key and no network. M6 adds the bundled IRD dataset and an optional price
API on top; neither replaces manual entry. FX rates are entered and stored in IRD's
published convention (units of foreign currency per 1 NZD), and the reciprocal is
still taken in exactly one place inside the engine.

`vite.config.ts` now honours `PORT`, so a supervising process can assign a free port
instead of Vite silently falling back to 5174 when its default is taken.

174 tests (132 engine, 42 web), including GT-1 driven through the real engine into the
rendered UI, and a case asserting a missing closing price surfaces as a blocker rather
than a figure.

**Flagged for review — instrument identity across manual entry and broker files.**
Broker adapters often leave `exchange` null (the IBKR adapter does), so their
transactions key as `t:NVDA`. If a user types an exchange when entering an opening
holding, that holding keys as `tx:NASDAQ:NVDA` and becomes a *different* instrument —
the opening holding silently fails to attach to the traded position, and FDR is
computed off an opening market value of zero. The engine is behaving as specified
(§3.3 priority order), and the Review screen does flag ticker-only matches, but
nothing yet reconciles the two spellings or prompts the user to merge them. Worth
resolving before M4.

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
