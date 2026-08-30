import { Decimal, ZERO, floorAtZero, sum } from '../money';
import type { HoldingYearSummary } from '../holdings/ledger';
import { getIncomeYearTaxConfig } from '../tax-config';

export interface QuickSaleWorking {
  applies: boolean;
  peakQuantity: Decimal;
  openingQuantity: Decimal;
  closingQuantity: Decimal;
  peakHoldingDifferential: Decimal;
  averageCostNzd: Decimal;
  /** Branch (a) of the min(): the peak holding method amount. */
  peakHoldingAmountNzd: Decimal;
  /** Branch (b) of the min(): actual quick sale gains. */
  quickSaleGainsNzd: Decimal;
  quickSaleQuantity: Decimal;
  attributedProceedsNzd: Decimal;
  attributedDividendsNzd: Decimal;
  /** Which branch the min() selected. */
  bindingBranch: 'PEAK_HOLDING' | 'ACTUAL_GAINS' | 'NONE';
  adjustmentNzd: Decimal;
  notes: string[];
}

export interface FdrHoldingResult {
  key: string;
  ticker: string;
  openingMarketValueNzd: Decimal;
  baseFdrNzd: Decimal;
  quickSale: QuickSaleWorking;
  incomeNzd: Decimal;
}

/**
 * Fair Dividend Rate for one attributing interest (spec §5.3):
 *
 *     FDR income = (0.05 x opening market value in NZD)
 *                + quick sale adjustment
 *                , floored at 0
 *
 * Note the consequence the UI must state plainly: shares bought during the year and
 * still held at year end contribute nothing to base FDR income, because they were
 * never in the opening market value.
 */
export function computeFdrForHolding(
  summary: HoldingYearSummary,
  incomeYear: number,
): FdrHoldingResult {
  const { fdrRate } = getIncomeYearTaxConfig(incomeYear);
  const baseFdrNzd = summary.openingMarketValueNzd.times(fdrRate.rate);
  const quickSale = computeQuickSaleAdjustment(summary, fdrRate.rate);

  return {
    key: summary.key,
    ticker: summary.ticker,
    openingMarketValueNzd: summary.openingMarketValueNzd,
    baseFdrNzd,
    quickSale,
    incomeNzd: floorAtZero(baseFdrNzd.plus(quickSale.adjustmentNzd)),
  };
}

/**
 * The quick sale adjustment: the LESSER of the peak holding method amount and the
 * actual quick sale gains, floored at zero (spec §5.3).
 *
 * A "quick sale" is shares acquired and disposed of within the same income year.
 * Under average-cost pooling individual shares cannot be traced, so the quick sale
 * quantity is taken as min(acquired during year, disposed during year) and proceeds
 * are attributed pro rata — recorded in `notes` because it is an attribution
 * convention, not a fact read off the transactions.
 */
function computeQuickSaleAdjustment(summary: HoldingYearSummary, fdrRate: Decimal): QuickSaleWorking {
  const notes: string[] = [];
  const { peakQuantity, openingQuantity, closingQuantity, acquiredQuantity, disposedQuantity } = summary;

  const empty: QuickSaleWorking = {
    applies: false,
    peakQuantity,
    openingQuantity,
    closingQuantity,
    peakHoldingDifferential: ZERO,
    averageCostNzd: ZERO,
    peakHoldingAmountNzd: ZERO,
    quickSaleGainsNzd: ZERO,
    quickSaleQuantity: ZERO,
    attributedProceedsNzd: ZERO,
    attributedDividendsNzd: ZERO,
    bindingBranch: 'NONE',
    adjustmentNzd: ZERO,
    notes,
  };

  if (acquiredQuantity.isZero() || disposedQuantity.isZero()) {
    notes.push('No shares were both acquired and disposed of in the year — no quick sale adjustment.');
    return empty;
  }

  // (a) Peak holding method.
  const differential = Decimal.min(
    peakQuantity.minus(openingQuantity),
    peakQuantity.minus(closingQuantity),
  );
  const averageCostNzd = acquiredCostPerShare(summary);
  const peakHoldingAmountNzd = differential.isPositive()
    ? fdrRate.times(differential).times(averageCostNzd)
    : ZERO;
  if (!differential.isPositive()) {
    notes.push('Peak holding differential is zero or negative, so the peak holding amount is nil.');
  }

  // (b) Actual quick sale gains.
  const quickSaleQuantity = Decimal.min(acquiredQuantity, disposedQuantity);
  const attributionRatio = quickSaleQuantity.dividedBy(disposedQuantity);
  const attributedProceedsNzd = summary.disposalProceedsNzd.times(attributionRatio);
  const attributedDividendsNzd = summary.dividendsNzd.times(attributionRatio);
  const quickSaleCostNzd = quickSaleQuantity.times(averageCostNzd);
  const quickSaleGainsNzd = floorAtZero(
    attributedProceedsNzd.plus(attributedDividendsNzd).minus(quickSaleCostNzd),
  );

  if (attributionRatio.lessThan(1)) {
    notes.push(
      `Only ${quickSaleQuantity.toString()} of ${disposedQuantity.toString()} disposed units were also ` +
        'acquired in-year; proceeds and dividends attributed pro rata under average-cost pooling.',
    );
  }

  const adjustmentNzd = floorAtZero(Decimal.min(peakHoldingAmountNzd, quickSaleGainsNzd));
  const bindingBranch: QuickSaleWorking['bindingBranch'] = adjustmentNzd.isZero()
    ? 'NONE'
    : peakHoldingAmountNzd.lessThanOrEqualTo(quickSaleGainsNzd)
      ? 'PEAK_HOLDING'
      : 'ACTUAL_GAINS';

  return {
    applies: true,
    peakQuantity,
    openingQuantity,
    closingQuantity,
    peakHoldingDifferential: differential,
    averageCostNzd,
    peakHoldingAmountNzd,
    quickSaleGainsNzd,
    quickSaleQuantity,
    attributedProceedsNzd,
    attributedDividendsNzd,
    bindingBranch,
    adjustmentNzd,
    notes,
  };
}

/** Average NZD cost of the shares ACQUIRED during the year (spec §5.3). */
function acquiredCostPerShare(summary: HoldingYearSummary): Decimal {
  if (summary.acquiredQuantity.isZero()) return ZERO;
  return summary.acquiredCostNzd.dividedBy(summary.acquiredQuantity);
}

export function sumFdr(results: readonly FdrHoldingResult[]): Decimal {
  return sum(results.map((r) => r.incomeNzd));
}
