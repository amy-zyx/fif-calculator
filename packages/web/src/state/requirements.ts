import { getIncomeYearTaxConfig } from '@fif-calculator/engine';
import { allTxns, fxRateKey, type SessionState } from './session';

export interface PriceRequirement {
  ticker: string;
  exchange: string | null;
  currency: string;
}

export interface FxRequirement {
  currency: string;
  date: string;
}

/**
 * The exact list of closing prices the calculation will need (spec §7 step 5).
 *
 * This deliberately over-asks slightly: it requests a closing price for every
 * in-scope instrument that appears anywhere in the year, without first running the
 * ledger to discover which ones still have a non-zero closing quantity. Asking for a
 * price that turns out to be unnecessary costs the user a moment; failing to ask for
 * one that IS necessary blocks the calculation, which is worse.
 */
export function requiredClosingPrices(session: SessionState): PriceRequirement[] {
  const byKey = new Map<string, PriceRequirement>();

  // Transactions first, so their identity is the one shown. A hand-entered holding for
  // the same ticker is reconciled onto it at calculation time (see runCalculation), so
  // listing both would ask the user for the same price twice.
  for (const txn of allTxns(session)) {
    if (!txn.instrument) continue;
    // Options are not attributing FIF interests, so they are never valued at 31 March.
    if (txn.instrument.assetClass === 'OPTION') continue;
    byKey.set(txn.instrument.ticker.toUpperCase(), {
      ticker: txn.instrument.ticker,
      exchange: txn.instrument.exchange,
      currency: txn.currency,
    });
  }

  for (const holding of session.openingHoldings) {
    if (holding.ticker.trim() === '') continue;
    const key = holding.ticker.toUpperCase();
    if (!byKey.has(key)) {
      byKey.set(key, { ticker: holding.ticker, exchange: holding.exchange, currency: holding.currency });
    }
  }

  return [...byKey.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
}

/**
 * Every (currency, date) pair a conversion will be attempted for: each transaction's
 * own trade date, plus the year's start and end dates for opening and closing values.
 */
export function requiredFxRates(session: SessionState): FxRequirement[] {
  const config = getIncomeYearTaxConfig(session.incomeYear);
  const byKey = new Map<string, FxRequirement>();

  const add = (currency: string, date: string) => {
    if (currency === 'NZD') return;
    byKey.set(fxRateKey(currency, date), { currency, date });
  };

  for (const txn of allTxns(session)) {
    add(txn.currency, txn.tradeDate);
  }
  for (const holding of session.openingHoldings) {
    add(holding.currency, config.startDate);
  }
  for (const price of session.closingPrices) {
    add(price.currency, config.endDate);
  }
  // Opening and closing valuations always need the boundary dates for every currency
  // seen anywhere, even if no transaction happened to fall on them.
  const currencies = new Set<string>([
    ...allTxns(session).map((t) => t.currency),
    ...session.openingHoldings.map((h) => h.currency),
    ...session.closingPrices.map((p) => p.currency),
  ]);
  for (const currency of currencies) {
    add(currency, config.startDate);
    add(currency, config.endDate);
  }

  return [...byKey.values()].sort(
    (a, b) => a.currency.localeCompare(b.currency) || a.date.localeCompare(b.date),
  );
}

export interface CoveringRate {
  /** The date the rate was actually entered against. */
  date: string;
  value: string;
  /** True when it was entered for this exact date rather than carried forward. */
  exact: boolean;
}

/**
 * The rate that will actually be used for (currency, date).
 *
 * IRD publishes monthly and mid-month tables, and its rates are applied by carrying the
 * most recent published rate forward — a trade on the 22nd uses that month's rate. The
 * engine's `TableIrdRateProvider` already looks rates up that way, so the Prices screen
 * must agree: a date is covered if a rate exists for that currency on or before it.
 *
 * Asking for a separate figure on every trade date would be over-asking, and worse, it
 * would invite the user to type slightly different rates for dates that IR461 says share
 * one published rate.
 */
export function coveringRate(session: SessionState, currency: string, date: string): CoveringRate | null {
  let best: CoveringRate | null = null;
  for (const [key, value] of Object.entries(session.fxRates)) {
    if (!value || value.trim() === '') continue;
    const [entryCurrency, entryDate] = key.split('|');
    if (entryCurrency !== currency || !entryDate) continue;
    if (entryDate > date) continue;
    if (!best || entryDate > best.date) {
      best = { date: entryDate, value: value.trim(), exact: entryDate === date };
    }
  }
  return best;
}

/** Dates with no rate on or before them — the ones that genuinely still block. */
export function missingFxRates(session: SessionState): FxRequirement[] {
  return requiredFxRates(session).filter((r) => coveringRate(session, r.currency, r.date) === null);
}

/** The distinct currencies the calculation needs, for the per-currency entry UI. */
export function requiredCurrencies(session: SessionState): string[] {
  return [...new Set(requiredFxRates(session).map((r) => r.currency))].sort();
}

/**
 * IRD's own exchange rate tables. Linked rather than scraped: there is no public API,
 * and a rate transcribed by the user from the source they can cite is worth more than
 * one this app guessed.
 */
export const IRD_FX_URL =
  'https://www.ird.govt.nz/international-tax/business/foreign-currency/exchange-rates';

export function missingClosingPrices(session: SessionState): PriceRequirement[] {
  // Matched on ticker, consistent with how requirements are keyed and how a
  // hand-entered holding is reconciled onto its transactions at calculation time.
  return requiredClosingPrices(session).filter(
    (r) =>
      !session.closingPrices.some(
        (p) => p.ticker.toUpperCase() === r.ticker.toUpperCase() && p.pricePerUnit.trim() !== '',
      ),
  );
}
