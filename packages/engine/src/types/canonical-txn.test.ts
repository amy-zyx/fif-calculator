import { describe, expect, it } from 'vitest';
import { D } from '../money';
import { canonicalTxnSchema } from './canonical-txn.schema';
import type { CanonicalTxn } from './canonical-txn';

function makeTxn(overrides: Partial<CanonicalTxn> = {}): CanonicalTxn {
  return {
    id: 'txn_1',
    sourceAccountId: 'acct_1',
    brokerId: 'IBKR',
    brokerRef: 'IBKR-000123',
    tradeDate: '2025-06-10',
    settleDate: '2025-06-12',
    nzIncomeYear: 2026,
    type: 'BUY',
    instrument: {
      ticker: 'AAPL',
      exchange: 'NASDAQ',
      isin: 'US0378331005',
      name: 'Apple Inc',
      assetClass: 'EQUITY',
    },
    quantity: D('100'),
    pricePerUnit: D('220.00'),
    currency: 'USD',
    grossAmount: D('22000.00'),
    fees: D('1.00'),
    netAmount: D('22001.00'),
    brokerQuotedRate: D('0.60'),
    brokerQuoteFrom: 'USD',
    brokerQuoteTo: 'USD',
    brokerRateDirectionConfidence: 'UNKNOWN',
    fxRateToNzd: null,
    fxRateSource: null,
    fxResolutionTrace: [],
    rawRow: { Symbol: 'AAPL' },
    parseWarnings: [],
    ...overrides,
  };
}

describe('canonicalTxnSchema', () => {
  it('accepts a well-formed transaction', () => {
    const result = canonicalTxnSchema.safeParse(makeTxn());
    expect(result.success).toBe(true);
  });

  it('rejects a plain-number quantity (the exact float trap the schema exists to catch)', () => {
    const txn = { ...makeTxn(), quantity: 100 as unknown as CanonicalTxn['quantity'] };
    const result = canonicalTxnSchema.safeParse(txn);
    expect(result.success).toBe(false);
  });

  it('rejects an unknown TxnType', () => {
    const txn = { ...makeTxn(), type: 'NOT_A_REAL_TYPE' as unknown as CanonicalTxn['type'] };
    expect(canonicalTxnSchema.safeParse(txn).success).toBe(false);
  });

  it('rejects a non-ISO trade date', () => {
    const txn = { ...makeTxn(), tradeDate: '10/06/2025' };
    expect(canonicalTxnSchema.safeParse(txn).success).toBe(false);
  });
});
