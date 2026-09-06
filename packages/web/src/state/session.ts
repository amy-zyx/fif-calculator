import type { CanonicalTxn, CostBasisMethod, FxPolicy, ScopeOverride } from '@fif-calculator/engine';
import type { ParsedFile, ParseWarning } from '../adapters/types';

export type Step = 'landing' | 'setup' | 'upload' | 'review' | 'prices' | 'results';

export interface ImportedAccount {
  fileName: string;
  brokerLabel: string;
  verified: boolean;
  txns: CanonicalTxn[];
  warnings: ParseWarning[];
  /**
   * The parsed rows this account came from, kept so the user can re-open the Column
   * Mapping Wizard and map the file by hand even after an adapter matched it — an
   * adapter can be confidently wrong, and the user is the one who can tell.
   */
  file?: ParsedFile;
  /** True when these transactions came from a hand-built mapping, not an adapter. */
  manuallyMapped?: boolean;
  /** What the currency filter dropped at import, so the removal is never silent. */
  currencyFiltered?: CurrencyFilterSummary;
}

export interface CurrencyFilterSummary {
  /** Currencies that were filtered out. */
  currencies: string[];
  /** How many transactions were dropped, per currency. */
  droppedByCurrency: Record<string, number>;
  /** Which instruments disappeared entirely, for the review panel. */
  droppedTickers: string[];
}

/**
 * Currencies whose trades are dropped at IMPORT — they never enter the ledger, the
 * review table, the price requests or the working paper.
 *
 * Currency is a proxy for the statutory tests, and it is only sound in one direction.
 * NZD in practice means an NZX-listed PIE or NZ company, which genuinely is not a FIF
 * interest. AUD does NOT mean exempt: the Australian listed share exemption applies to
 * SHARES IN A COMPANY that is Australian-resident, on an approved index, not stapled,
 * and required to maintain an imputation credit account — an ASX-listed ETF or unit
 * trust is typically none of those and may still be an attributing FIF interest, so
 * dropping it understates income. That is why this is a setting rather than a
 * hardcoded rule, and why what it removes is always reported.
 */
export const DEFAULT_EXCLUDED_CURRENCIES = ['NZD', 'AUD'];

/** Splits transactions into those kept and a summary of what the filter removed. */
export function applyCurrencyFilter(
  txns: readonly CanonicalTxn[],
  excludedCurrencies: readonly string[],
): { kept: CanonicalTxn[]; summary: CurrencyFilterSummary | undefined } {
  const excluded = new Set(excludedCurrencies.map((c) => c.toUpperCase()));
  if (excluded.size === 0) return { kept: [...txns], summary: undefined };

  const kept: CanonicalTxn[] = [];
  const droppedByCurrency: Record<string, number> = {};
  const droppedTickers = new Set<string>();
  const keptTickers = new Set<string>();

  for (const txn of txns) {
    const currency = txn.currency.toUpperCase();
    if (excluded.has(currency)) {
      droppedByCurrency[currency] = (droppedByCurrency[currency] ?? 0) + 1;
      if (txn.instrument) droppedTickers.add(txn.instrument.ticker);
    } else {
      kept.push(txn);
      if (txn.instrument) keptTickers.add(txn.instrument.ticker);
    }
  }

  if (Object.keys(droppedByCurrency).length === 0) return { kept, summary: undefined };

  return {
    kept,
    summary: {
      currencies: Object.keys(droppedByCurrency).sort(),
      droppedByCurrency,
      // Only instruments that vanished completely — one leg of a dual-currency holding
      // disappearing would be far more misleading to report as "dropped".
      droppedTickers: [...droppedTickers].filter((t) => !keptTickers.has(t)).sort(),
    },
  };
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
  /**
   * Per-holding manual scope decisions, keyed by instrument key (spec §5.1 step 2,
   * §5.5). Two things the engine cannot determine on its own live here: whether an
   * Australian-listed holding qualifies for the exemption, and whether FDR is
   * unavailable for the interest.
   */
  scopeOverrides: Record<string, ScopeOverride>;
  /** Trades in these currencies are dropped at import — see DEFAULT_EXCLUDED_CURRENCIES. */
  excludedCurrencies: string[];
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
    scopeOverrides: {},
    excludedCurrencies: [...DEFAULT_EXCLUDED_CURRENCIES],
  };
}

export function allTxns(session: SessionState): CanonicalTxn[] {
  return session.accounts.flatMap((a) => a.txns);
}

/**
 * A taxpayer and everything that belongs to them (spec §6).
 *
 * A `SessionState` is ONE person's complete position: their accounts, their opening
 * holdings, their prices and rates, their FX policy. Nothing is shared between
 * taxpayers, deliberately — the de minimis threshold is per person, so pooling two
 * people's holdings would silently push one or both over it. Keeping the whole session
 * inside the taxpayer, rather than splitting "shared settings" out, means there is no
 * structural way for one person's holdings to reach another's calculation.
 */
export interface Taxpayer {
  id: string;
  session: SessionState;
}

export interface Workspace {
  taxpayers: Taxpayer[];
  activeTaxpayerId: string;
}

let taxpayerCounter = 0;

export function newTaxpayerId(): string {
  taxpayerCounter += 1;
  return `tp_${Date.now().toString(36)}_${taxpayerCounter}`;
}

export function emptyWorkspace(): Workspace {
  const first: Taxpayer = { id: newTaxpayerId(), session: emptySession() };
  return { taxpayers: [first], activeTaxpayerId: first.id };
}

export function activeTaxpayer(workspace: Workspace): Taxpayer {
  const found = workspace.taxpayers.find((t) => t.id === workspace.activeTaxpayerId);
  // Falling back to the first is safe: the workspace always holds at least one
  // taxpayer, and an unknown active id can only come from corrupted stored state.
  return found ?? (workspace.taxpayers[0] as Taxpayer);
}

export function activeSession(workspace: Workspace): SessionState {
  return activeTaxpayer(workspace).session;
}

/** Applies a patch to the ACTIVE taxpayer only. Never touches any other. */
export function patchActiveSession(workspace: Workspace, patch: Partial<SessionState>): Workspace {
  return {
    ...workspace,
    taxpayers: workspace.taxpayers.map((t) =>
      t.id === workspace.activeTaxpayerId ? { ...t, session: { ...t.session, ...patch } } : t,
    ),
  };
}

export function addTaxpayer(workspace: Workspace, name = ''): Workspace {
  const created: Taxpayer = { id: newTaxpayerId(), session: { ...emptySession(), taxpayerName: name } };
  return { taxpayers: [...workspace.taxpayers, created], activeTaxpayerId: created.id };
}

/** Removing the last taxpayer is not possible — the workspace always has at least one. */
export function removeTaxpayer(workspace: Workspace, id: string): Workspace {
  if (workspace.taxpayers.length <= 1) return workspace;
  const remaining = workspace.taxpayers.filter((t) => t.id !== id);
  const stillActive = remaining.some((t) => t.id === workspace.activeTaxpayerId);
  return {
    taxpayers: remaining,
    activeTaxpayerId: stillActive ? workspace.activeTaxpayerId : (remaining[0] as Taxpayer).id,
  };
}

export function switchTaxpayer(workspace: Workspace, id: string): Workspace {
  return workspace.taxpayers.some((t) => t.id === id) ? { ...workspace, activeTaxpayerId: id } : workspace;
}

/**
 * Copies ONLY the FX rate table from one taxpayer to another.
 *
 * Exchange rates are objective market data, not personal information, so retyping them
 * for a second person is pure tedium. Holdings, accounts and prices are deliberately
 * NOT copied by this or any other action — that is the pooling the isolation exists to
 * prevent.
 */
export function copyFxRatesFrom(workspace: Workspace, sourceTaxpayerId: string): Workspace {
  const source = workspace.taxpayers.find((t) => t.id === sourceTaxpayerId);
  if (!source || source.id === workspace.activeTaxpayerId) return workspace;
  return patchActiveSession(workspace, { fxRates: { ...source.session.fxRates } });
}

export function taxpayerLabel(taxpayer: Taxpayer, index: number): string {
  return taxpayer.session.taxpayerName.trim() || `Taxpayer ${index + 1}`;
}
