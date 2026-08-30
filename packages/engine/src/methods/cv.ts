import { Decimal, floorAtZero, sum } from '../money';
import type { HoldingYearSummary } from '../holdings/ledger';

export interface CvHoldingResult {
  key: string;
  ticker: string;
  closingMarketValueNzd: Decimal;
  gainsNzd: Decimal;
  openingMarketValueNzd: Decimal;
  costsNzd: Decimal;
  /** May be negative at the per-interest level; the floor is a PORTFOLIO rule. */
  incomeNzd: Decimal;
}

/**
 * Comparative Value for one attributing interest (spec §5.4):
 *
 *     CV income = (closing market value + gains) - (opening market value + costs)
 *
 * gains = sale proceeds, dividends received (gross), and other distributions.
 * costs = expenditure acquiring interests during the year (purchase price + brokerage).
 *
 * The result is deliberately NOT floored here. Flooring is a portfolio-level rule —
 * see `sumCv` — and applying it per interest would wrongly stop one holding's loss
 * from offsetting another's gain within the same year.
 */
export function computeCvForHolding(summary: HoldingYearSummary): CvHoldingResult {
  const gainsNzd = summary.disposalProceedsNzd.plus(summary.dividendsNzd);
  const costsNzd = summary.acquiredCostNzd;
  const incomeNzd = summary.closingMarketValueNzd
    .plus(gainsNzd)
    .minus(summary.openingMarketValueNzd.plus(costsNzd));

  return {
    key: summary.key,
    ticker: summary.ticker,
    closingMarketValueNzd: summary.closingMarketValueNzd,
    gainsNzd,
    openingMarketValueNzd: summary.openingMarketValueNzd,
    costsNzd,
    incomeNzd,
  };
}

/**
 * The CV portfolio total, floored at zero.
 *
 * Spec §5.4: "Portfolio total under CV cannot be less than zero. A loss is reduced
 * to nil — it is not carried forward and not offset against other income." This is
 * called out as the single most misunderstood point of the regime, so the raw
 * (pre-floor) figure is returned alongside for the UI to show the user what their
 * loss actually was before it was extinguished.
 */
export function sumCv(results: readonly CvHoldingResult[]): { totalNzd: Decimal; rawTotalNzd: Decimal; lossExtinguished: boolean } {
  const rawTotalNzd = sum(results.map((r) => r.incomeNzd));
  const totalNzd = floorAtZero(rawTotalNzd);
  return { totalNzd, rawTotalNzd, lossExtinguished: rawTotalNzd.isNegative() };
}
