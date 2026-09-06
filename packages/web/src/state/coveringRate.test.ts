import { D, type CanonicalTxn } from '@fif-calculator/engine';
import { describe, expect, it } from 'vitest';
import { coveringRate, missingFxRates, requiredCurrencies } from './requirements';
import { emptySession, fxRateKey, type SessionState } from './session';

function txn(currency: string, date: string, id = `${currency}-${date}`): CanonicalTxn {
  return {
    id,
    sourceAccountId: 'acct_1',
    brokerId: 'IBKR',
    brokerRef: id,
    tradeDate: date,
    settleDate: null,
    nzIncomeYear: 2026,
    type: 'BUY',
    instrument: { ticker: 'AAPL', exchange: 'NASDAQ', isin: null, name: null, assetClass: 'EQUITY' },
    quantity: D('10'),
    pricePerUnit: D('100'),
    currency,
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

function session(rates: Record<string, string> = {}): SessionState {
  return {
    ...emptySession(),
    incomeYear: 2026,
    excludedCurrencies: [],
    accounts: [
      {
        fileName: 'f.csv',
        brokerLabel: 'IBKR',
        verified: false,
        warnings: [],
        txns: [txn('USD', '2025-06-10'), txn('USD', '2025-06-22'), txn('USD', '2025-09-15')],
      },
    ],
    fxRates: rates,
  };
}

describe('coveringRate — IRD rates carry forward', () => {
  it('finds a rate entered for the exact date', () => {
    const s = session({ [fxRateKey('USD', '2025-06-10')]: '0.6000' });
    expect(coveringRate(s, 'USD', '2025-06-10')).toEqual({ date: '2025-06-10', value: '0.6000', exact: true });
  });

  it('carries the most recent earlier rate forward, as IRD monthly tables are applied', () => {
    const s = session({ [fxRateKey('USD', '2025-06-10')]: '0.6000' });
    expect(coveringRate(s, 'USD', '2025-06-22')).toEqual({ date: '2025-06-10', value: '0.6000', exact: false });
  });

  it('prefers the nearest earlier rate when several exist', () => {
    const s = session({
      [fxRateKey('USD', '2025-04-15')]: '0.5800',
      [fxRateKey('USD', '2025-06-15')]: '0.6000',
    });
    expect(coveringRate(s, 'USD', '2025-09-15')?.value).toBe('0.6000');
  });

  it('never reaches forward to a later rate', () => {
    const s = session({ [fxRateKey('USD', '2025-09-15')]: '0.6100' });
    expect(coveringRate(s, 'USD', '2025-06-10')).toBeNull();
  });

  it('does not borrow a rate from a different currency', () => {
    const s = session({ [fxRateKey('AUD', '2025-06-10')]: '0.9200' });
    expect(coveringRate(s, 'USD', '2025-06-10')).toBeNull();
  });

  it('treats a blank entry as absent rather than as a rate', () => {
    const s = session({ [fxRateKey('USD', '2025-06-10')]: '   ' });
    expect(coveringRate(s, 'USD', '2025-06-10')).toBeNull();
  });
});

describe('missingFxRates honours carry-forward', () => {
  it('still blocks when nothing has been entered', () => {
    expect(missingFxRates(session()).length).toBeGreaterThan(0);
  });

  it('a single early rate covers every later date for that currency', () => {
    // The year opens 2025-04-01, so a rate there covers everything after it.
    const s = session({ [fxRateKey('USD', '2025-04-01')]: '0.6000' });
    expect(missingFxRates(s)).toEqual([]);
  });

  it('leaves dates before the first entered rate outstanding', () => {
    const s = session({ [fxRateKey('USD', '2025-06-15')]: '0.6000' });
    const missing = missingFxRates(s).map((r) => r.date);
    expect(missing).toContain('2025-04-01');
    expect(missing).not.toContain('2025-09-15');
  });
});

describe('requiredCurrencies', () => {
  it('lists each distinct currency once, for per-currency entry', () => {
    expect(requiredCurrencies(session())).toEqual(['USD']);
  });
});
