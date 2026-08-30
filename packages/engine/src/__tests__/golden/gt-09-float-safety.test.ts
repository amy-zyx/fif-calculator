import { describe, expect, it } from 'vitest';
import { calculateFif, type FifCalculationInput } from '../../calculate';
import { TableIrdRateProvider } from '../../fx/irdProvider';
import { D, roundNzd } from '../../money';
import type { CanonicalTxn } from '../../types/canonical-txn';

/**
 * GT-9 — float safety.
 *
 * A portfolio of 10,000 fractional-share transactions must reconcile to the cent.
 * Every one of these amounts (0.0001 shares, USD 1.23) is unrepresentable in binary
 * floating point; accumulating them as JS numbers drifts. Through decimal.js the
 * total is exact.
 */
const TXN_COUNT = 10_000;
const INSTRUMENT = {
  ticker: 'FRAC',
  exchange: 'NASDAQ',
  isin: null,
  name: null,
  assetClass: 'EQUITY' as const,
};

function makeTxn(i: number): CanonicalTxn {
  return {
    id: `frac-${i}`,
    sourceAccountId: 'acct_1',
    brokerId: 'SHARESIES',
    brokerRef: `REF-${i}`,
    tradeDate: '2025-06-10',
    settleDate: null,
    nzIncomeYear: 2026,
    type: 'BUY',
    instrument: INSTRUMENT,
    quantity: D('0.0001'),
    pricePerUnit: D('12300'),
    currency: 'USD',
    grossAmount: D('1.23'),
    fees: D('0'),
    netAmount: D('1.23'),
    brokerQuotedRate: null,
    brokerQuoteFrom: null,
    brokerQuoteTo: null,
    brokerRateDirectionConfidence: 'UNKNOWN',
    fxRateToNzd: null,
    fxRateSource: null,
    fxResolutionTrace: [],
    rawRow: {},
    parseWarnings: [],
  };
}

const input: FifCalculationInput = {
  incomeYear: 2026,
  fxPolicy: 'A',
  costBasisMethod: 'AVERAGE',
  thresholdOverrideNzd: D('0'),
  ird: new TableIrdRateProvider({ USD: { '2025-04-01': '0.6000' } }),
  txns: Array.from({ length: TXN_COUNT }, (_, i) => makeTxn(i)),
  openingHoldings: [],
  closingPrices: [{ instrument: INSTRUMENT, pricePerUnit: D('12300'), currency: 'USD' }],
};

describe('GT-9 — float safety across 10,000 fractional-share transactions', () => {
  const result = calculateFif(input);

  it('computes without blocking', () => {
    expect(result.status).toBe('OK');
  });

  it('reconciles the cost basis to the cent with no drift', () => {
    if (result.status !== 'OK') throw new Error('expected OK');
    const frac = result.holdings.find((h) => h.ticker === 'FRAC');

    // 10,000 x USD 1.23 = USD 12,300 exactly; / 0.6000 = NZD 20,500.00 exactly.
    expect(roundNzd(frac!.acquiredCostNzd).toFixed(2)).toBe('20500.00');
    expect(frac!.acquiredCostNzd.toString()).toBe('20500');
  });

  it('accumulates 10,000 fractional quantities to exactly 1 share', () => {
    if (result.status !== 'OK') throw new Error('expected OK');
    const frac = result.holdings.find((h) => h.ticker === 'FRAC');
    expect(frac!.acquiredQuantity.toString()).toBe('1');
  });

  it('the equivalent native-float accumulation does NOT reconcile — the drift this guards against', () => {
    let floatTotal = 0;
    for (let i = 0; i < TXN_COUNT; i += 1) floatTotal += 1.23;
    expect(floatTotal).not.toBe(12300);
  });
});
