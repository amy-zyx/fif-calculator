import type { CanonicalTxn, CostBasisMethod, FxPolicy } from '@fif-calculator/engine';
import type { ParseWarning } from '../adapters/types';

export type Step = 'landing' | 'setup' | 'upload' | 'review' | 'prices' | 'results';

export interface ImportedAccount {
  fileName: string;
  brokerLabel: string;
  verified: boolean;
  txns: CanonicalTxn[];
  warnings: ParseWarning[];
}

/** A closing (31 March) price the user has entered by hand. */
export interface ManualClosingPrice {
  ticker: string;
  exchange: string | null;
  pricePerUnit: string;
  currency: string;
}

/** An opening holding carried forward, or entered by hand. */
export interface ManualOpeningHolding {
  ticker: string;
  exchange: string | null;
  quantity: string;
  marketPricePerUnit: string;
  currency: string;
  costNzd: string;
}

/**
 * FX rates entered by hand, keyed `${currency}|${date}`.
 *
 * M6 replaces this with the bundled IRD dataset. Until then the ManualEntryProvider
 * path is the ONLY rate source, which is deliberate: spec §2 requires manual entry to
 * be fully functional on its own so the app still works with no API key and no
 * network. A missing rate must block, never silently become zero.
 */
export type ManualFxRates = Record<string, string>;

export function fxRateKey(currency: string, date: string): string {
  return `${currency}|${date}`;
}

export interface SessionState {
  taxpayerName: string;
  incomeYear: number;
  fxPolicy: FxPolicy;
  costBasisMethod: CostBasisMethod;
  accounts: ImportedAccount[];
  openingHoldings: ManualOpeningHolding[];
  closingPrices: ManualClosingPrice[];
  fxRates: ManualFxRates;
  /** Transfer candidate pairs the user has confirmed are their own (spec §6). */
  confirmedTransferTxnIds: string[];
  /** sourceAccountId -> statement base currency, when it is not NZD (spec §5.7 trap 1). */
  accountBaseCurrencies: Record<string, string>;
}

export function emptySession(): SessionState {
  return {
    taxpayerName: '',
    incomeYear: 2026,
    fxPolicy: 'A',
    costBasisMethod: 'AVERAGE',
    accounts: [],
    openingHoldings: [],
    closingPrices: [],
    fxRates: {},
    confirmedTransferTxnIds: [],
    accountBaseCurrencies: {},
  };
}

export function allTxns(session: SessionState): CanonicalTxn[] {
  return session.accounts.flatMap((a) => a.txns);
}
