import {
  D,
  TableIrdRateProvider,
  calculateFif,
  getIncomeYearTaxConfig,
  type ClosingPrice,
  type FifCalculationResult,
  type InstrumentRef,
  type IrdRateTable,
  type OpeningHolding,
} from '@fif-calculator/engine';
import { allTxns, type ManualClosingPrice, type ManualOpeningHolding, type SessionState } from './session';

function toInstrumentRef(src: { ticker: string; exchange: string | null }): InstrumentRef {
  return {
    ticker: src.ticker,
    exchange: src.exchange,
    isin: null,
    name: null,
    assetClass: 'EQUITY',
  };
}

function toOpeningHolding(src: ManualOpeningHolding): OpeningHolding {
  return {
    instrument: toInstrumentRef(src),
    quantity: D(src.quantity),
    marketPricePerUnit: D(src.marketPricePerUnit),
    currency: src.currency,
    costNzd: D(src.costNzd),
  };
}

function toClosingPrice(src: ManualClosingPrice): ClosingPrice {
  return {
    instrument: toInstrumentRef(src),
    pricePerUnit: D(src.pricePerUnit),
    currency: src.currency,
  };
}

/**
 * Turns the hand-entered FX rates into the table the engine's IRD provider reads.
 *
 * Rates are stored in IRD convention — units of foreign currency per 1 NZD — which is
 * what the engine expects and what the Prices screen labels them as. The engine takes
 * the reciprocal itself, in exactly one place; nothing here inverts anything.
 */
function toIrdRateTable(session: SessionState): IrdRateTable {
  const table: IrdRateTable = {};
  for (const [key, value] of Object.entries(session.fxRates)) {
    if (!value || value.trim() === '') continue;
    const [currency, date] = key.split('|');
    if (!currency || !date) continue;
    const forCurrency = table[currency] ?? {};
    forCurrency[date] = value.trim();
    table[currency] = forCurrency;
  }
  return table;
}

export function runCalculation(session: SessionState): FifCalculationResult {
  // Throws for an unsupported year rather than guessing a threshold — surfaced by
  // the caller as an error, never silently defaulted.
  getIncomeYearTaxConfig(session.incomeYear);

  return calculateFif({
    incomeYear: session.incomeYear,
    txns: allTxns(session),
    openingHoldings: session.openingHoldings.map(toOpeningHolding),
    closingPrices: session.closingPrices
      .filter((p) => p.pricePerUnit.trim() !== '')
      .map(toClosingPrice),
    fxPolicy: session.fxPolicy,
    costBasisMethod: session.costBasisMethod,
    ird: new TableIrdRateProvider(toIrdRateTable(session)),
    accountBaseCurrencies: session.accountBaseCurrencies,
    confirmedTransferTxnIds: session.confirmedTransferTxnIds,
  });
}
