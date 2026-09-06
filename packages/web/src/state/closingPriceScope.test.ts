import { D, type CanonicalTxn } from '@fif-calculator/engine';
import { describe, expect, it } from 'vitest';
import { closingQuantityByTicker, requiredClosingPrices } from './requirements';
import { emptySession, type SessionState } from './session';

function txn(
  ticker: string,
  type: CanonicalTxn['type'],
  quantity: string,
  id = `${ticker}-${type}-${quantity}`,
): CanonicalTxn {
  return {
    id,
    sourceAccountId: 'acct_1',
    brokerId: 'TIGER',
    brokerRef: id,
    tradeDate: '2025-06-10',
    settleDate: null,
    nzIncomeYear: 2026,
    type,
    instrument: { ticker, exchange: 'NASDAQ', isin: null, name: null, assetClass: 'EQUITY' },
    quantity: D(quantity),
    pricePerUnit: D('100'),
    currency: 'USD',
    grossAmount: D('1000'),
    fees: D('0'),
    netAmount: D('1000'),
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

function sessionWith(txns: CanonicalTxn[], overrides: Partial<SessionState> = {}): SessionState {
  return {
    ...emptySession(),
    incomeYear: 2026,
    excludedCurrencies: [],
    accounts: [{ fileName: 'f.csv', brokerLabel: 'Tiger', verified: true, warnings: [], txns }],
    ...overrides,
  };
}

describe('closingQuantityByTicker', () => {
  it('nets acquisitions against disposals', () => {
    const s = sessionWith([txn('AMD', 'BUY', '100'), txn('AMD', 'SELL', '40')]);
    expect(closingQuantityByTicker(s).get('AMD')?.toString()).toBe('60');
  });

  it('includes opening holdings', () => {
    const s = sessionWith([txn('AMD', 'SELL', '40')], {
      openingHoldings: [
        { ticker: 'AMD', exchange: 'NASDAQ', quantity: '100', marketPricePerUnit: '10', currency: 'USD', costNzd: '1' },
      ],
    });
    expect(closingQuantityByTicker(s).get('AMD')?.toString()).toBe('60');
  });

  it('treats a confirmed inter-broker transfer as neutral, matching the ledger', () => {
    const out = txn('MSFT', 'TRANSFER_OUT', '50', 'out-1');
    const s = sessionWith([txn('MSFT', 'BUY', '50'), out], { confirmedTransferTxnIds: ['out-1'] });
    expect(closingQuantityByTicker(s).get('MSFT')?.toString()).toBe('50');
  });
});

describe('requiredClosingPrices only asks for what is still held', () => {
  /**
   * A real Tiger account asked for seventeen closing prices when only a few holdings
   * survived to year end. The ledger short-circuits a zero closing quantity to a zero
   * market value without ever consulting a price, so every one of those was wasted — a
   * wall of manual entry, and enough lookups to exhaust a free price API's daily quota
   * on figures that would then be thrown away.
   */
  it('skips a holding that was sold out during the year', () => {
    const s = sessionWith([txn('ADBE', 'BUY', '11'), txn('ADBE', 'SELL', '11'), txn('AMD', 'BUY', '85')]);
    expect(requiredClosingPrices(s).map((p) => p.ticker)).toEqual(['AMD']);
  });

  it('asks for a holding that is only partly sold', () => {
    const s = sessionWith([txn('AMD', 'BUY', '85'), txn('AMD', 'SELL', '28')]);
    expect(requiredClosingPrices(s).map((p) => p.ticker)).toEqual(['AMD']);
  });

  it('skips an opening holding fully disposed of in the year', () => {
    const s = sessionWith([txn('RYM', 'SELL', '80')], {
      openingHoldings: [
        { ticker: 'RYM', exchange: 'NZX', quantity: '80', marketPricePerUnit: '3', currency: 'NZD', costNzd: '240' },
      ],
    });
    expect(requiredClosingPrices(s)).toEqual([]);
  });

  it('never asks for an option, which is not an attributing FIF interest', () => {
    const option = txn('GOOG', 'OPTION_TRADE', '3', 'opt-1');
    option.instrument = { ...option.instrument!, assetClass: 'OPTION' };
    expect(requiredClosingPrices(sessionWith([option]))).toEqual([]);
  });

  it('does not ask when a short position leaves a negative net quantity', () => {
    // Not a holding to value at year end; the engine flags it separately.
    const s = sessionWith([txn('SHRT', 'SELL', '25')]);
    expect(requiredClosingPrices(s)).toEqual([]);
  });
});
