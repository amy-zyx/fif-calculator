import type { PriceLookupResult, PriceProvider, PriceRequest } from './types';

/**
 * The baseline provider: it fetches nothing, and reports every request as needing the
 * user to type it in. Spec §2 requires manual entry to be fully functional on its own,
 * so this is what the Prices screen falls back to — and what it uses by default.
 *
 * It exists as a PriceProvider (rather than as the absence of one) so the UI has a
 * single uniform code path, and so "no network" is an explicit, named choice rather
 * than an error state.
 */
export class ManualEntryProvider implements PriceProvider {
  readonly id = 'manual';
  readonly displayName = 'Enter prices myself (no network)';

  isAvailable(): boolean {
    return true;
  }

  unavailableReason(): null {
    return null;
  }

  async fetchPrices(requests: readonly PriceRequest[]): Promise<PriceLookupResult> {
    return {
      quotes: [],
      failures: requests.map((r) => ({
        ticker: r.ticker,
        date: r.date,
        reason: 'Enter this price by hand — no price provider is configured.',
      })),
    };
  }
}
