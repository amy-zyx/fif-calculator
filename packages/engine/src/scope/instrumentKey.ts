import type { InstrumentRef } from '../types/canonical-txn';

export type IdentityBasis = 'ISIN' | 'TICKER_EXCHANGE' | 'TICKER_ONLY';

export interface InstrumentIdentity {
  key: string;
  basis: IdentityBasis;
  /**
   * True when the match fell all the way back to a bare ticker. Spec §3.3 requires
   * these to be surfaced to the user for confirmation rather than silently merged:
   * "A US AAPL and an ASX AAP must never silently merge."
   */
  lowConfidence: boolean;
}

/**
 * Instrument identity, in the priority order set by spec §3.3:
 * ISIN -> (ticker + exchange) -> ticker.
 */
export function instrumentIdentity(ref: InstrumentRef): InstrumentIdentity {
  if (ref.isin) {
    return { key: `isin:${ref.isin.toUpperCase()}`, basis: 'ISIN', lowConfidence: false };
  }
  if (ref.exchange) {
    return {
      key: `tx:${ref.exchange.toUpperCase()}:${ref.ticker.toUpperCase()}`,
      basis: 'TICKER_EXCHANGE',
      lowConfidence: false,
    };
  }
  return { key: `t:${ref.ticker.toUpperCase()}`, basis: 'TICKER_ONLY', lowConfidence: true };
}

export function instrumentKey(ref: InstrumentRef): string {
  return instrumentIdentity(ref).key;
}
