import Papa from 'papaparse';
import type { PriceLookupResult, PriceProvider, PriceRequest } from './types';

export interface CsvPriceRow {
  ticker: string;
  date: string;
  price: string;
  currency: string;
}

/**
 * Prices supplied as a CSV the user already has — exported from their own broker, a
 * spreadsheet, or a data service they subscribe to. No network, and it scales to a
 * large portfolio in a way that typing does not.
 *
 * Expected columns (case-insensitive): ticker, date, price, currency.
 */
export class CsvImportProvider implements PriceProvider {
  readonly id = 'csv';
  readonly displayName = 'Import prices from a CSV';

  private rows: CsvPriceRow[] = [];

  isAvailable(): boolean {
    return this.rows.length > 0;
  }

  unavailableReason(): string | null {
    return this.rows.length === 0 ? 'No price CSV has been imported yet.' : null;
  }

  /** Returns the number of usable rows found, so the UI can confirm the import. */
  loadCsv(text: string): { rowCount: number; problems: string[] } {
    const problems: string[] = [];
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });

    const rows: CsvPriceRow[] = [];
    parsed.data.forEach((row, i) => {
      const ticker = row['ticker']?.trim();
      const date = row['date']?.trim();
      const price = row['price']?.trim();
      const currency = row['currency']?.trim();
      if (!ticker || !date || !price) {
        problems.push(`Row ${i + 1}: needs at least ticker, date and price.`);
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        problems.push(`Row ${i + 1}: date "${date}" must be ISO format YYYY-MM-DD.`);
        return;
      }
      if (Number.isNaN(Number(price))) {
        problems.push(`Row ${i + 1}: price "${price}" is not a number.`);
        return;
      }
      rows.push({ ticker: ticker.toUpperCase(), date, price, currency: (currency || 'USD').toUpperCase() });
    });

    this.rows = rows;
    return { rowCount: rows.length, problems };
  }

  async fetchPrices(requests: readonly PriceRequest[]): Promise<PriceLookupResult> {
    const result: PriceLookupResult = { quotes: [], failures: [] };
    for (const request of requests) {
      const match = this.rows.find(
        (r) => r.ticker === request.ticker.toUpperCase() && r.date === request.date,
      );
      if (match) {
        result.quotes.push({
          ticker: request.ticker,
          date: request.date,
          pricePerUnit: match.price,
          currency: match.currency,
          source: 'csv',
        });
      } else {
        result.failures.push({
          ticker: request.ticker,
          date: request.date,
          reason: 'Not present in the imported CSV.',
        });
      }
    }
    return result;
  }
}
