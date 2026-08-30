import { D } from '@fif-calculator/engine';
import { describe, expect, it } from 'vitest';
import type { CanonicalTxn } from '@fif-calculator/engine';
import { missingClosingPrices, missingFxRates, requiredClosingPrices, requiredFxRates } from './requirements';
import { emptySession, fxRateKey, type SessionState } from './session';

function txn(overrides: Partial<CanonicalTxn> = {}): CanonicalTxn {
  return {
    id: 't1',
    sourceAccountId: 'acct_1',
    brokerId: 'IBKR',
    brokerRef: null,
    tradeDate: '2025-06-10',
    settleDate: null,
    nzIncomeYear: 2026,
    type: 'BUY',
    instrument: { ticker: 'AAPL', exchange: 'NASDAQ', isin: null, name: null, assetClass: 'EQUITY' },
    quantity: D('100'),
    pricePerUnit: D('220'),
    currency: 'USD',
    grossAmount: D('22000'),
    fees: D('0'),
    netAmount: D('22000'),
    brokerQuotedRate: null,
    brokerQuoteFrom: null,
    brokerQuoteTo: null,
    brokerRateDirectionConfidence: 'UNKNOWN',
    fxRateToNzd: null,
    fxRateSource: null,
    fxResolutionTrace: [],
    rawRow: {},
    parseWarnings: [],
    ...overrides,
  };
}

function sessionWith(txns: CanonicalTxn[]): SessionState {
  return {
    ...emptySession(),
    accounts: [{ fileName: 'f.csv', brokerLabel: 'IBKR', verified: false, txns, warnings: [] }],
  };
}

describe('requiredClosingPrices', () => {
  it('asks for a closing price for each equity seen in the year', () => {
    const session = sessionWith([txn()]);
    expect(requiredClosingPrices(session)).toEqual([
      { ticker: 'AAPL', exchange: 'NASDAQ', currency: 'USD' },
    ]);
  });

  it('does not ask for a closing price for an option — never an attributing FIF interest', () => {
    const session = sessionWith([
      txn({
        id: 'opt',
        type: 'OPTION_TRADE',
        instrument: { ticker: 'SPY250620P500', exchange: null, isin: null, name: null, assetClass: 'OPTION' },
      }),
    ]);
    expect(requiredClosingPrices(session)).toEqual([]);
  });
});

describe('requiredFxRates', () => {
  it('asks for the trade date and both year boundaries for each foreign currency', () => {
    const rates = requiredFxRates(sessionWith([txn()]));
    const keys = rates.map((r) => `${r.currency}|${r.date}`);
    expect(keys).toContain('USD|2025-06-10'); // the trade date
    expect(keys).toContain('USD|2025-04-01'); // opening valuation
    expect(keys).toContain('USD|2026-03-31'); // closing valuation
  });

  it('never asks for an NZD rate', () => {
    const rates = requiredFxRates(sessionWith([txn({ currency: 'NZD' })]));
    expect(rates.every((r) => r.currency !== 'NZD')).toBe(true);
  });
});

describe('missing value gating', () => {
  it('reports a rate as missing until it is filled in', () => {
    const session = sessionWith([txn()]);
    expect(missingFxRates(session).length).toBeGreaterThan(0);

    const filled: SessionState = {
      ...session,
      fxRates: Object.fromEntries(
        requiredFxRates(session).map((r) => [fxRateKey(r.currency, r.date), '0.6000']),
      ),
    };
    expect(missingFxRates(filled)).toEqual([]);
  });

  it('treats a blank string as missing rather than as zero', () => {
    const session = sessionWith([txn()]);
    const blank: SessionState = {
      ...session,
      fxRates: Object.fromEntries(requiredFxRates(session).map((r) => [fxRateKey(r.currency, r.date), '  '])),
    };
    expect(missingFxRates(blank).length).toBeGreaterThan(0);
  });

  it('reports a closing price as missing until it has a value', () => {
    const session = sessionWith([txn()]);
    expect(missingClosingPrices(session)).toHaveLength(1);

    const filled: SessionState = {
      ...session,
      closingPrices: [{ ticker: 'AAPL', exchange: 'NASDAQ', pricePerUnit: '200', currency: 'USD' }],
    };
    expect(missingClosingPrices(filled)).toEqual([]);
  });
});
