import { D, type CanonicalTxn } from '@fif-calculator/engine';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { runCalculation } from '../state/runCalculation';
import { emptySession, type SessionState } from '../state/session';
import { buildSessionFile, parseSessionFile, SESSION_FILE_VERSION } from './sessionFile';
import { buildWorkingPaper } from './workingPaper';
import { buildPdfSummary } from './pdfSummary';

/** A quick sale portfolio: opening 1,000 NVDA, two buys and a sell in the year. */
function session(): SessionState {
  const base = {
    sourceAccountId: 'acct_1',
    brokerId: 'IBKR' as const,
    brokerRef: null,
    settleDate: null,
    nzIncomeYear: 2026,
    instrument: { ticker: 'NVDA', exchange: null, isin: null, name: null, assetClass: 'EQUITY' as const },
    currency: 'USD',
    fees: D('0'),
    brokerQuotedRate: null,
    brokerQuoteFrom: null,
    brokerQuoteTo: null,
    brokerRateDirectionConfidence: 'UNKNOWN' as const,
    fxRateToNzd: null,
    fxRateSource: null,
    fxResolutionTrace: [],
    rawRow: { Symbol: 'NVDA' },
    parseWarnings: [],
  };
  const txns: CanonicalTxn[] = [
    { ...base, id: 'b1', tradeDate: '2025-06-10', type: 'BUY', quantity: D('100'), pricePerUnit: D('100'), grossAmount: D('10000'), netAmount: D('10000') },
    { ...base, id: 'b2', tradeDate: '2025-06-20', type: 'BUY', quantity: D('100'), pricePerUnit: D('120'), grossAmount: D('12000'), netAmount: D('12000') },
    { ...base, id: 's1', tradeDate: '2025-09-15', type: 'SELL', quantity: D('150'), pricePerUnit: D('150'), grossAmount: D('22500'), netAmount: D('22500') },
  ];

  return {
    ...emptySession(),
    incomeYear: 2026,
    taxpayerName: 'Test Taxpayer',
    accounts: [{ fileName: 'ibkr.csv', brokerLabel: 'IBKR', verified: false, warnings: [], txns }],
    openingHoldings: [
      { ticker: 'NVDA', exchange: null, quantity: '1000', marketPricePerUnit: '100', currency: 'USD', costNzd: '160000' },
    ],
    closingPrices: [{ ticker: 'NVDA', exchange: null, pricePerUnit: '150', currency: 'USD' }],
    fxRates: {
      'USD|2025-04-01': '0.6000',
      'USD|2025-06-10': '0.6000',
      'USD|2025-06-20': '0.6000',
      'USD|2025-09-15': '0.6000',
      'USD|2026-03-31': '0.6000',
    },
  };
}

function sheetRows(wb: XLSX.WorkBook, name: string): unknown[][] {
  const sheet = wb.Sheets[name];
  if (!sheet) throw new Error(`no sheet ${name}`);
  return XLSX.utils.sheet_to_json(sheet, { header: 1 });
}

describe('working paper', () => {
  it('has every tab the spec calls for', () => {
    const s = session();
    const wb = buildWorkingPaper(runCalculation(s), s);
    expect(wb.SheetNames).toEqual(
      expect.arrayContaining([
        'Summary',
        'De minimis timeline',
        'Per-holding FDR',
        'Per-holding CV',
        'Quick sale workings',
        'FX rates',
        'Foreign tax credits',
        'All transactions',
        'Assumptions & warnings',
      ]),
    );
  });

  it('writes amounts as numbers so an accountant can total the column', () => {
    const s = session();
    const rows = sheetRows(buildWorkingPaper(runCalculation(s), s), 'Per-holding FDR');
    const nvda = rows.find((r) => r[0] === 'NVDA');
    expect(typeof nvda?.[1]).toBe('number');
    // 1,000 x USD 100 / 0.60 = NZD 166,666.67 opening market value.
    expect(nvda?.[1]).toBeCloseTo(166666.67, 2);
    expect(nvda?.[4]).toBeCloseTo(9708.33, 2); // 8,333.33 base + 1,375.00 quick sale
  });

  it('shows both branches of the quick sale min() and which one bound', () => {
    const s = session();
    const rows = sheetRows(buildWorkingPaper(runCalculation(s), s), 'Quick sale workings');
    const nvda = rows.find((r) => r[0] === 'NVDA');
    expect(nvda?.[6]).toBeCloseTo(1375.0, 2); // (a) 0.05 x 150 differential x 183.3333 avg cost
    // (b) proceeds 37,500 - cost of the 150 quick-sale shares 27,500. No dividends here.
    expect(nvda?.[7]).toBeCloseTo(10000.0, 2);
    expect(nvda?.[8]).toBe('PEAK_HOLDING'); // the lesser of the two bound
    expect(nvda?.[9]).toBeCloseTo(1375.0, 2);
  });

  it('carries the verbatim source row into the transactions tab for audit', () => {
    const s = session();
    const rows = sheetRows(buildWorkingPaper(runCalculation(s), s), 'All transactions');
    const header = rows[2] as string[];
    expect(header).toContain('Symbol');
    expect(rows.some((r) => r.includes('NVDA'))).toBe(true);
  });

  it('records the disclaimer on the summary tab', () => {
    const s = session();
    const rows = sheetRows(buildWorkingPaper(runCalculation(s), s), 'Summary');
    expect(rows.flat().some((c) => typeof c === 'string' && c.includes('not tax advice'))).toBe(true);
  });
});

describe('carry-forward session file', () => {
  it('carries closing COST, not closing market value, as next year’s opening cost', () => {
    const s = session();
    const result = runCalculation(s);
    if (result.status !== 'OK') throw new Error('expected OK');
    const file = buildSessionFile(result, s);

    const nvda = file.proposedOpeningHoldings.find((h) => h.ticker === 'NVDA');
    expect(nvda).toBeDefined();
    expect(nvda?.quantity).toBe('1050');

    // Closing market value is 1,050 x 150 / 0.6 = NZD 262,500. The remaining cost basis
    // is a different, smaller number — conflating them would change the de minimis verdict.
    const cost = Number(nvda?.costNzd);
    expect(cost).toBeGreaterThan(0);
    expect(cost).not.toBeCloseTo(262500, 2);
  });

  it('round-trips through JSON', () => {
    const s = session();
    const file = buildSessionFile(runCalculation(s), s);
    expect(parseSessionFile(JSON.stringify(file))).toEqual(file);
  });

  it('rejects an unsupported version rather than guessing', () => {
    expect(() => parseSessionFile(JSON.stringify({ version: SESSION_FILE_VERSION + 1 }))).toThrow(/version/);
  });
});

describe('pdf summary', () => {
  it('builds without throwing and produces a non-trivial document', () => {
    const s = session();
    const doc = buildPdfSummary(runCalculation(s), s);
    const bytes = doc.output('arraybuffer');
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});
