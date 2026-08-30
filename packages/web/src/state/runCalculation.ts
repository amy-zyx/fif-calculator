import {
  D,
  TableIrdRateProvider,
  calculateFif,
  getIncomeYearTaxConfig,
  type ClosingPrice,
  type FifCalculationResult,
  instrumentKey,
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

/**
 * Reconciles a hand-entered instrument with the one the broker file used.
 *
 * Broker adapters frequently leave `exchange` null (the IBKR adapter does), so their
 * transactions key as `t:NVDA` under the §3.3 identity order. A user who types an
 * exchange when entering an opening holding would otherwise create `tx:NASDAQ:NVDA` —
 * a DIFFERENT instrument. The opening holding would silently fail to attach to the
 * traded position, and FDR would be computed off an opening market value of zero.
 *
 * So when a hand-entered ticker matches a transaction's ticker, the transaction's own
 * instrument identity wins: the imported file is the authoritative record of what was
 * actually traded, and the user is describing that same holding. Where no transaction
 * mentions the ticker (a holding that saw no activity all year) whatever the user
 * typed is used as-is.
 */
function reconcileInstrument(
  src: { ticker: string; exchange: string | null },
  txnInstruments: Map<string, InstrumentRef>,
): InstrumentRef {
  const fromTxns = txnInstruments.get(src.ticker.toUpperCase());
  return fromTxns ?? toInstrumentRef(src);
}

/**
 * Transaction instruments keyed by ticker, but ONLY where that ticker resolves to a
 * single identity across the imported files. A ticker that appears under two different
 * identities — the same symbol listed on two exchanges — is deliberately left out, so
 * reconciliation never silently picks one of them; those fall through to whatever the
 * user typed, which is the only thing that can distinguish them.
 */
export function txnInstrumentsByTicker(session: SessionState): Map<string, InstrumentRef> {
  const candidates = new Map<string, InstrumentRef[]>();
  for (const txn of allTxns(session)) {
    if (!txn.instrument) continue;
    const key = txn.instrument.ticker.toUpperCase();
    const list = candidates.get(key) ?? [];
    if (!list.some((i) => instrumentKey(i) === instrumentKey(txn.instrument!))) {
      list.push(txn.instrument);
    }
    candidates.set(key, list);
  }

  const unambiguous = new Map<string, InstrumentRef>();
  for (const [ticker, list] of candidates) {
    const only = list[0];
    if (list.length === 1 && only) unambiguous.set(ticker, only);
  }
  return unambiguous;
}

function toOpeningHolding(src: ManualOpeningHolding, txnInstruments: Map<string, InstrumentRef>): OpeningHolding {
  return {
    instrument: reconcileInstrument(src, txnInstruments),
    quantity: D(src.quantity),
    marketPricePerUnit: D(src.marketPricePerUnit),
    currency: src.currency,
    costNzd: D(src.costNzd),
  };
}

function toClosingPrice(src: ManualClosingPrice, txnInstruments: Map<string, InstrumentRef>): ClosingPrice {
  return {
    instrument: reconcileInstrument(src, txnInstruments),
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
  const txnInstruments = txnInstrumentsByTicker(session);

  return calculateFif({
    incomeYear: session.incomeYear,
    txns: allTxns(session),
    openingHoldings: session.openingHoldings.map((h) => toOpeningHolding(h, txnInstruments)),
    closingPrices: session.closingPrices
      .filter((p) => p.pricePerUnit.trim() !== '')
      .map((p) => toClosingPrice(p, txnInstruments)),
    fxPolicy: session.fxPolicy,
    costBasisMethod: session.costBasisMethod,
    ird: new TableIrdRateProvider(toIrdRateTable(session)),
    accountBaseCurrencies: session.accountBaseCurrencies,
    confirmedTransferTxnIds: session.confirmedTransferTxnIds,
    scopeOverrides: session.scopeOverrides,
  });
}
