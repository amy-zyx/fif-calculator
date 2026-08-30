import { D, Decimal, sum } from '../money';
import type { ConversionFactor, IrdRateProvider } from './types';

/**
 * Turns a published IRD rate (foreign units per 1 NZD) into a multiplying factor
 * that converts a foreign amount INTO NZD. This reciprocal is taken here and
 * nowhere else in the engine — see the convention note in ./types.ts.
 */
export function irdRateToNzdFactor(currency: string, publishedRate: Decimal): ConversionFactor {
  if (publishedRate.isZero() || publishedRate.isNegative()) {
    throw new RangeError(
      `Invalid IRD rate ${publishedRate.toString()} for ${currency}: must be positive.`,
    );
  }
  return { from: currency, to: 'NZD', factor: D(1).dividedBy(publishedRate) };
}

/** NZD needs no conversion; used so callers never special-case the base currency. */
export const NZD_IDENTITY_FACTOR: ConversionFactor = { from: 'NZD', to: 'NZD', factor: D(1) };

export type IrdRateTable = Record<string, Record<string, string>>;

/**
 * IRD rates bundled as a versioned dataset (spec §2 — "IRD FX rates have no public
 * API"). Lookup falls back to the most recent published rate on or before the
 * requested date, which is how IRD's monthly/mid-month tables are meant to be
 * applied — a trade on the 20th uses that month's published rate.
 *
 * Never extrapolates past the end of the table: a date after the last published
 * rate returns null so the caller blocks rather than silently reusing a stale rate.
 */
export class TableIrdRateProvider implements IrdRateProvider {
  private readonly sortedDates: Map<string, string[]>;

  constructor(private readonly table: IrdRateTable) {
    this.sortedDates = new Map();
    for (const [currency, rates] of Object.entries(table)) {
      this.sortedDates.set(currency, Object.keys(rates).sort());
    }
  }

  getRate(currency: string, date: string): Decimal | null {
    if (currency === 'NZD') return D(1);
    const rates = this.table[currency];
    const dates = this.sortedDates.get(currency);
    if (!rates || !dates || dates.length === 0) return null;

    const exact = rates[date];
    if (exact !== undefined) return D(exact);

    let candidate: string | null = null;
    for (const d of dates) {
      if (d <= date) candidate = d;
      else break;
    }
    if (candidate === null) return null;
    const value = rates[candidate];
    return value === undefined ? null : D(value);
  }

  /**
   * Rolling 12-month average of the published rates falling inside the income year
   * (1 April to 31 March). Averages the published rate points themselves, which is
   * how IRD's rolling-average method works off its own mid-month tables.
   */
  getRollingAverage(currency: string, incomeYear: number): Decimal | null {
    if (currency === 'NZD') return D(1);
    const rates = this.table[currency];
    const dates = this.sortedDates.get(currency);
    if (!rates || !dates) return null;

    const start = `${incomeYear - 1}-04-01`;
    const end = `${incomeYear}-03-31`;
    const inYear = dates.filter((d) => d >= start && d <= end);
    if (inYear.length === 0) return null;

    const values = inYear.map((d) => D(rates[d] as string));
    return sum(values).dividedBy(D(values.length));
  }
}
