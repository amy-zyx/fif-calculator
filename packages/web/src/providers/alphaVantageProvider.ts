import type { PriceLookupResult, PriceProvider, PriceRequest } from './types';

const ENDPOINT = 'https://www.alphavantage.co/query';
const KEY_STORAGE = 'fif.alphaVantageKey';
/** Alpha Vantage's free tier asks for no more than one request per second. */
const REQUEST_SPACING_MS = 1100;

/**
 * The user's own API key, kept in their browser and never bundled. Cleared by the
 * "Clear all my data" control along with everything else.
 */
export function storedApiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function storeApiKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(KEY_STORAGE, key.trim());
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    // Blocked site data: the key simply is not remembered between reloads.
  }
}

/**
 * Alpha Vantage, chosen because it permits CORS from the browser and takes a
 * user-supplied API key — spec §2's "CORS reality check". Yahoo Finance's unofficial
 * endpoints fail CORS from a static site, so they are not an option here.
 *
 * PRIVACY: the only values that leave the browser are the ticker, the function name,
 * and the user's own API key. No date is even sent — Alpha Vantage returns a series and
 * the date is selected locally — and no quantity, cost, or account identifier is ever
 * included. This is the ONLY module in the app permitted to call fetch, and the
 * `connect-src` CSP in index.html is what enforces that at the browser level.
 *
 * The key is stored in localStorage and never bundled. It is the user's own key, used
 * from their own browser.
 */
export class AlphaVantageProvider implements PriceProvider {
  readonly id = 'alphavantage';
  readonly displayName = 'Alpha Vantage (needs your own API key)';

  constructor(private apiKey: string) {}

  setApiKey(key: string) {
    this.apiKey = key;
  }

  isAvailable(): boolean {
    return this.apiKey.trim() !== '';
  }

  unavailableReason(): string | null {
    return this.isAvailable() ? null : 'Enter your Alpha Vantage API key to use this provider.';
  }

  async fetchPrices(requests: readonly PriceRequest[]): Promise<PriceLookupResult> {
    const result: PriceLookupResult = { quotes: [], failures: [] };
    if (!this.isAvailable()) {
      return {
        quotes: [],
        failures: requests.map((r) => ({ ticker: r.ticker, date: r.date, reason: 'No API key configured.' })),
      };
    }

    // Deliberately sequential, and paced. Alpha Vantage's free tier asks for at most one
    // request per second and firing a portfolio's worth at once trips it — which reaches
    // the user as a wall of "please spread out your requests" rather than prices.
    let first = true;
    for (const request of requests) {
      if (!first) await new Promise((resolve) => setTimeout(resolve, REQUEST_SPACING_MS));
      first = false;
      try {
        // TIME_SERIES_MONTHLY, not DAILY. `outputsize=full` became a premium feature, and
        // the free DAILY response is capped at ~100 trading days — which cannot reach the
        // previous 31 March from any point later than about July. MONTHLY is free, carries
        // full history, and its month-end row IS the close of the last trading day in that
        // month, which is exactly the figure a 31 March year end needs.
        const params = new URLSearchParams({
          function: 'TIME_SERIES_MONTHLY',
          symbol: request.ticker,
          apikey: this.apiKey,
        });
        const response = await fetch(`${ENDPOINT}?${params.toString()}`);
        if (!response.ok) {
          result.failures.push({ ...request, reason: `HTTP ${response.status}` });
          continue;
        }
        const body: unknown = await response.json();
        const quote = extractClose(body, request.date);
        if (!quote) {
          result.failures.push({
            ...request,
            reason: rateLimitMessage(body) ?? 'No price returned for that ticker and date.',
          });
          continue;
        }
        result.quotes.push({
          ticker: request.ticker,
          date: request.date,
          pricePerUnit: quote.close,
          // Alpha Vantage's daily series does not state a currency; assuming one would
          // be a silent error on a non-US listing, so it is left for the user to confirm.
          currency: 'USD',
          source: 'alphavantage',
          ...(quote.actualDate !== request.date ? { actualDate: quote.actualDate } : {}),
        });
      } catch (err) {
        result.failures.push({
          ...request,
          reason: err instanceof Error ? err.message : 'Network request failed',
        });
      }
    }
    return result;
  }
}

function rateLimitMessage(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const record = body as Record<string, unknown>;
  for (const key of ['Note', 'Information', 'Error Message']) {
    const value = record[key];
    if (typeof value === 'string') return value;
  }
  return null;
}

/**
 * Picks the close on `date`, or the most recent trading day before it — 31 March falls
 * on a weekend often enough that failing outright would be unhelpful. The date actually
 * used is returned so the caller can surface it.
 */
export function extractClose(body: unknown, date: string): { close: string; actualDate: string } | null {
  if (typeof body !== 'object' || body === null) return null;
  const record = body as Record<string, unknown>;
  // Monthly is what the provider requests now; daily is still read so an older cached
  // response, or a future switch back, parses without a second code path.
  const series = record['Monthly Time Series'] ?? record['Time Series (Daily)'];
  if (typeof series !== 'object' || series === null) return null;

  const entries = series as Record<string, Record<string, string>>;
  const candidates = Object.keys(entries)
    .filter((d) => d <= date)
    .sort();
  const chosen = candidates[candidates.length - 1];
  if (!chosen) return null;

  const close = entries[chosen]?.['4. close'];
  return close ? { close, actualDate: chosen } : null;
}
