# Verify annually (and before every launch)

This file tracks the facts in this codebase that are true only as of a point in time.
A human must re-check each one before relying on the app for a new income year, and the
`verifiedOn` date in the referenced source file must be updated when they do.

| # | Item | Source file | Status as of 30 Aug 2026 | verifiedOn |
|---|---|---|---|---|
| 1 | De minimis threshold for the target income year, and whether the proposed $100,000 figure (2026-27 onward) has been enacted | `packages/engine/src/tax-config.ts` | **Proposed only.** Not in Budget-night legislation; expected in a separate taxation bill ~Sept 2026, retroactive to 1 Apr 2026 if passed. | 2026-08-30 |
| 2 | The FDR rate (currently 5%) | `packages/engine/src/tax-config.ts` | 5%, unchanged | 2026-08-30 |
| 3 | The IR3 section/box label and the current FIF disclosure exemption (determination ITR37) for the target year | `packages/engine/src/filing-config.ts` (M4) | not yet built | — |
| 4 | The Australian listed share exemption list (approved index, stapled-security exclusions) | `packages/engine/src/scope/auExemptionList.ts` | **Structure built, list EMPTY.** No ticker is currently treated as exempt. Must be populated from an authoritative source and verified before launch. | — |
| 5 | The IRD FX rate tables bundled in `src/data/ird-fx/` | `packages/web/src/data/ird-fx/` (M6) | not yet built | — |

Each source file above should carry its own `TODO(verify)` comment listing exactly what
to re-check, per spec §8 and §12.
