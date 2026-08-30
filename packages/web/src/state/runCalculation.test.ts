import { D, type CanonicalTxn } from '@fif-calculator/engine';
import { describe, expect, it } from 'vitest';
import { runCalculation, txnInstrumentsByTicker } from './runCalculation';
import { emptySession, type SessionState } from './session';

function buyTxn(exchange: string | null, id = 'buy-1'): CanonicalTxn {
  return {
    id,
    sourceAccountId: 'acct_1',
    brokerId: 'IBKR',
    brokerRef: null,
    tradeDate: '2025-06-10',
    settleDate: null,
    nzIncomeYear: 2026,
    type: 'BUY',
    // Broker adapters frequently leave exchange null — the IBKR adapter does.
    instrument: { ticker: 'NVDA', exchange, isin: null, name: null, assetClass: 'EQUITY' },
    quantity: D('100'),
    pricePerUnit: D('100'),
    currency: 'USD',
    grossAmount: D('10000'),
    fees: D('0'),
    netAmount: D('10000'),
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

/**
 * The user typed an exchange when entering their opening holding; the broker file did
 * not carry one. Before reconciliation these keyed as two different instruments, the
 * opening holding never attached to the traded position, and FDR silently came out at
 * zero off an opening market value of zero.
 */
function sessionWithMismatchedExchange(): SessionState {
  return {
    ...emptySession(),
    incomeYear: 2026,
    accounts: [
      { fileName: 'ibkr.csv', brokerLabel: 'IBKR', verified: false, warnings: [], txns: [buyTxn(null)] },
    ],
    openingHoldings: [
      {
        ticker: 'NVDA',
        exchange: 'NASDAQ', // user typed this; the file has none
        quantity: '1000',
        marketPricePerUnit: '100',
        currency: 'USD',
        costNzd: '160000',
      },
    ],
    closingPrices: [{ ticker: 'NVDA', exchange: 'NASDAQ', pricePerUnit: '150', currency: 'USD' }],
    fxRates: {
      'USD|2025-04-01': '0.6000',
      'USD|2025-06-10': '0.6000',
      'USD|2026-03-31': '0.6000',
    },
  };
}

describe('instrument reconciliation between hand-entered holdings and broker files', () => {
  it('attaches the opening holding to the traded position despite a mismatched exchange', () => {
    const result = runCalculation(sessionWithMismatchedExchange());
    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;

    // One holding, not two.
    expect(result.holdings.filter((h) => h.scope.inScope)).toHaveLength(1);

    const nvda = result.holdings.find((h) => h.ticker === 'NVDA');
    // 1,000 x USD 100 / 0.60 = NZD 166,666.67 — the whole point: NOT zero.
    expect(nvda?.openingMarketValueNzd.toFixed(2)).toBe('166666.67');
    expect(nvda?.openingQuantity.toString()).toBe('1000');
  });

  it('produces a non-zero FDR figure, which is what the mis-keying silently destroyed', () => {
    const result = runCalculation(sessionWithMismatchedExchange());
    if (result.status !== 'OK') throw new Error('expected OK');
    // 5% of 166,666.67 = 8,333.33, with no quick sale (nothing was disposed of).
    expect(result.election.fdrTotalNzd.toFixed(2)).toBe('8333.33');
  });
});

describe('txnInstrumentsByTicker', () => {
  it('maps a ticker that has one identity across the files', () => {
    const session = sessionWithMismatchedExchange();
    expect(txnInstrumentsByTicker(session).get('NVDA')).toBeDefined();
  });

  it('refuses to map a ticker listed under two identities, rather than picking one', () => {
    const session: SessionState = {
      ...emptySession(),
      accounts: [
        {
          fileName: 'two.csv',
          brokerLabel: 'IBKR',
          verified: false,
          warnings: [],
          // The same symbol on two exchanges is two different instruments; only what
          // the user typed can distinguish them, so reconciliation must not guess.
          txns: [buyTxn('ASX', 'buy-asx'), buyTxn('LSE', 'buy-lse')],
        },
      ],
    };
    expect(txnInstrumentsByTicker(session).has('NVDA')).toBe(false);
  });
});
