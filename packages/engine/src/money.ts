import Decimal from 'decimal.js';

/**
 * Every money amount, share quantity, and FX rate in this engine is a Decimal.
 * Never a native JS `number` — see spec §3.1. This module is the single place
 * that configures Decimal's global behaviour and the single place that is allowed
 * to round.
 *
 * Precision 40 is generous headroom for chained FX conversions (§5.7 chained rates)
 * and average-cost division (§5.3) without ever truncating during intermediate work.
 * ROUND_HALF_UP matches the convention IRD's own worked examples use.
 */
Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -40,
  toExpPos: 40,
});

export { Decimal };

export type DecimalInput = string | number | Decimal;

/**
 * Construct a Decimal from a trusted source (a string from a parsed file, or a
 * literal in code/tests). Rejects non-finite numbers so a stray `NaN`/`Infinity`
 * from upstream parsing fails loudly instead of propagating into a tax figure.
 *
 * Prefer passing strings. A `number` input is accepted for ergonomics (e.g. literal
 * constants like `D(0.05)` for the FDR rate) but is converted via `Decimal`'s own
 * number constructor, which is exact for any literal that JS itself parsed exactly —
 * the point of this module is to never do *arithmetic* in floating point, not to
 * forbid numeric literals.
 */
export function D(value: DecimalInput): Decimal {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new RangeError(`D(): non-finite number ${value}`);
  }
  const d = new Decimal(value);
  if (d.isNaN()) {
    throw new RangeError(`D(): value "${String(value)}" is not a valid decimal`);
  }
  return d;
}

export const ZERO = D(0);

/** Sum a list of Decimals; empty list sums to zero. */
export function sum(values: readonly Decimal[]): Decimal {
  return values.reduce((acc: Decimal, v) => acc.plus(v), ZERO);
}

/**
 * Clamp a value to zero if negative. Used wherever the spec says "floored at 0"
 * (FDR income per interest §5.3, quick sale gains §5.3, CV portfolio total §5.4).
 */
export function floorAtZero(value: Decimal): Decimal {
  return value.isNegative() ? ZERO : value;
}

/**
 * Round to 2dp for NZD presentation. This must ONLY be called at the boundary where
 * a figure is about to be displayed, exported, or used as an input the golden tests
 * assert against (see the rounding-boundary note in the M1 handoff) — never on a
 * value that feeds into further arithmetic.
 */
export function roundNzd(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** FX rates are stored to at least 6dp (spec §3.1). Used for display, not storage. */
export function roundRate(value: Decimal): Decimal {
  return value.toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
}

/** Format a Decimal as a fixed-2dp NZD string for UI/export, e.g. "18,965.52" not required here — plain "18965.52". */
export function formatNzd(value: Decimal): string {
  return roundNzd(value).toFixed(2);
}
