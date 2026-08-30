import { describe, expect, it } from 'vitest';
import type { ParsedFile } from '../adapters/types';
import { applyMapping, distinctTypeValues, isMappingComplete, type ColumnMapping } from './applyMapping';

function makeFile(): ParsedFile {
  return {
    fileName: 'my-broker-export.csv',
    headers: ['Date', 'Action', 'Symbol', 'Ccy', 'Total', 'Qty', 'Rate'],
    rows: [
      ['2025-06-10', 'Buy', 'AAPL', 'USD', '22000', '100', '0.5800'],
      ['2025-09-15', 'Sell', 'AAPL', 'USD', '9400', '40', '0.5900'],
      ['2025-09-05', 'Div', 'AAPL', 'USD', '25', '', ''],
    ],
    sourceAccountId: 'acct_1',
  };
}

const FULL_MAPPING: ColumnMapping = {
  tradeDate: 'Date',
  type: 'Action',
  ticker: 'Symbol',
  currency: 'Ccy',
  grossAmount: 'Total',
  quantity: 'Qty',
  fxRateColumn: 'Rate',
};

const TYPE_MAP = { Buy: 'BUY', Sell: 'SELL', Div: 'DIVIDEND' } as const;

describe('isMappingComplete', () => {
  it('is false when a required field is unmapped', () => {
    expect(isMappingComplete({ tradeDate: 'Date' })).toBe(false);
  });

  it('is true once every required field is mapped', () => {
    expect(isMappingComplete(FULL_MAPPING)).toBe(true);
  });
});

describe('distinctTypeValues', () => {
  it('returns the sorted distinct raw values in the mapped type column', () => {
    const file = makeFile();
    expect(distinctTypeValues(file, { type: 'Action' })).toEqual(['Buy', 'Div', 'Sell']);
  });

  it('returns [] when no type column is mapped', () => {
    expect(distinctTypeValues(makeFile(), {})).toEqual([]);
  });
});

describe('applyMapping', () => {
  it('produces one CanonicalTxn per row when every required field is mapped', () => {
    const { txns, warnings } = applyMapping(makeFile(), FULL_MAPPING, TYPE_MAP, 'acct_1');
    expect(warnings.filter((w) => w.severity === 'error')).toEqual([]);
    expect(txns).toHaveLength(3);
  });

  it('maps raw type values via the type value map', () => {
    const { txns } = applyMapping(makeFile(), FULL_MAPPING, TYPE_MAP, 'acct_1');
    expect(txns.map((t) => t.type)).toEqual(['BUY', 'SELL', 'DIVIDEND']);
  });

  it('defaults to UNKNOWN and warns when a raw type value has no mapping', () => {
    const { txns } = applyMapping(makeFile(), FULL_MAPPING, { Buy: 'BUY' } as never, 'acct_1');
    const sell = txns.find((t) => t.rawRow.Action === 'Sell');
    expect(sell?.type).toBe('UNKNOWN');
    expect(sell?.parseWarnings.some((w) => w.includes('no mapping'))).toBe(true);
  });

  it('captures the FX rate column verbatim without resolving or inverting it', () => {
    const { txns } = applyMapping(makeFile(), FULL_MAPPING, TYPE_MAP, 'acct_1');
    expect(txns[0]?.brokerQuotedRate?.toString()).toBe('0.58');
    expect(txns[0]?.fxRateToNzd).toBeNull(); // resolution is the engine's job, not the wizard's
  });

  it('skips a row missing a required mapped field and reports it as a warning', () => {
    const file = makeFile();
    file.rows.push(['', 'Buy', 'MSFT', 'USD', '1000', '10', '']);
    const { txns, warnings } = applyMapping(file, FULL_MAPPING, TYPE_MAP, 'acct_1');
    expect(txns).toHaveLength(3);
    expect(warnings.some((w) => w.severity === 'error')).toBe(true);
  });

  it('normalises quantity to a positive value regardless of sign in the source column', () => {
    const file = makeFile();
    file.rows[1]![5] = '-40'; // some exports sign quantity by direction
    const { txns } = applyMapping(file, FULL_MAPPING, TYPE_MAP, 'acct_1');
    const sell = txns.find((t) => t.type === 'SELL');
    expect(sell?.quantity?.toString()).toBe('40');
  });
});
