import { D, instrumentKey, type CanonicalTxn, type InstrumentRef } from '@fif-calculator/engine';
import { describe, expect, it } from 'vitest';
import { runCalculation } from './runCalculation';
import { emptySession, type SessionState } from './session';

const AU_SHARE: InstrumentRef = {
  ticker: 'BHP',
  exchange: 'ASX',
  isin: null,
  name: null,
  assetClass: 'EQUITY',
};

function buy(): CanonicalTxn {
  return {
    id: 'buy-bhp',
    sourceAccountId: 'acct_1',
    brokerId: 'IBKR',
    brokerRef: null,
    tradeDate: '2025-06-10',
    settleDate: null,
    nzIncomeYear: 2026,
    type: 'BUY',
    instrument: AU_SHARE,
    quantity: D('1000'),
    pricePerUnit: D('60'),
    currency: 'AUD',
    grossAmount: D('60000'),
    fees: D('0'),
    netAmount: D('60000'),
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

function session(overrides: SessionState['scopeOverrides'] = {}): SessionState {
  return {
    ...emptySession(),
    incomeYear: 2026,
    accounts: [{ fileName: 'ibkr.csv', brokerLabel: 'IBKR', verified: false, warnings: [], txns: [buy()] }],
    closingPrices: [{ ticker: 'BHP', exchange: 'ASX', pricePerUnit: '60', currency: 'AUD' }],
    fxRates: {
      'AUD|2025-04-01': '0.9000',
      'AUD|2025-06-10': '0.9000',
      'AUD|2026-03-31': '0.9000',
    },
    scopeOverrides: overrides,
  };
}

describe('per-holding scope overrides', () => {
  it('without an override, an ASX holding is in scope — the bundled AU exemption list is empty', () => {
    const result = runCalculation(session());
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    // AUD 60,000 / 0.90 = NZD 66,666.67, over the threshold.
    expect(result.deMinimis.inFif).toBe(true);
    expect(result.holdings.find((h) => h.ticker === 'BHP')?.scope.inScope).toBe(true);
  });

  it('forcing a holding out of scope removes it from the FIF calculation entirely', () => {
    const key = instrumentKey(AU_SHARE);
    const result = runCalculation(
      session({
        [key]: { inScope: false, reason: 'Covered by the Australian listed share exemption.' },
      }),
    );

    // With its only holding excluded, nothing is left to bring the taxpayer into FIF.
    expect(result.status).toBe('NOT_IN_FIF');
    if (result.status !== 'NOT_IN_FIF') return;
    expect(result.deMinimis.peakCostNzd.toFixed(2)).toBe('0.00');
  });

  it('surfaces an excluded holding rather than hiding it', () => {
    const key = instrumentKey(AU_SHARE);
    const result = runCalculation(
      session({ [key]: { inScope: false, reason: 'Australian listed share exemption.' } }),
    );
    expect(result.excluded.some((e) => e.ticker === 'BHP')).toBe(true);
  });

  it('marking FDR unavailable routes the holding to CV, out of the FDR election set', () => {
    const key = instrumentKey(AU_SHARE);
    const result = runCalculation(
      session({ [key]: { inScope: true, reason: 'Fixed-rate foreign equity.', fdrUnavailable: true } }),
    );

    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;
    expect(result.election.fdrUnavailableKeys).toContain(key);
    // It contributes a CV figure but never an FDR one.
    expect(result.election.perHoldingFdr.some((h) => h.ticker === 'BHP')).toBe(false);
    expect(result.election.perHoldingCv.some((h) => h.ticker === 'BHP')).toBe(true);
  });
});
