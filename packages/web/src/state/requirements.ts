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

  for (const holding of session.openingHoldings) {
    const key = `${holding.ticker}|${holding.exchange ?? ''}`;
    byKey.set(key, { ticker: holding.ticker, exchange: holding.exchange, currency: holding.currency });
  }

  for (const txn of allTxns(session)) {
    if (!txn.instrument) continue;
    // Options are not attributing FIF interests, so they are never valued at 31 March.
    if (txn.instrument.assetClass === 'OPTION') continue;
    const key = `${txn.instrument.ticker}|${txn.instrument.exchange ?? ''}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        ticker: txn.instrument.ticker,
        exchange: txn.instrument.exchange,
        currency: txn.currency,
      });
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

export function missingFxRates(session: SessionState): FxRequirement[] {
  return requiredFxRates(session).filter((r) => {
    const value = session.fxRates[fxRateKey(r.currency, r.date)];
    return value === undefined || value.trim() === '';
  });
}

export function missingClosingPrices(session: SessionState): PriceRequirement[] {
  return requiredClosingPrices(session).filter(
    (r) =>
      !session.closingPrices.some(
        (p) => p.ticker === r.ticker && (p.exchange ?? '') === (r.exchange ?? '') && p.pricePerUnit.trim() !== '',
      ),
  );
}
