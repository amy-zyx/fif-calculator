import { Decimal, ZERO } from '../money';
import type { CostTimelinePoint } from '../holdings/ledger';
import { getIncomeYearTaxConfig, type ThresholdStatus } from '../tax-config';

export interface DeMinimisResult {
  inFif: boolean;
  peakCostNzd: Decimal;
  peakCostDate: string;
  thresholdUsed: Decimal;
  thresholdStatus: ThresholdStatus;
  /** Amount by which the peak exceeded the threshold; negative when under. */
  marginNzd: Decimal;
  timeline: CostTimelinePoint[];
}

/**
 * The de minimis test of spec §5.2.
 *
 * Two things about this test are routinely got wrong, and both are load-bearing here:
 *
 *  1. It is measured on total original COST in NZD of attributing interests HELD, at
 *     every point in the year — not on market value, and not on cumulative lifetime
 *     purchases. That is why this reads a running cost timeline rather than summing
 *     acquisitions (see GT-5, which only passes if disposals reduce the running total).
 *
 *  2. If the threshold is exceeded on ANY single day, FIF applies to the WHOLE
 *     portfolio for the WHOLE year — including the first $50,000 (see GT-4).
 */
export function testDeMinimis(
  timeline: readonly CostTimelinePoint[],
  incomeYear: number,
  thresholdOverrideNzd?: Decimal,
): DeMinimisResult {
  const config = getIncomeYearTaxConfig(incomeYear);
  const threshold = thresholdOverrideNzd ?? config.deMinimisThreshold.amountNzd;

  let peak = ZERO;
  let peakDate = config.startDate;
  for (const point of timeline) {
    if (point.totalCostNzd.greaterThan(peak)) {
      peak = point.totalCostNzd;
      peakDate = point.date;
    }
  }

  return {
    inFif: peak.greaterThan(threshold),
    peakCostNzd: peak,
    peakCostDate: peakDate,
    thresholdUsed: threshold,
    thresholdStatus: config.deMinimisThreshold.status,
    marginNzd: peak.minus(threshold),
    timeline: [...timeline],
  };
}
