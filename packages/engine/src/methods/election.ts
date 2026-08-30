import { Decimal, ZERO, floorAtZero, sum } from '../money';
import type { HoldingYearSummary } from '../holdings/ledger';
import { computeCvForHolding, sumCv, type CvHoldingResult } from './cv';
import { computeFdrForHolding, type FdrHoldingResult } from './fdr';

export type FifMethod = 'FDR' | 'CV';

export interface ElectionResult {
  /** Portfolio total if FDR is elected (CV-only interests still contribute CV). */
  fdrTotalNzd: Decimal;
  /** Portfolio total if CV is elected across the board, floored at zero. */
  cvTotalNzd: Decimal;
  cvRawTotalNzd: Decimal;
  cvLossExtinguished: boolean;

  recommendedMethod: FifMethod;
  recommendedIncomeNzd: Decimal;
  explanation: string;

  perHoldingFdr: FdrHoldingResult[];
  perHoldingCv: CvHoldingResult[];
  /** Interests for which FDR is unavailable and which are therefore always CV. */
  fdrUnavailableKeys: string[];
}

/**
 * Chooses between FDR and CV for a natural person (spec §5.5).
 *
 * Three rules drive this and all three are enforced here:
 *  - The same method must apply across ALL interests where a choice exists. The
 *    taxpayer cannot use FDR for one stock and CV for another in the same year,
 *    which is why this compares two PORTFOLIO totals rather than picking per holding.
 *  - The taxpayer may use whichever portfolio total is lower.
 *  - FDR is unavailable for certain interests (non-ordinary shares, fixed-rate
 *    foreign equity, non-participating redeemable shares). Those are routed to CV
 *    and calculated separately from the election set, contributing to both totals.
 */
export function electMethod(
  summaries: readonly HoldingYearSummary[],
  incomeYear: number,
): ElectionResult {
  const inScope = summaries.filter((s) => s.scope.inScope);
  const electionSet = inScope.filter((s) => !s.fdrUnavailable);
  const cvOnlySet = inScope.filter((s) => s.fdrUnavailable);

  const perHoldingFdr = electionSet.map((s) => computeFdrForHolding(s, incomeYear));
  const perHoldingCv = inScope.map((s) => computeCvForHolding(s));

  const cvOnlyResults = perHoldingCv.filter((r) => cvOnlySet.some((s) => s.key === r.key));
  const cvOnlyTotal = sum(cvOnlyResults.map((r) => r.incomeNzd));

  // Under an FDR election, the CV-only interests still contribute their CV figure.
  const fdrTotalNzd = floorAtZero(sum(perHoldingFdr.map((r) => r.incomeNzd)).plus(cvOnlyTotal));

  const cvSummed = sumCv(perHoldingCv);
  const cvTotalNzd = cvSummed.totalNzd;

  const useCv = cvTotalNzd.lessThan(fdrTotalNzd);
  const recommendedMethod: FifMethod = useCv ? 'CV' : 'FDR';
  const recommendedIncomeNzd = useCv ? cvTotalNzd : fdrTotalNzd;

  return {
    fdrTotalNzd,
    cvTotalNzd,
    cvRawTotalNzd: cvSummed.rawTotalNzd,
    cvLossExtinguished: cvSummed.lossExtinguished,
    recommendedMethod,
    recommendedIncomeNzd,
    explanation: buildExplanation(recommendedMethod, fdrTotalNzd, cvTotalNzd, cvSummed.lossExtinguished),
    perHoldingFdr,
    perHoldingCv,
    fdrUnavailableKeys: cvOnlySet.map((s) => s.key),
  };
}

function buildExplanation(
  method: FifMethod,
  fdrTotal: Decimal,
  cvTotal: Decimal,
  lossExtinguished: boolean,
): string {
  const base =
    method === 'CV'
      ? `Comparative Value gives NZD ${cvTotal.toFixed(2)}, which is lower than FDR's NZD ${fdrTotal.toFixed(2)}, so CV is the better choice this year.`
      : `Fair Dividend Rate gives NZD ${fdrTotal.toFixed(2)}, which is no higher than CV's NZD ${cvTotal.toFixed(2)}, so FDR is the better choice this year.`;

  const consistency =
    ' Whichever you choose must be applied consistently across your whole portfolio for this year; you can change method in a later year.';

  const lossNote =
    method === 'CV' && lossExtinguished
      ? ' Your portfolio made an overall loss under CV. That loss is reduced to nil — it is not carried forward and cannot be offset against your other income.'
      : '';

  return base + consistency + lossNote;
}

/** Zero-income election result, for the case where nothing is in scope. */
export function emptyElection(): ElectionResult {
  return {
    fdrTotalNzd: ZERO,
    cvTotalNzd: ZERO,
    cvRawTotalNzd: ZERO,
    cvLossExtinguished: false,
    recommendedMethod: 'FDR',
    recommendedIncomeNzd: ZERO,
    explanation: 'No attributing FIF interests were found, so there is no FIF income to declare.',
    perHoldingFdr: [],
    perHoldingCv: [],
    fdrUnavailableKeys: [],
  };
}
