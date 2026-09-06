/**
 * Public market FX rates (Frankfurter, serving European Central Bank reference rates).
 *
 * WHY THIS IS PERMITTED, AND WHAT IT IS NOT
 * ----------------------------------------
 * IR461 allows the actual rate for the day. IRD *accepts* its own published mid-month
 * rate as equivalent to an actual rate — it does not require it — so a published market
 * rate for the actual date is a defensible choice under the same approach.
 *
 * It is NOT the same number as IRD's table, and the difference is real. These are ECB
 * reference rates: mid-market, fixed once a day at around 16:00 CET, on ECB working
 * days only. Anything sourced here is labelled as such, and the working paper records
 * the source and the date actually used, so an accountant can see exactly what was
 * applied rather than having to guess.
 *
 * Whatever is chosen has to be applied consistently across the whole portfolio, which
 * is why this fetches every currency for a date in one request rather than letting
 * individual holdings drift onto different sources.
 *
 * PRIVACY: a request carries a date and currency codes. No quantity, cost, holding,
 * account or name — the same contract as the price providers, and the `connect-src`
 * CSP is what enforces it at the browser level.
 */

const ENDPOINT = 'https://api.frankfurter.dev/v1';

export interface FxRateQuote {
  currency: string;
  /** The date asked for. */
  requestedDate: string;
  /**
   * The date the published rate actually belongs to. ECB does not publish at weekends
   * or on its holidays, so this can be earlier — surfaced rather than hidden, because
   * a 31 March that lands on a weekend is exactly when it matters.
   */
  actualDate: string;
  /** IRD convention: units of foreign currency per 1 NZD. */
  rate: string;
  source: 'ecb-frankfurter';
}

export interface FxLookupResult {
  quotes: FxRateQuote[];
  failures: Array<{ currency: string; date: string; reason: string }>;
}

interface FrankfurterResponse {
  base?: string;
  date?: string;
  rates?: Record<string, number>;
}

function isFrankfurterResponse(value: unknown): value is FrankfurterResponse {
  return typeof value === 'object' && value !== null;
}

/**
 * Fetches every requested currency for one date in a single call.
 *
 * `base=NZD` is deliberate: the response is then already in the engine's convention
 * (foreign units per 1 NZD), so no reciprocal is taken here. Inverting a rate in more
 * than one place is how the direction bugs in spec §5.7 happen.
 */
export async function fetchFxRatesForDate(date: string, currencies: readonly string[]): Promise<FxLookupResult> {
  const wanted = [...new Set(currencies.map((c) => c.toUpperCase()))].filter((c) => c !== 'NZD');
  if (wanted.length === 0) return { quotes: [], failures: [] };

  const url = `${ENDPOINT}/${date}?base=NZD&symbols=${wanted.join(',')}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        quotes: [],
        failures: wanted.map((c) => ({ currency: c, date, reason: `HTTP ${response.status}` })),
      };
    }
    const body: unknown = await response.json();
    if (!isFrankfurterResponse(body) || !body.rates) {
      return { quotes: [], failures: wanted.map((c) => ({ currency: c, date, reason: 'Unexpected response' })) };
    }

    const actualDate = body.date ?? date;
    const quotes: FxRateQuote[] = [];
    const failures: FxLookupResult['failures'] = [];

    for (const currency of wanted) {
      const rate = body.rates[currency];
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
        failures.push({ currency, date, reason: 'No rate published for this currency on that date.' });
        continue;
      }
      quotes.push({
        currency,
        requestedDate: date,
        actualDate,
        // Kept as a string: the engine does no float arithmetic on rates, and the
        // full published precision is preserved for the audit trail.
        rate: String(rate),
        source: 'ecb-frankfurter',
      });
    }
    return { quotes, failures };
  } catch (err) {
    return {
      quotes: [],
      failures: wanted.map((c) => ({
        currency: c,
        date,
        reason: err instanceof Error ? err.message : 'Network request failed',
      })),
    };
  }
}

/** Fetches several dates, sequentially to stay polite to a free public service. */
export async function fetchFxRates(
  requests: ReadonlyArray<{ date: string; currencies: readonly string[] }>,
): Promise<FxLookupResult> {
  const combined: FxLookupResult = { quotes: [], failures: [] };
  for (const request of requests) {
    const result = await fetchFxRatesForDate(request.date, request.currencies);
    combined.quotes.push(...result.quotes);
    combined.failures.push(...result.failures);
  }
  return combined;
}
