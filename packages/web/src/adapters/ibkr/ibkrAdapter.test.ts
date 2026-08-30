import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCsvText } from '../../lib/parseFile';
import { ibkrActivityStatementAdapter } from './ibkrAdapter';

const fixturePath = join(__dirname, 'fixtures', 'ibkr-activity-statement.csv');
const fixtureText = readFileSync(fixturePath, 'utf-8');

function loadFixture() {
  return parseCsvText(fixtureText, 'ibkr-activity-statement.csv', 'acct_1');
}

describe('ibkrActivityStatementAdapter.detect', () => {
  it('scores a real IBKR multi-section export above the wizard fallback threshold', () => {
    const file = loadFixture();
    const confidence = ibkrActivityStatementAdapter.detect(file.headers, file.rows);
    expect(confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('scores an unrelated CSV at zero', () => {
    const confidence = ibkrActivityStatementAdapter.detect(
      ['Date', 'Description', 'Amount'],
      [['2025-01-01', 'Groceries', '-50.00']],
    );
    expect(confidence).toBe(0);
  });
});

describe('ibkrActivityStatementAdapter.parse', () => {
  it('splits the Trades and Dividends sections and skips SubTotal/Total rollup rows', () => {
    const file = loadFixture();
    const { txns, warnings } = ibkrActivityStatementAdapter.parse(file);

    expect(warnings.filter((w) => w.severity === 'error')).toEqual([]);
    expect(txns).toHaveLength(5); // 3 trades + 2 dividends; SubTotal/Total rows excluded
  });

  it('normalises a negative IBKR quantity to a positive quantity + SELL type', () => {
    const file = loadFixture();
    const { txns } = ibkrActivityStatementAdapter.parse(file);
    const sale = txns.find((t) => t.type === 'SELL');

    expect(sale).toBeDefined();
    expect(sale?.quantity?.toString()).toBe('40');
    expect(sale?.quantity?.isNegative()).toBe(false);
  });

  it('parses a buy trade into a fully-formed CanonicalTxn', () => {
    const file = loadFixture();
    const { txns } = ibkrActivityStatementAdapter.parse(file);
    const buy = txns.find((t) => t.type === 'BUY' && t.instrument?.ticker === 'AAPL');

    expect(buy).toMatchObject({
      brokerId: 'IBKR',
      type: 'BUY',
      tradeDate: '2025-06-10',
      currency: 'USD',
      nzIncomeYear: 2026,
    });
    expect(buy?.quantity?.toString()).toBe('100');
    expect(buy?.pricePerUnit?.toString()).toBe('220');
    expect(buy?.grossAmount.toString()).toBe('22000');
    expect(buy?.fees.toString()).toBe('1');
    expect(buy?.netAmount.toString()).toBe('22001');
    expect(buy?.instrument?.assetClass).toBe('EQUITY');
  });

  it('extracts the ticker from a Dividends row description', () => {
    const file = loadFixture();
    const { txns } = ibkrActivityStatementAdapter.parse(file);
    const dividends = txns.filter((t) => t.type === 'DIVIDEND');

    expect(dividends).toHaveLength(2);
    expect(dividends.every((d) => d.instrument?.ticker === 'AAPL')).toBe(true);
    expect(dividends.map((d) => d.grossAmount.toString()).sort()).toEqual(['15', '25']);
  });

  it('reports an error warning and no transactions for a file with no recognised sections', () => {
    const file = parseCsvText('A,B,C\n1,2,3\n', 'not-ibkr.csv', 'acct_1');
    const { txns, warnings } = ibkrActivityStatementAdapter.parse(file);

    expect(txns).toEqual([]);
    expect(warnings.some((w) => w.severity === 'error')).toBe(true);
  });
});
