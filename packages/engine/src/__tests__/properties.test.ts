import { describe, expect, it } from 'vitest';
import { calculateFif } from '../calculate';
import { ZERO } from '../money';
import { FIXTURES } from './golden/fixtures';
import { toCalculationInput } from './golden/loader';

/**
 * Invariants the spec requires to hold across EVERY calculation, not just the ones
 * a golden fixture happens to exercise (spec §9, "Also required").
 */
describe('engine invariants', () => {
  const results = FIXTURES.map((fixture) => ({
    id: fixture.id,
    result: calculateFif(toCalculationInput(fixture)),
  }));

  it('FDR income is never negative, for any holding in any fixture', () => {
    for (const { id, result } of results) {
      if (result.status !== 'OK') continue;
      for (const holding of result.election.perHoldingFdr) {
        expect(
          holding.incomeNzd.isNegative(),
          `${id}: FDR income for ${holding.ticker} was negative (${holding.incomeNzd.toString()})`,
        ).toBe(false);
      }
    }
  });

  it('the quick sale adjustment is never negative', () => {
    for (const { id, result } of results) {
      if (result.status !== 'OK') continue;
      for (const holding of result.election.perHoldingFdr) {
        expect(
          holding.quickSale.adjustmentNzd.isNegative(),
          `${id}: quick sale adjustment for ${holding.ticker} was negative`,
        ).toBe(false);
      }
    }
  });

  it('the CV portfolio total is never negative, even when the raw total is a loss', () => {
    for (const { id, result } of results) {
      if (result.status !== 'OK') continue;
      expect(result.election.cvTotalNzd.isNegative(), `${id}: CV portfolio total was negative`).toBe(false);
    }
  });

  it('the recommended income is never negative and never exceeds both method totals', () => {
    for (const { id, result } of results) {
      if (result.status !== 'OK') continue;
      const { recommendedIncomeNzd, fdrTotalNzd, cvTotalNzd } = result.election;
      expect(recommendedIncomeNzd.isNegative(), `${id}: recommended income was negative`).toBe(false);
      expect(
        recommendedIncomeNzd.greaterThan(fdrTotalNzd) && recommendedIncomeNzd.greaterThan(cvTotalNzd),
        `${id}: recommended income exceeded both method totals`,
      ).toBe(false);
    }
  });

  it('the recommended figure is always the lower of the two portfolio totals', () => {
    for (const { id, result } of results) {
      if (result.status !== 'OK') continue;
      const { recommendedIncomeNzd, fdrTotalNzd, cvTotalNzd } = result.election;
      const lower = fdrTotalNzd.lessThanOrEqualTo(cvTotalNzd) ? fdrTotalNzd : cvTotalNzd;
      expect(recommendedIncomeNzd.equals(lower), `${id}: did not recommend the lower total`).toBe(true);
    }
  });

  it('a blocked or ambiguous result never carries a recommended FIF figure', () => {
    for (const { id, result } of results) {
      if (result.status === 'BLOCKED' || result.status === 'THRESHOLD_AMBIGUOUS') {
        expect(result, `${id}: a non-computable result exposed an election`).not.toHaveProperty('election');
      }
    }
  });

  it('peak cost is never negative', () => {
    for (const { id, result } of results) {
      if (result.status !== 'OK' && result.status !== 'NOT_IN_FIF') continue;
      expect(result.deMinimis.peakCostNzd.lessThan(ZERO), `${id}: peak cost was negative`).toBe(false);
    }
  });
});
