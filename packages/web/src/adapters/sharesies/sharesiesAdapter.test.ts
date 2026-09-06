import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCsvText } from '../../lib/parseFile';
import { detectBestAdapter } from '../registry';
import {
  exchangeLocalDate,
  parseSharesiesTimestamp,
  sharesiesTransactionReportAdapter,
} from './sharesiesAdapter';

const fixture = readFileSync(join(__dirname, 'fixtures', 'sharesies-transaction-report.csv'), 'utf-8');
const load = () => parseCsvText(fixture, 'sharesies.csv', 'acct_1');

describe('parseSharesiesTimestamp', () => {
  it('parses the "(UTC)" suffixed timestamp, with or without fractional seconds', () => {
    expect(parseSharesiesTimestamp('2025-05-08 22:58:37.637288 (UTC)')?.toISOString()).toBe(
      '2025-05-08T22:58:37.637Z',
    );
    expect(parseSharesiesTimestamp('2025-07-01 19:21:23 (UTC)')?.toISOString()).toBe('2025-07-01T19:21:23.000Z');
  });

  it('returns null for junk', () => {
    expect(parseSharesiesTimestamp('not a date')).toBeNull();
  });
});

describe('exchangeLocalDate — the timezone trap', () => {
  it('moves an evening-UTC NZX trade to the following day in Auckland', () => {
    const instant = parseSharesiesTimestamp('2025-05-08 22:58:37 (UTC)')!;
    expect(exchangeLocalDate(instant, 'NZX')).toBe('2025-05-09');
  });

  it('moves a 31 March NZX trade into the NEXT income year', () => {
    // The highest-stakes case: 2026-03-31 21:00 UTC is 1 April 2026 in Auckland, so this
    // belongs to the following return, not the one ending 31 March 2026.
    const instant = parseSharesiesTimestamp('2026-03-31 21:00:11 (UTC)')!;
    expect(exchangeLocalDate(instant, 'NZX')).toBe('2026-04-01');
  });

  it('leaves a US afternoon trade on the same day', () => {
    const instant = parseSharesiesTimestamp('2025-05-07 19:53:14 (UTC)')!;
    expect(exchangeLocalDate(instant, 'NYSE')).toBe('2025-05-07');
  });

  it('returns null for an unknown market rather than silently assuming UTC', () => {
    const instant = parseSharesiesTimestamp('2025-05-07 19:53:14 (UTC)')!;
    expect(exchangeLocalDate(instant, 'XXXX')).toBeNull();
  });
});

describe('detection', () => {
  it('recognises a Sharesies transaction report', () => {
    const file = load();
    expect(sharesiesTransactionReportAdapter.detect(file.headers, file.rows)).toBeGreaterThanOrEqual(0.8);
  });

  it('scores an unrelated CSV at zero', () => {
    expect(sharesiesTransactionReportAdapter.detect(['Date', 'Amount'], [])).toBe(0);
  });

  it('is the adapter the registry picks for this file', () => {
    const file = load();
    expect(detectBestAdapter(file.headers, file.rows)?.adapter.id).toBe('SHARESIES');
  });
});

describe('parsing', () => {
  it('parses every row, each as its own trade', () => {
    const { txns, warnings } = sharesiesTransactionReportAdapter.parse(load());
    expect(txns).toHaveLength(8);
    expect(warnings.filter((w) => w.severity === 'error')).toEqual([]);
  });

  it('stores the exchange-local trade date, not the UTC one', () => {
    const { txns } = sharesiesTransactionReportAdapter.parse(load());
    const fsf = txns.filter((t) => t.instrument?.ticker === 'FSF');
    // Both 2025-05-08 22:58 UTC rows are 9 May in Auckland.
    expect(fsf.filter((t) => t.tradeDate === '2025-05-09')).toHaveLength(2);
    expect(fsf.some((t) => t.tradeDate === '2025-05-08')).toBe(false);
  });

  it('assigns the boundary trade to the following income year', () => {
    const { txns } = sharesiesTransactionReportAdapter.parse(load());
    const boundary = txns.find((t) => t.rawRow['Trade date']?.startsWith('2026-03-31'));
    expect(boundary?.tradeDate).toBe('2026-04-01');
    // Year ended 31 March 2027, not 2026 — using the UTC date would file it wrongly.
    expect(boundary?.nzIncomeYear).toBe(2027);
  });

  it('reports how many dates moved, so the shift is visible rather than silent', () => {
    const { warnings } = sharesiesTransactionReportAdapter.parse(load());
    expect(warnings.some((w) => w.severity === 'info' && /moved to a different calendar day/.test(w.message))).toBe(
      true,
    );
  });

  it('normalises the lowercase currency code', () => {
    const { txns } = sharesiesTransactionReportAdapter.parse(load());
    expect(txns.find((t) => t.instrument?.ticker === 'RBLX')?.currency).toBe('USD');
    expect(txns.find((t) => t.instrument?.ticker === 'BHP')?.currency).toBe('AUD');
  });

  it('keeps quantity positive with direction carried by the type', () => {
    const { txns } = sharesiesTransactionReportAdapter.parse(load());
    const sell = txns.find((t) => t.instrument?.ticker === 'RBLX');
    expect(sell?.type).toBe('SELL');
    expect(sell?.quantity?.toString()).toBe('152.56537262');
    expect(sell?.quantity?.isNegative()).toBe(false);
  });

  it('keeps fractional share quantities exactly', () => {
    const { txns } = sharesiesTransactionReportAdapter.parse(load());
    expect(txns.find((t) => t.brokerRef?.endsWith('0003'))?.quantity?.toString()).toBe('402.15254237');
  });

  it('separates gross amount from the transaction fee', () => {
    const { txns } = sharesiesTransactionReportAdapter.parse(load());
    const buy = txns.find((t) => t.instrument?.ticker === 'BHP' && t.type === 'BUY');
    expect(buy?.grossAmount.toString()).toBe('1678.58999982');
    expect(buy?.fees.toString()).toBe('15');
    expect(buy?.netAmount.toString()).toBe('1693.58999982');
  });

  it('uses the Trade ID as a dedupe key across overlapping exports', () => {
    const { txns } = sharesiesTransactionReportAdapter.parse(load());
    expect(txns.every((t) => t.brokerRef && t.brokerRef.length > 0)).toBe(true);
    expect(new Set(txns.map((t) => t.brokerRef)).size).toBe(txns.length);
  });

  it('treats a portfolio-fee disposal as a real disposal, but flags why it happened', () => {
    const { txns } = sharesiesTransactionReportAdapter.parse(load());
    const fee = txns.find((t) => t.rawRow['Transaction method'] === 'PORTFOLIO_FEE');
    // The shares genuinely left the holding, so it must reduce the position.
    expect(fee?.type).toBe('SELL');
    expect(fee?.parseWarnings.some((w) => w.includes('portfolio fee'))).toBe(true);
  });

  it('carries the NZX market code so scope screening can exclude it from FIF', () => {
    const { txns } = sharesiesTransactionReportAdapter.parse(load());
    expect(txns.find((t) => t.instrument?.ticker === 'FSF')?.instrument?.exchange).toBe('NZX');
  });
});
