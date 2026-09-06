import { D, type CanonicalTxn } from '@fif-calculator/engine';
import { describe, expect, it } from 'vitest';
import { DEFAULT_EXCLUDED_CURRENCIES, applyCurrencyFilter, emptySession } from './session';

function txn(ticker: string, currency: string, id = `${ticker}-${currency}`): CanonicalTxn {
  return {
    id,
    sourceAccountId: 'acct_1',
    brokerId: 'SHARESIES',
    brokerRef: id,
    tradeDate: '2025-06-10',
    settleDate: null,
    nzIncomeYear: 2026,
    type: 'BUY',
    instrument: { ticker, exchange: null, isin: null, name: null, assetClass: 'EQUITY' },
    quantity: D('10'),
    pricePerUnit: D('10'),
    currency,
    grossAmount: D('100'),
    fees: D('0'),
    netAmount: D('100'),
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

describe('currency filter at the import boundary', () => {
  it('excludes NZD and AUD by default', () => {
    expect(emptySession().excludedCurrencies).toEqual(DEFAULT_EXCLUDED_CURRENCIES);
  });

  it('drops excluded-currency trades so they never reach the calculation', () => {
    const { kept } = applyCurrencyFilter(
      [txn('FSF', 'NZD'), txn('BHP', 'AUD'), txn('QQQ', 'USD')],
      ['NZD', 'AUD'],
    );
    expect(kept.map((t) => t.instrument?.ticker)).toEqual(['QQQ']);
  });

  it('reports what it removed, per currency, so the removal is never silent', () => {
    const { summary } = applyCurrencyFilter(
      [txn('FSF', 'NZD'), txn('IFT', 'NZD'), txn('BHP', 'AUD'), txn('QQQ', 'USD')],
      ['NZD', 'AUD'],
    );
    expect(summary?.droppedByCurrency).toEqual({ NZD: 2, AUD: 1 });
    expect(summary?.currencies).toEqual(['AUD', 'NZD']);
    expect(summary?.droppedTickers).toEqual(['BHP', 'FSF', 'IFT']);
  });

  it('is case-insensitive, since Sharesies writes lowercase codes', () => {
    const { kept } = applyCurrencyFilter([txn('FSF', 'nzd'), txn('QQQ', 'usd')], ['NZD']);
    expect(kept.map((t) => t.instrument?.ticker)).toEqual(['QQQ']);
  });

  it('keeps everything and reports nothing when no currency is excluded', () => {
    const all = [txn('FSF', 'NZD'), txn('QQQ', 'USD')];
    const { kept, summary } = applyCurrencyFilter(all, []);
    expect(kept).toHaveLength(2);
    expect(summary).toBeUndefined();
  });

  it('reports no summary when nothing actually matched the filter', () => {
    const { summary } = applyCurrencyFilter([txn('QQQ', 'USD')], ['NZD', 'AUD']);
    expect(summary).toBeUndefined();
  });

  it('does not list a ticker as removed when it still has trades in a kept currency', () => {
    // A dual-listed holding traded in both currencies has NOT disappeared, and saying
    // it was "removed entirely" would be more misleading than saying nothing.
    const { summary } = applyCurrencyFilter(
      [txn('BHP', 'AUD', 'bhp-aud'), txn('BHP', 'USD', 'bhp-usd')],
      ['AUD'],
    );
    expect(summary?.droppedByCurrency).toEqual({ AUD: 1 });
    expect(summary?.droppedTickers).toEqual([]);
  });
});
