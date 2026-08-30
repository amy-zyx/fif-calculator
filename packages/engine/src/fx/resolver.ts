import { D, Decimal } from '../money';
import { NZD_IDENTITY_FACTOR, irdRateToNzdFactor } from './irdProvider';
import {
  PLAUSIBILITY_BAND,
  type ConversionFactor,
  type FxPolicy,
  type FxResolution,
  type IrdRateProvider,
} from './types';

export interface FxResolutionRequest {
  /** Currency the amount is denominated in. */
  currency: string;
  /** Date to price the conversion at (exchange-local trade date). */
  date: string;
  incomeYear: number;
  txnId?: string;
  /** The broker's rate column, verbatim and uninterpreted (spec §4.3). */
  brokerQuotedRate?: Decimal | null;
  /** What the broker's rate converts TO, if the adapter or user established it. */
  brokerQuoteTo?: string | null;
  /** The statement's account base currency. Frequently NOT NZD (spec §5.7 trap 1). */
  accountBaseCurrency?: string | null;
  /** A user-confirmed rate for this txn, in IRD convention (foreign per NZD). */
  manualOverride?: Decimal | null;
}

function relativeDifference(a: Decimal, b: Decimal): Decimal {
  if (b.isZero()) return D(Infinity);
  return a.minus(b).abs().dividedBy(b.abs());
}

function withinBand(a: Decimal, b: Decimal): boolean {
  return relativeDifference(a, b).lessThanOrEqualTo(D(PLAUSIBILITY_BAND));
}

/**
 * Trap 3, spec §5.7: "The label lies, the arithmetic doesn't." Where a row carries
 * both the trade amount and the settled/base amount, the rate implied by the row
 * itself beats whatever the rate column claims.
 */
export function deriveImpliedRate(
  amountInFrom: Decimal,
  amountInTo: Decimal,
): Decimal | null {
  if (amountInFrom.isZero()) return null;
  return amountInTo.dividedBy(amountInFrom);
}

/**
 * Resolves a trade currency to NZD following the precedence ladder in spec §5.7,
 * writing every rule that fires into the returned trace.
 *
 *   1. manual override for this txn?                   -> MANUAL
 *   2. policy is A or C?                               -> IRD (by convention)
 *   3. broker rate present, target NZD, confidence OK? -> BROKER_DIRECT
 *   4. broker rate present, target = base != NZD?      -> BROKER_CHAINED (leg 2 = IRD)
 *   5. otherwise                                       -> IRD, with a warning
 *
 * A rate outside the plausibility band never gets used automatically: the
 * resolution comes back `blocked` for the UI to ask about.
 */
export function resolveFxToNzd(
  request: FxResolutionRequest,
  policy: FxPolicy,
  ird: IrdRateProvider,
): FxResolution {
  const trace: string[] = [];
  const { currency, date, incomeYear } = request;

  if (currency === 'NZD') {
    trace.push('Currency is NZD; no conversion required.');
    return {
      factorToNzd: NZD_IDENTITY_FACTOR.factor,
      source: null,
      publishedRate: D(1),
      trace,
      blocked: null,
    };
  }

  // --- Ladder step 1: manual override -------------------------------------
  if (request.manualOverride) {
    trace.push(`Manual override applied: ${request.manualOverride.toString()} ${currency} per NZD.`);
    return {
      factorToNzd: irdRateToNzdFactor(currency, request.manualOverride).factor,
      source: 'MANUAL',
      publishedRate: request.manualOverride,
      trace,
      blocked: null,
    };
  }

  // --- Ladder step 2: policy C uses the rolling average, always IRD --------
  if (policy === 'C') {
    const avg = ird.getRollingAverage(currency, incomeYear);
    if (!avg) {
      trace.push(`No IRD rolling 12-month average available for ${currency}.`);
      return {
        factorToNzd: null,
        source: null,
        publishedRate: null,
        trace,
        blocked: {
          reason: 'MISSING_RATE',
          currency,
          date,
          message: `No IRD rolling 12-month average for ${currency} in income year ${incomeYear}.`,
        },
      };
    }
    trace.push(`Policy C: IRD rolling 12-month average ${avg.toString()} ${currency} per NZD.`);
    return {
      factorToNzd: irdRateToNzdFactor(currency, avg).factor,
      source: 'IRD_ROLLING_AVG',
      publishedRate: avg,
      trace,
      blocked: null,
    };
  }

  const irdRate = ird.getRate(currency, date);

  // --- Ladder step 2 (cont.): policy A is IRD for everything ---------------
  if (policy === 'A') {
    if (!irdRate) {
      trace.push(`No IRD rate published for ${currency} on ${date}.`);
      return {
        factorToNzd: null,
        source: null,
        publishedRate: null,
        trace,
        blocked: {
          reason: 'MISSING_RATE',
          currency,
          date,
          message: `No IRD rate for ${currency} on ${date}. Enter one manually to continue.`,
        },
      };
    }
    trace.push(`Policy A: IRD rate ${irdRate.toString()} ${currency} per NZD for ${date}.`);
    return {
      factorToNzd: irdRateToNzdFactor(currency, irdRate).factor,
      source: 'IRD_MID_MONTH',
      publishedRate: irdRate,
      trace,
      blocked: null,
    };
  }

  // --- Policy B: prefer the broker's dealt rate where we have one ----------
  const quoted = request.brokerQuotedRate ?? null;
  const base = request.accountBaseCurrency ?? null;
  const quoteTo = request.brokerQuoteTo ?? null;

  if (!quoted || quoted.isZero() || quoted.isNegative()) {
    // Ladder step 5.
    if (!irdRate) {
      trace.push(`Policy B: no broker rate, and no IRD rate for ${currency} on ${date}.`);
      return {
        factorToNzd: null,
        source: null,
        publishedRate: null,
        trace,
        blocked: {
          reason: 'MISSING_RATE',
          currency,
          date,
          message: `No broker rate and no IRD rate for ${currency} on ${date}.`,
        },
      };
    }
    trace.push(`Policy B: no usable broker rate; fell back to IRD ${irdRate.toString()} ${currency} per NZD.`);
    return {
      factorToNzd: irdRateToNzdFactor(currency, irdRate).factor,
      source: 'IRD_MID_MONTH',
      publishedRate: irdRate,
      trace,
      blocked: null,
    };
  }

  const targetsNzd = quoteTo === 'NZD' || (quoteTo === null && (base === null || base === 'NZD'));

  // --- Ladder step 3: BROKER_DIRECT ---------------------------------------
  if (targetsNzd) {
    if (!irdRate) {
      trace.push(`Broker rate present but no IRD rate for ${currency} on ${date} to sanity-check it against.`);
      return {
        factorToNzd: null,
        source: null,
        publishedRate: null,
        trace,
        blocked: {
          reason: 'MISSING_RATE',
          currency,
          date,
          message: `Cannot validate the broker rate for ${currency} on ${date} without an IRD rate.`,
        },
      };
    }

    // The rate column is read in IRD's convention (foreign per NZD) unless the
    // arithmetic says otherwise. Trap 2: never silently invert.
    if (withinBand(quoted, irdRate)) {
      trace.push(
        `Broker rate ${quoted.toString()} is within ${PLAUSIBILITY_BAND} of the IRD rate ` +
          `${irdRate.toString()} for ${date}; accepted as a dealt rate (spread is expected).`,
      );
      return {
        factorToNzd: irdRateToNzdFactor(currency, quoted).factor,
        source: 'BROKER_DIRECT',
        publishedRate: quoted,
        trace,
        blocked: null,
      };
    }

    const reciprocal = D(1).dividedBy(quoted);
    if (withinBand(reciprocal, irdRate)) {
      trace.push(
        `Broker rate ${quoted.toString()} is far from the IRD rate ${irdRate.toString()} ` +
          `but its reciprocal ${reciprocal.toString()} is not — the column is probably inverted.`,
      );
      return {
        factorToNzd: null,
        source: null,
        publishedRate: null,
        trace,
        blocked: {
          reason: 'INVERSION_SUSPECTED',
          currency,
          date,
          message:
            `The rate ${quoted.toString()} for ${currency} on ${date} looks inverted. ` +
            `Did you mean ${reciprocal.toString()} ${currency} per NZD? Confirm before continuing.`,
          proposedRate: reciprocal,
          quotedRate: quoted,
          irdRate,
        },
      };
    }

    trace.push(`Broker rate ${quoted.toString()} is implausible against IRD ${irdRate.toString()}.`);
    return {
      factorToNzd: null,
      source: null,
      publishedRate: null,
      trace,
      blocked: {
        reason: 'IMPLAUSIBLE_RATE',
        currency,
        date,
        message:
          `The rate ${quoted.toString()} for ${currency} on ${date} differs from the IRD rate ` +
          `${irdRate.toString()} by more than ${PLAUSIBILITY_BAND}, in neither direction. Check the column mapping.`,
        quotedRate: quoted,
        irdRate,
      },
    };
  }

  // --- Ladder step 4: BROKER_CHAINED --------------------------------------
  // The broker's rate converts the trade currency to the ACCOUNT BASE currency,
  // not to NZD (spec §5.7 trap 1). It can only be leg 1 of a chain:
  //     trade ccy -> base ccy (broker rate) -> NZD (IRD rate)
  const baseCurrency = quoteTo ?? base;
  if (!baseCurrency) {
    trace.push('Broker rate present but its target currency is unknown.');
    return {
      factorToNzd: null,
      source: null,
      publishedRate: null,
      trace,
      blocked: {
        reason: 'MISSING_RATE',
        currency,
        date,
        message: `Cannot use the broker rate for ${currency} on ${date}: unknown target currency.`,
      },
    };
  }

  const baseIrdRate = ird.getRate(baseCurrency, date);
  if (!irdRate || !baseIrdRate) {
    trace.push(`Chained conversion needs IRD rates for both ${currency} and ${baseCurrency} on ${date}.`);
    return {
      factorToNzd: null,
      source: null,
      publishedRate: null,
      trace,
      blocked: {
        reason: 'MISSING_RATE',
        currency,
        date,
        message: `Missing an IRD rate for ${currency} or ${baseCurrency} on ${date}.`,
      },
    };
  }

  // Reference cross-rate implied by IRD, as a MULTIPLYING factor trade -> base.
  // Both IRD rates are "foreign per NZD", so: base_per_trade = base_per_nzd / trade_per_nzd.
  const referenceCrossFactor = baseIrdRate.dividedBy(irdRate);
  const multiplyCandidate = quoted;
  const divideCandidate = D(1).dividedBy(quoted);

  const multiplyOk = withinBand(multiplyCandidate, referenceCrossFactor);
  const divideOk = withinBand(divideCandidate, referenceCrossFactor);

  if (multiplyOk === divideOk) {
    // Neither direction is plausible, or (for a rate near 1) both are and the
    // choice is genuinely ambiguous. Either way: do not guess.
    trace.push(
      `Could not establish the direction of broker rate ${quoted.toString()} for ` +
        `${currency}->${baseCurrency}; IRD implies a cross-rate of ${referenceCrossFactor.toString()}.`,
    );
    return {
      factorToNzd: null,
      source: null,
      publishedRate: null,
      trace,
      blocked: {
        reason: multiplyOk ? 'INVERSION_SUSPECTED' : 'IMPLAUSIBLE_RATE',
        currency,
        date,
        message:
          `The rate ${quoted.toString()} converting ${currency} to ${baseCurrency} on ${date} ` +
          `is ambiguous or implausible against the IRD-implied cross-rate ` +
          `${referenceCrossFactor.toString()}. Confirm it before continuing.`,
        quotedRate: quoted,
        irdRate: referenceCrossFactor,
      },
    };
  }

  const leg1: ConversionFactor = {
    from: currency,
    to: baseCurrency,
    factor: multiplyOk ? multiplyCandidate : divideCandidate,
  };
  const leg2 = irdRateToNzdFactor(baseCurrency, baseIrdRate);

  trace.push(
    `Account base currency is ${baseCurrency}, not NZD: the broker rate is only leg 1 of a chain.`,
  );
  trace.push(
    `Leg 1 ${currency}->${baseCurrency}: broker rate ${quoted.toString()} applied as ` +
      `${multiplyOk ? 'a multiplier' : 'a divisor'} (IRD cross-rate ${referenceCrossFactor.toString()} confirms the direction).`,
  );
  trace.push(
    `Leg 2 ${baseCurrency}->NZD: IRD rate ${baseIrdRate.toString()} ${baseCurrency} per NZD.`,
  );

  return {
    factorToNzd: leg1.factor.times(leg2.factor),
    source: 'BROKER_CHAINED',
    publishedRate: null,
    trace,
    blocked: null,
  };
}

/** Converts a foreign amount to NZD using a resolution. Throws if it was blocked. */
export function convertToNzd(amount: Decimal, resolution: FxResolution): Decimal {
  if (!resolution.factorToNzd) {
    throw new Error(
      `Cannot convert to NZD: FX resolution was blocked (${resolution.blocked?.reason ?? 'unknown'}).`,
    );
  }
  return amount.times(resolution.factorToNzd);
}
