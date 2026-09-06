import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCsvText } from '../../lib/parseFile';
import { ibkrActivityStatementAdapter } from '../ibkr/ibkrAdapter';
import { parseTigerSymbol, parseTigerTradeDate, tigerActivityStatementAdapter } from './tigerAdapter';

const fixture = readFileSync(join(__dirname, 'fixtures', 'tiger-activity-statement.csv'), 'utf-8');
const load = () => parseCsvText(fixture, 'tiger.csv', 'acct_1');

describe('parseTigerSymbol', () => {
  it('splits ticker and market suffix', () => {
    expect(parseTigerSymbol('BHP GROUP LTD (BHP.AU)')).toEqual({
      ticker: 'BHP',
      marketSuffix: 'AU',
      name: 'BHP GROUP LTD',
      contract: null,
    });
  });

  it('handles a US symbol with no suffix', () => {
    expect(parseTigerSymbol('Adobe (ADBE)')).toEqual({
      ticker: 'ADBE',
      marketSuffix: null,
      name: 'Adobe',
      contract: null,
    });
  });

  it('takes the underlying ticker from an option contract, keeping the contract itself', () => {
    // The strike's decimal point must not be mistaken for a market suffix separator.
    expect(parseTigerSymbol('Alphabet (GOOG 20250905 PUT 215.0)')).toEqual({
      ticker: 'GOOG',
      marketSuffix: null,
      name: 'GOOG 20250905 PUT 215.0',
      contract: 'GOOG 20250905 PUT 215.0',
    });
  });

  it('handles a name containing its own parentheses', () => {
    expect(parseTigerSymbol('Coinbase Global, Inc. (COIN)')?.ticker).toBe('COIN');
  });

  it('returns null for an unparseable symbol', () => {
    expect(parseTigerSymbol('Total')).toBeNull();
  });
});

describe('parseTigerTradeDate', () => {
  it('takes the exchange-local date from the multi-line Trade Time cell', () => {
    expect(parseTigerTradeDate('2025-07-22\n11:29:55, Australia/Sydney')).toBe('2025-07-22');
  });

  it('returns null when there is no date', () => {
    expect(parseTigerTradeDate('')).toBeNull();
  });
});

describe('detection', () => {
  it('recognises a Tiger statement confidently', () => {
    const file = load();
    expect(tigerActivityStatementAdapter.detect(file.headers, file.rows)).toBeGreaterThanOrEqual(0.8);
  });

  it('scores an unrelated CSV at zero', () => {
    expect(tigerActivityStatementAdapter.detect(['Date', 'Amount'], [['2025-01-01', '5']])).toBe(0);
  });

  it('outscores the IBKR adapter on a Tiger file, so the right one wins', () => {
    const file = load();
    const tiger = tigerActivityStatementAdapter.detect(file.headers, file.rows);
    const ibkr = ibkrActivityStatementAdapter.detect(file.headers, file.rows);
    expect(tiger).toBeGreaterThan(ibkr);
  });
});

describe('the double-counting trap', () => {
  /**
   * The heart of this adapter. In the real export a row WITH a symbol is the order
   * aggregate and the blank-symbol rows after it are its fills, summing exactly to the
   * order. Counting both doubles quantity and cost — which doubles the de minimis peak
   * and FDR income. Both row kinds are marked DATA, so nothing but the blank symbol
   * distinguishes them.
   */
  it('counts an order once, not once per fill', () => {
    const { txns } = tigerActivityStatementAdapter.parse(load());
    const bhp = txns.filter((t) => t.instrument?.ticker === 'BHP');

    expect(bhp).toHaveLength(1);
    // The fixture's order is 100, split into fills of 60 and 40. Counting the fills as
    // well would give 200.
    expect(bhp[0]?.quantity?.toString()).toBe('100');
    expect(bhp[0]?.grossAmount.toString()).toBe('4000');
  });

  it('ignores the TOTAL rollup row as well', () => {
    const { txns } = tigerActivityStatementAdapter.parse(load());
    expect(txns.some((t) => t.rawRow['Symbol']?.startsWith('Total'))).toBe(false);
  });
});

describe('parsing', () => {
  it('maps Open to BUY and Close to SELL, with positive quantities', () => {
    const { txns } = tigerActivityStatementAdapter.parse(load());
    const buy = txns.find((t) => t.instrument?.ticker === 'BHP');
    const sell = txns.find((t) => t.instrument?.ticker === 'ADBE');

    expect(buy?.type).toBe('BUY');
    expect(sell?.type).toBe('SELL');
    expect(sell?.quantity?.toString()).toBe('10');
    expect(sell?.quantity?.isNegative()).toBe(false);
  });

  it('uses the exchange-local trade date, not the settle date', () => {
    const { txns } = tigerActivityStatementAdapter.parse(load());
    const bhp = txns.find((t) => t.instrument?.ticker === 'BHP');
    expect(bhp?.tradeDate).toBe('2025-07-22');
    expect(bhp?.settleDate).toBe('2025-07-24');
    expect(bhp?.nzIncomeYear).toBe(2026);
  });

  it('sums the many fee columns into one figure', () => {
    const { txns } = tigerActivityStatementAdapter.parse(load());
    // Settlement 2.00 + commission 5.00 on the BHP order row.
    expect(txns.find((t) => t.instrument?.ticker === 'BHP')?.fees.toString()).toBe('7');
  });

  it('keeps the trade currency, which is not the account base currency', () => {
    const { txns } = tigerActivityStatementAdapter.parse(load());
    expect(txns.find((t) => t.instrument?.ticker === 'BHP')?.currency).toBe('AUD');
    expect(txns.find((t) => t.instrument?.ticker === 'ADBE')?.currency).toBe('USD');
  });

  it('never invents an FX rate, because Tiger quotes to its USD base and not to NZD', () => {
    const { txns } = tigerActivityStatementAdapter.parse(load());
    expect(txns.every((t) => t.brokerQuotedRate === null)).toBe(true);
    expect(txns.find((t) => t.instrument?.ticker === 'BHP')?.brokerQuoteTo).toBe('USD');
  });

  it('warns that the account base currency is not NZD', () => {
    const { warnings } = tigerActivityStatementAdapter.parse(load());
    expect(warnings.some((w) => w.message.includes('base currency is USD'))).toBe(true);
  });

  it('classifies options so they can be excluded from FIF but still surfaced', () => {
    const { txns } = tigerActivityStatementAdapter.parse(load());
    const option = txns.find((t) => t.instrument?.assetClass === 'OPTION');
    expect(option?.type).toBe('OPTION_TRADE');
    expect(option?.instrument?.ticker).toBe('GOOG');
  });

  it('skips crypto with a warning rather than treating it as a FIF interest', () => {
    const { txns, warnings } = tigerActivityStatementAdapter.parse(load());
    expect(txns.some((t) => t.instrument?.ticker === 'BTC')).toBe(false);
    expect(warnings.some((w) => w.message.includes('Crypto'))).toBe(true);
  });

  it('surfaces a short sale rather than guessing it is a disposal', () => {
    const { txns, warnings } = tigerActivityStatementAdapter.parse(load());
    const short = txns.find((t) => t.instrument?.ticker === 'SHRT');
    // Mapping OpenShort to SELL would remove holdings the taxpayer never had.
    expect(short?.type).toBe('UNKNOWN');
    expect(warnings.some((w) => w.message.includes('short sale'))).toBe(true);
  });

  it('splits a dividend into the gross amount and its withholding tax', () => {
    const { txns } = tigerActivityStatementAdapter.parse(load());
    const dividend = txns.find((t) => t.type === 'DIVIDEND');
    const withholding = txns.find((t) => t.type === 'DIVIDEND_WITHHOLDING_TAX');

    expect(dividend?.instrument?.ticker).toBe('VAS');
    expect(dividend?.grossAmount.toString()).toBe('80.02');
    expect(dividend?.currency).toBe('AUD');
    // 0.10 overseas + 26.30 NZ resident, embedded as HTML in one cell.
    expect(withholding?.grossAmount.toString()).toBe('26.4');
  });
});
