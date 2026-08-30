/**
 * Price providers (spec §2).
 *
 * THE PRIVACY CONTRACT, which every implementation must honour:
 * a provider may send a TICKER and a DATE, and nothing else. Never a quantity, never a
 * cost, never an account identifier, never a taxpayer name. A provider that needs more
 * than (ticker, date) to work is not acceptable here.
 *
 * `ManualEntryProvider` is not a fallback of last resort — it is the baseline. The app
 * must work end to end with no API key and no network, so every other provider is an
 * optional convenience layered on top.
 */

export interface PriceRequest {
  ticker: string;
  /** ISO date of the close being requested. */
  date: string;
}

export interface PriceQuote {
  ticker: string;
  date: string;
  /** Price per unit in `currency`, as a decimal string — never a JS number. */
  pricePerUnit: string;
  currency: string;
  source: string;
  /**
   * The date the provider actually returned, when it differs from the one requested —
   * e.g. 31 March fell on a weekend and the last trading day was the 29th. Surfaced so
   * the user can see it rather than discovering it in a reconciliation later.
   */
  actualDate?: string;
}

export interface PriceLookupFailure {
  ticker: string;
  date: string;
  reason: string;
}

export interface PriceLookupResult {
  quotes: PriceQuote[];
  failures: PriceLookupFailure[];
}

export interface PriceProvider {
  id: string;
  displayName: string;
  /** Whether this provider is usable right now (e.g. an API key has been entered). */
  isAvailable(): boolean;
  /** Why it is not available, for the UI to explain rather than just disable a button. */
  unavailableReason(): string | null;
  fetchPrices(requests: readonly PriceRequest[]): Promise<PriceLookupResult>;
}
