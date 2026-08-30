# NZ FIF Tax Calculator

A 100% client-side web app that turns raw broker transaction exports into a
consolidated Foreign Investment Fund (FIF) income figure for a New Zealand tax
resident, calculated under both Fair Dividend Rate (FDR) and Comparative Value (CV),
with a full audit trail.

**No transaction data ever leaves your browser.** See [PRIVACY.md](./PRIVACY.md).

This is not tax advice. See the disclaimer in-app and in every export. Facts that must
be re-verified annually are tracked in [VERIFY-ANNUALLY.md](./VERIFY-ANNUALLY.md).

## Status

Milestones M0 (repo scaffold), M1 (canonical model, ingestion, Column Mapping Wizard,
IBKR adapter), M2 (the calculation engine: scope screening, de minimis timeline,
FDR + quick sale, Comparative Value, method election, FX resolver, consolidation) and
M3 (results UI with drill-down, and the upload/review/prices flow) and M4 (xlsx working
paper, PDF summary, carry-forward session file) are complete, with the full
GT-1 … GT-12 golden suite green. See [CHANGELOG.md](./CHANGELOG.md) for detail and for
the modelling choices flagged for review.

The app runs end to end and produces a FIF figure: set up → upload → review → prices →
results → export, with every number on the results screen clickable through to its
working. Prices, FX rates, and opening holdings are entered by hand — the app needs no
API key and no network. Still to come: the remaining broker adapters (M5), and the
bundled IRD FX dataset, price providers, and i18n (M6).

**Nothing in this repo has been checked against a real broker export or verified by a
tax professional.** See [VERIFY-ANNUALLY.md](./VERIFY-ANNUALLY.md) — the Australian
exemption list is empty, the filing guidance is unverified, and the IRD FX dataset is
not built.

## Repo layout

```
packages/
  engine/   pure TypeScript calculation engine — no React, no DOM, no fetch.
            Money/quantity/FX math via decimal.js. Canonical transaction model.
  web/      Vite + React + TypeScript SPA. File ingestion, broker adapters,
            the Column Mapping Wizard, and (from M3) the results UI.
```

## Getting started

```bash
npm install
npm run typecheck
npm test
npm run dev   # starts packages/web on localhost
```

## Content-Security-Policy

`packages/web` ships a strict CSP (see `packages/web/index.html`):

```
default-src 'self';
connect-src 'self' https://www.alphavantage.co https://finnhub.io https://api.twelvedata.com;
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
object-src 'none';
base-uri 'self';
form-action 'self';
```

`connect-src` is the only origin allowlist that matters for the privacy guarantee: it
permits price/FX lookups (ticker + date only, see PRIVACY.md) and nothing else. If you
add a price provider, add its origin here and nowhere else.

## Refreshing the bundled IRD FX rate tables

(Not yet implemented — lands in M6.) IRD does not publish a machine-readable FX rate
API. The plan is a versioned JSON dataset at `packages/web/src/data/ird-fx/{year}.json`,
sourced by hand from IRD's published monthly/mid-month exchange rate tables, with the
source URL and fetch date recorded in the file itself.

## Adapters

Broker export formats change without notice. Rather than hard-coding column names, this
app detects known formats via a scored header-fingerprint registry and falls back to a
**Column Mapping Wizard** the user drives by hand. A completed mapping can be saved and
re-used as a portable adapter profile. See `packages/web/src/adapters/README.md`.

Only adapters validated against a real anonymised export are marked `verified: true`;
everything else shows an amber "beta — please check the parsed preview" banner in the
UI. Currently: IBKR (`verified: false`, awaiting validation against a real export).
