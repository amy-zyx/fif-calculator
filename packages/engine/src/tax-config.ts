import { D, Decimal } from './money';

/**
 * TODO(verify): before relying on this file for a new income year, re-check:
 *  1. Whether the income year's de minimis threshold is enacted or still proposed
 *     (VERIFY-ANNUALLY.md item 1). As of 30 Aug 2026, the $100,000 threshold for
 *     2026-27 is proposed only — not in the Budget-night legislation, expected in a
 *     separate taxation bill ~Sept 2026, retroactive to 1 Apr 2026 if/when it passes.
 *  2. The FDR rate (VERIFY-ANNUALLY.md item 2). Currently 5% for every year below.
 */

export type ThresholdStatus = 'enacted' | 'proposed';

/**
 * An NZ income year is identified by the calendar year its 31 March end date falls
 * in — e.g. `2026` means the year ended 31 March 2026 (spec §3.2 `nzIncomeYear`).
 */
export type NzIncomeYear = number;

export interface DeMinimisThreshold {
  /** NZD cost threshold. FIF applies to the whole portfolio if this is exceeded on
   * any single day of the year (spec §5.2) — not a lifetime or cumulative-purchase test. */
  amountNzd: Decimal;
  status: ThresholdStatus;
  /** Where this figure comes from, for the audit trail and VERIFY-ANNUALLY.md. */
  source: string;
}

export interface FdrRate {
  rate: Decimal;
  status: ThresholdStatus;
  source: string;
}

export interface IncomeYearTaxConfig {
  nzIncomeYear: NzIncomeYear;
  /** Income year start/end dates, inclusive, in NZ local calendar terms. */
  startDate: string; // ISO date, 1 April of the preceding calendar year
  endDate: string; // ISO date, 31 March of `nzIncomeYear`
  deMinimisThreshold: DeMinimisThreshold;
  fdrRate: FdrRate;
}

const IR461_SOURCE = 'IR461 (April 2026 edition)';
const BUDGET_2026_SOURCE =
  'Budget 2026 / Beehive.govt.nz announcement — proposed, expected in a taxation bill ~Sept 2026, not yet enacted as of 30 Aug 2026';

/**
 * One entry per NZ income year the app supports. Add a new year here, not by
 * mutating an old one — old years must stay reproducible for users recalculating
 * a prior return (spec: "give me the same number again, consistently").
 */
const INCOME_YEAR_CONFIGS: readonly IncomeYearTaxConfig[] = [
  {
    nzIncomeYear: 2025,
    startDate: '2024-04-01',
    endDate: '2025-03-31',
    deMinimisThreshold: { amountNzd: D('50000'), status: 'enacted', source: IR461_SOURCE },
    fdrRate: { rate: D('0.05'), status: 'enacted', source: IR461_SOURCE },
  },
  {
    nzIncomeYear: 2026,
    startDate: '2025-04-01',
    endDate: '2026-03-31',
    deMinimisThreshold: { amountNzd: D('50000'), status: 'enacted', source: IR461_SOURCE },
    fdrRate: { rate: D('0.05'), status: 'enacted', source: IR461_SOURCE },
  },
  {
    nzIncomeYear: 2027,
    startDate: '2026-04-01',
    endDate: '2027-03-31',
    // Proposed figure. The UI must show a warning banner and let the user toggle
    // between $50,000 (current law) and $100,000 (proposed) — spec §5.2.
    deMinimisThreshold: { amountNzd: D('100000'), status: 'proposed', source: BUDGET_2026_SOURCE },
    fdrRate: { rate: D('0.05'), status: 'enacted', source: IR461_SOURCE },
  },
];

const BY_YEAR = new Map<NzIncomeYear, IncomeYearTaxConfig>(
  INCOME_YEAR_CONFIGS.map((c) => [c.nzIncomeYear, c]),
);

export function getIncomeYearTaxConfig(year: NzIncomeYear): IncomeYearTaxConfig {
  const config = BY_YEAR.get(year);
  if (!config) {
    throw new RangeError(
      `No tax config for NZ income year ${year}. Supported years: ${[...BY_YEAR.keys()].join(', ')}. ` +
        `Add an entry to INCOME_YEAR_CONFIGS in tax-config.ts rather than guessing a value.`,
    );
  }
  return config;
}

export function listSupportedIncomeYears(): readonly NzIncomeYear[] {
  return [...BY_YEAR.keys()].sort((a, b) => a - b);
}

/**
 * The alternate de minimis threshold for a year with a `proposed` figure, so the UI
 * can offer the toggle the spec requires (§5.2). Returns null when the year's
 * threshold is already `enacted` (nothing to toggle to).
 */
export function getAlternateDeMinimisThreshold(year: NzIncomeYear): DeMinimisThreshold | null {
  const config = getIncomeYearTaxConfig(year);
  if (config.deMinimisThreshold.status === 'enacted') return null;
  // The only case in this dataset today: proposed $100k vs current-law $50k.
  return { amountNzd: D('50000'), status: 'enacted', source: IR461_SOURCE };
}
