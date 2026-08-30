import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractClose } from './alphaVantageProvider';
import { CsvImportProvider } from './csvImportProvider';
import { ManualEntryProvider } from './manualEntryProvider';

describe('ManualEntryProvider — the baseline, not a fallback', () => {
  it('is always available, so the app works with no key and no network', () => {
    const provider = new ManualEntryProvider();
    expect(provider.isAvailable()).toBe(true);
    expect(provider.unavailableReason()).toBeNull();
  });

  it('reports every request as needing manual entry rather than inventing a price', async () => {
    const result = await new ManualEntryProvider().fetchPrices([{ ticker: 'AAPL', date: '2026-03-31' }]);
    expect(result.quotes).toEqual([]);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.reason).toMatch(/by hand/i);
  });
});

describe('CsvImportProvider', () => {
  const csv = 'Ticker,Date,Price,Currency\nAAPL,2026-03-31,200.00,USD\nNVDA,2026-03-31,150.00,USD\n';

  it('is unavailable until a CSV is loaded, and says why', () => {
    const provider = new CsvImportProvider();
    expect(provider.isAvailable()).toBe(false);
    expect(provider.unavailableReason()).toMatch(/No price CSV/);
  });

  it('loads rows and matches them by ticker and date', async () => {
    const provider = new CsvImportProvider();
    expect(provider.loadCsv(csv).rowCount).toBe(2);

    const result = await provider.fetchPrices([{ ticker: 'AAPL', date: '2026-03-31' }]);
    expect(result.quotes[0]?.pricePerUnit).toBe('200.00');
    expect(result.quotes[0]?.currency).toBe('USD');
  });

  it('reports a miss as a failure rather than substituting another date', async () => {
    const provider = new CsvImportProvider();
    provider.loadCsv(csv);
    const result = await provider.fetchPrices([{ ticker: 'AAPL', date: '2025-03-31' }]);
    expect(result.quotes).toEqual([]);
    expect(result.failures).toHaveLength(1);
  });

  it('rejects a non-ISO date and a non-numeric price instead of importing them', () => {
    const provider = new CsvImportProvider();
    const { rowCount, problems } = provider.loadCsv(
      'ticker,date,price,currency\nAAPL,31/03/2026,200,USD\nNVDA,2026-03-31,abc,USD\n',
    );
    expect(rowCount).toBe(0);
    expect(problems).toHaveLength(2);
  });
});

describe('AlphaVantage response parsing', () => {
  const body = {
    'Time Series (Daily)': {
      '2026-03-27': { '4. close': '198.50' },
      '2026-03-30': { '4. close': '200.00' },
      '2026-04-01': { '4. close': '205.00' },
    },
  };

  it('picks the exact date when it exists', () => {
    expect(extractClose(body, '2026-03-30')).toEqual({ close: '200.00', actualDate: '2026-03-30' });
  });

  it('falls back to the last trading day BEFORE the date, never after', () => {
    // 31 March 2026 is not in the series; the answer must be the 30th, not the 1 April.
    expect(extractClose(body, '2026-03-31')).toEqual({ close: '200.00', actualDate: '2026-03-30' });
  });

  it('returns null rather than guessing when nothing is on or before the date', () => {
    expect(extractClose(body, '2020-01-01')).toBeNull();
  });

  it('returns null for a rate-limit or error payload', () => {
    expect(extractClose({ Note: 'rate limited' }, '2026-03-31')).toBeNull();
  });
});

describe('the privacy boundary', () => {
  it('no module outside src/providers calls fetch', () => {
    const srcDir = join(__dirname, '..');
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          if (entry === 'providers') continue; // the one permitted place
          walk(full);
        } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
          if (/\bfetch\s*\(/.test(readFileSync(full, 'utf-8'))) offenders.push(full);
        }
      }
    };
    walk(srcDir);
    expect(offenders).toEqual([]);
  });

  it('the Alpha Vantage request carries only a ticker, a function name and the key', () => {
    const source = readFileSync(join(__dirname, 'alphaVantageProvider.ts'), 'utf-8');
    const params = source.match(/new URLSearchParams\(\{([\s\S]*?)\}\)/)?.[1] ?? '';
    // Anything resembling a quantity, cost, account or name must never appear here.
    expect(params).not.toMatch(/quantity|cost|account|taxpayer|name:/i);
    expect(params).toMatch(/symbol/);
  });
});
