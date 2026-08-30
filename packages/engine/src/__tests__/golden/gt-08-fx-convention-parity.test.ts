import { describe, expect, it } from 'vitest';
import { calculateFif, type FifCalculationInput } from '../../calculate';
import { TableIrdRateProvider } from '../../fx/irdProvider';
import { D, roundNzd } from '../../money';

/**
 * GT-8 — FX convention parity.
 *
 * The same portfolio calculated under "actual daily rate" (policy A) and under the
 * "rolling 12-month average" (policy C) produces two different, correct, documented
 * figures. Both are asserted, and the result must record which convention was used —
 * spec §5.6 requires the chosen convention to appear on every exported report.
 */
function makeInput(fxPolicy: 'A' | 'C'): FifCalculationInput {
  return {
    incomeYear: 2026,
    fxPolicy,
    costBasisMethod: 'AVERAGE',
    ird: new TableIrdRateProvider({
      // Two published points in the income year: the rolling average is 0.6000.
      USD: { '2025-04-01': '0.5800', '2025-10-01': '0.6200' },
    }),
    txns: [],
    openingHoldings: [
      {
        instrument: { ticker: 'AAPL', exchange: 'NASDAQ', isin: null, name: null, assetClass: 'EQUITY' },
        quantity: D('1000'),
        marketPricePerUnit: D('220.00'),
        currency: 'USD',
        costNzd: D('300000'),
      },
    ],
    closingPrices: [
      {
        instrument: { ticker: 'AAPL', exchange: 'NASDAQ', isin: null, name: null, assetClass: 'EQUITY' },
        pricePerUnit: D('200.00'),
        currency: 'USD',
      },
    ],
  };
}

describe('GT-8 — FX convention parity', () => {
  it('policy A (actual daily rate) values the opening holding at the 1 April rate', () => {
    const result = calculateFif(makeInput('A'));
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;

    // 1,000 x USD 220 / 0.5800 = NZD 379,310.34; 5% of that is NZD 18,965.52.
    expect(roundNzd(result.election.fdrTotalNzd).toFixed(2)).toBe('18965.52');
    expect(result.fxPolicy).toBe('A');
  });

  it('policy C (rolling 12-month average) values it at the averaged rate', () => {
    const result = calculateFif(makeInput('C'));
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;

    // 1,000 x USD 220 / 0.6000 = NZD 366,666.67; 5% of that is NZD 18,333.33.
    expect(roundNzd(result.election.fdrTotalNzd).toFixed(2)).toBe('18333.33');
    expect(result.fxPolicy).toBe('C');
  });

  it('the two conventions produce genuinely different figures, and both are recorded', () => {
    const a = calculateFif(makeInput('A'));
    const c = calculateFif(makeInput('C'));
    if (a.status !== 'OK' || c.status !== 'OK') throw new Error('expected both to compute');

    expect(a.election.fdrTotalNzd.equals(c.election.fdrTotalNzd)).toBe(false);
    expect(a.fxPolicy).not.toBe(c.fxPolicy);
  });
});
