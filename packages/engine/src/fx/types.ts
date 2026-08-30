import type { Decimal } from '../money';
import type { FxRateSource } from '../types/canonical-txn';

/**
 * ============================================================================
 * THE FX DIRECTION CONVENTION — read this before touching anything in fx/.
 * ============================================================================
 *
 * IRD publishes its exchange rates as **units of foreign currency per 1 NZD**.
 * So an IRD USD rate of 0.5800 means "1 NZD buys 0.58 USD", and converting a USD
 * amount INTO NZD means DIVIDING:
 *
 *     NZD 379,310.34 = USD 220,000 / 0.5800
 *
 * Broker-quoted rates frequently use the OPPOSITE convention. GT-10's Tiger export
 * quotes 0.1250 for HKD->USD, where the conversion MULTIPLIES:
 *
 *     USD 10,000 = HKD 80,000 x 0.1250
 *
 * Mixing these up is, per spec §5.7, "the single most damaging silent failure in
 * the product" — it is how HKD 80,000 becomes a nonsense NZD 640,000.
 *
 * To make that class of bug unrepresentable, nothing inside the engine passes a
 * bare rate around. Everything is normalised to a `ConversionFactor`, which always
 * multiplies and always names both currencies:
 *
 *     amountInTo = amountInFrom x factor
 *
 * A published IRD rate is turned into a factor exactly once, in `irdRateToNzdFactor`
 * below, and the reciprocal happens there and nowhere else.
 */

/** A conversion that always MULTIPLIES: amountInTo = amountInFrom x factor. */
export interface ConversionFactor {
  from: string;
  to: string;
  factor: Decimal;
}

/**
 * How the taxpayer has elected to source FX rates. One global choice per taxpayer
 * per year, because IR461 requires the approach to be applied consistently (§5.7).
 *
 *  A — IRD rates for everything (default, recommended, most defensible).
 *  B — broker actual (dealt) rate where available, IRD rate elsewhere.
 *  C — rolling 12-month average, always IRD.
 */
export type FxPolicy = 'A' | 'B' | 'C';

export interface IrdRateProvider {
  /**
   * The published IRD rate for `currency` on `date` — units of foreign currency
   * per 1 NZD. Returns null when no rate is available, which must BLOCK the
   * calculation rather than silently defaulting (spec §2: never let a missing
   * rate become zero).
   */
  getRate(currency: string, date: string): Decimal | null;
  /** Rolling 12-month average rate for the income year (FX convention 2 / policy C). */
  getRollingAverage(currency: string, incomeYear: number): Decimal | null;
}

export type FxBlockReason =
  | 'MISSING_RATE'
  | 'IMPLAUSIBLE_RATE'
  | 'INVERSION_SUSPECTED';

export interface FxBlock {
  reason: FxBlockReason;
  currency: string;
  date: string;
  message: string;
  /** For INVERSION_SUSPECTED: the rate we believe was meant, awaiting confirmation. */
  proposedRate?: Decimal;
  quotedRate?: Decimal;
  irdRate?: Decimal;
}

export interface FxResolution {
  /** amountNzd = amountForeign x factorToNzd. Null when `blocked` is set. */
  factorToNzd: Decimal | null;
  source: FxRateSource | null;
  /**
   * The IRD-convention rate (foreign per NZD) behind this resolution, recorded for
   * the audit trail because that is the number an accountant will recognise from
   * IRD's published tables. Null for chained/broker resolutions with no single
   * published rate.
   */
  publishedRate: Decimal | null;
  /** Which rules fired, in order — spec §5.7 `fxResolutionTrace`. */
  trace: string[];
  blocked: FxBlock | null;
}

/**
 * Tolerance bands from spec §5.7 trap 4. A broker's dealt rate legitimately differs
 * from IRD's published rate by an FX spread — "a 0.3–0.8% gap is normal, not a bug".
 * Only a gap beyond 10% is treated as an error that blocks.
 */
export const PLAUSIBILITY_BAND = '0.10';
