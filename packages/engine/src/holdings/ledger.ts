import { D, Decimal, ZERO, sum } from '../money';
import { convertToNzd, resolveFxToNzd, type FxResolutionRequest } from '../fx/resolver';
import type { FxPolicy, FxBlock, IrdRateProvider } from '../fx/types';
import { screenInstrument, type ScopeDecision, type ScopeOverride } from '../scope/screening';
import { instrumentKey } from '../scope/instrumentKey';
import type { CanonicalTxn, InstrumentRef, TxnType } from '../types/canonical-txn';

export type CostBasisMethod = 'AVERAGE' | 'FIFO';

export interface OpeningHolding {
  instrument: InstrumentRef;
  quantity: Decimal;
  /** Market price per unit at the start of the income year, in `currency`. */
  marketPricePerUnit: Decimal;
  currency: string;
  /**
   * Original NZD cost of this holding. Required because the de minimis test is on
   * COST, not market value (spec §5.2) — it cannot be derived from market value.
   * Supplied by last year's carry-forward session file, or entered by the user.
   */
  costNzd: Decimal;
}

export interface ClosingPrice {
  instrument: InstrumentRef;
  /** Closing price on the last trading day on or before 31 March, in `currency`. */
  pricePerUnit: Decimal;
  currency: string;
}

export type BlockerKind =
  | 'FX_UNRESOLVED'
  | 'MISSING_CLOSING_PRICE'
  | 'MISSING_OPENING_PRICE'
  | 'UNMATCHED_TRANSFER'
  | 'UNMODELLED_CORPORATE_ACTION';

export interface Blocker {
  kind: BlockerKind;
  message: string;
  ticker?: string;
  date?: string;
  fx?: FxBlock;
}

/** Per-instrument facts for the income year, from which FDR and CV are computed. */
export interface HoldingYearSummary {
  key: string;
  ticker: string;
  currency: string;
  scope: ScopeDecision;

  openingQuantity: Decimal;
  openingCostNzd: Decimal;
  openingMarketValueNzd: Decimal;

  closingQuantity: Decimal;
  closingMarketValueNzd: Decimal;
  /**
   * Remaining NZD cost basis of the holding at year end, after disposals have removed
   * their share. This is what carries forward as next year's opening cost — the
   * de minimis test is on cost, so it must not be confused with closing MARKET value.
   */
  closingCostNzd: Decimal;

  /** Greatest quantity held at any moment during the year (spec §5.3). */
  peakQuantity: Decimal;

  acquiredQuantity: Decimal;
  acquiredCostNzd: Decimal;
  disposedQuantity: Decimal;
  disposalProceedsNzd: Decimal;

  dividendsNzd: Decimal;
  withholdingTaxNzd: Decimal;

  fdrUnavailable: boolean;
}

export interface CostTimelinePoint {
  date: string;
  totalCostNzd: Decimal;
  /** What moved the running total, for the drill-down. */
  note: string;
}

export interface LedgerResult {
  summaries: HoldingYearSummary[];
  /** Total NZD cost of in-scope holdings after each event, for the de minimis test. */
  costTimeline: CostTimelinePoint[];
  blockers: Blocker[];
  /** Transactions excluded from FIF, surfaced rather than hidden (spec §5.1). */
  excluded: ExcludedTxn[];
  warnings: string[];
}

export interface ExcludedTxn {
  txnId: string;
  ticker: string;
  type: TxnType;
  reason: string;
  amountNzd: Decimal | null;
}

const ACQUISITION_TYPES: ReadonlySet<TxnType> = new Set([
  'BUY',
  'DRIP',
  'TRANSFER_IN',
  'OPTION_ASSIGNMENT',
]);
const DISPOSAL_TYPES: ReadonlySet<TxnType> = new Set(['SELL', 'TRANSFER_OUT']);
const IGNORED_FOR_HOLDINGS: ReadonlySet<TxnType> = new Set([
  'FEE',
  'INTEREST',
  'FX_CONVERSION',
  'UNKNOWN',
]);
const UNMODELLED_CORPORATE_ACTIONS: ReadonlySet<TxnType> = new Set([
  'SPLIT',
  'MERGER',
  'SPINOFF',
]);

/** Acquisitions sort before disposals on the same date, so an intraday peak is captured. */
function eventRank(type: TxnType): number {
  if (ACQUISITION_TYPES.has(type)) return 0;
  if (DISPOSAL_TYPES.has(type)) return 1;
  return 2;
}

function sortTxns(txns: readonly CanonicalTxn[]): CanonicalTxn[] {
  return [...txns].sort((a, b) => {
    if (a.tradeDate !== b.tradeDate) return a.tradeDate < b.tradeDate ? -1 : 1;
    const rank = eventRank(a.type) - eventRank(b.type);
    if (rank !== 0) return rank;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

interface MutableState {
  quantity: Decimal;
  costNzd: Decimal;
}

export interface LedgerOptions {
  incomeYear: number;
  startDate: string;
  endDate: string;
  fxPolicy: FxPolicy;
  costBasisMethod: CostBasisMethod;
  ird: IrdRateProvider;
  accountBaseCurrencies?: Record<string, string>;
  scopeOverrides?: Record<string, ScopeOverride>;
  manualFxOverrides?: Record<string, Decimal>;
  /** Ids of transactions confirmed as legs of a matched inter-broker transfer (spec §6). */
  matchedTransferTxnIds?: ReadonlySet<string>;
}

/**
 * Walks every transaction in date order, maintaining per-instrument quantity and
 * NZD cost, and records the running total-cost timeline the de minimis test needs.
 *
 * Matched inter-broker transfers are treated as neutral: because FIF is computed at
 * the taxpayer level across all accounts, a confirmed TRANSFER_OUT/TRANSFER_IN pair
 * for the same instrument nets to nothing. Treating them as a disposal plus a fresh
 * acquisition is what would silently manufacture a fake quick sale (spec §6).
 */
export function buildLedger(
  txns: readonly CanonicalTxn[],
  openingHoldings: readonly OpeningHolding[],
  closingPrices: readonly ClosingPrice[],
  options: LedgerOptions,
): LedgerResult {
  const blockers: Blocker[] = [];
  const warnings: string[] = [];
  const excluded: ExcludedTxn[] = [];

  const summaries = new Map<string, HoldingYearSummary>();
  const state = new Map<string, MutableState>();

  const closingPriceByKey = new Map(closingPrices.map((p) => [instrumentKey(p.instrument), p]));

  function resolve(
    currency: string,
    date: string,
    extra: Partial<FxResolutionRequest> = {},
  ): Decimal | null {
    const resolution = resolveFxToNzd(
      { currency, date, incomeYear: options.incomeYear, ...extra },
      options.fxPolicy,
      options.ird,
    );
    if (resolution.blocked) {
      blockers.push({
        kind: 'FX_UNRESOLVED',
        message: resolution.blocked.message,
        date,
        fx: resolution.blocked,
      });
      return null;
    }
    return convertToNzd(D(1), resolution);
  }

  // --- Seed from the opening holdings -------------------------------------
  for (const holding of openingHoldings) {
    const scope = screenInstrument(holding.instrument, options.scopeOverrides?.[instrumentKey(holding.instrument)]);
    const key = scope.key;

    const factor = resolve(holding.currency, options.startDate);
    const openingMarketValueNzd =
      factor === null ? ZERO : holding.quantity.times(holding.marketPricePerUnit).times(factor);
    if (factor === null) {
      blockers.push({
        kind: 'MISSING_OPENING_PRICE',
        message: `Could not value the opening holding of ${holding.instrument.ticker} at ${options.startDate}.`,
        ticker: holding.instrument.ticker,
        date: options.startDate,
      });
    }

    summaries.set(key, {
      key,
      ticker: holding.instrument.ticker,
      currency: holding.currency,
      scope,
      openingQuantity: holding.quantity,
      openingCostNzd: holding.costNzd,
      openingMarketValueNzd,
      closingQuantity: holding.quantity,
      closingMarketValueNzd: ZERO,
      closingCostNzd: ZERO,
      peakQuantity: holding.quantity,
      acquiredQuantity: ZERO,
      acquiredCostNzd: ZERO,
      disposedQuantity: ZERO,
      disposalProceedsNzd: ZERO,
      dividendsNzd: ZERO,
      withholdingTaxNzd: ZERO,
      fdrUnavailable: scope.fdrUnavailable,
    });
    state.set(key, { quantity: holding.quantity, costNzd: holding.costNzd });
  }

  function ensureSummary(ref: InstrumentRef): HoldingYearSummary {
    const scope = screenInstrument(ref, options.scopeOverrides?.[instrumentKey(ref)]);
    const existing = summaries.get(scope.key);
    if (existing) return existing;
    const created: HoldingYearSummary = {
      key: scope.key,
      ticker: ref.ticker,
      currency: 'NZD',
      scope,
      openingQuantity: ZERO,
      openingCostNzd: ZERO,
      openingMarketValueNzd: ZERO,
      closingQuantity: ZERO,
      closingMarketValueNzd: ZERO,
      closingCostNzd: ZERO,
      peakQuantity: ZERO,
      acquiredQuantity: ZERO,
      acquiredCostNzd: ZERO,
      disposedQuantity: ZERO,
      disposalProceedsNzd: ZERO,
      dividendsNzd: ZERO,
      withholdingTaxNzd: ZERO,
      fdrUnavailable: scope.fdrUnavailable,
    };
    summaries.set(scope.key, created);
    state.set(scope.key, { quantity: ZERO, costNzd: ZERO });
    return created;
  }

  // --- Opening cost timeline point ----------------------------------------
  const inScopeCost = (): Decimal =>
    sum(
      [...summaries.entries()]
        .filter(([, s]) => s.scope.inScope)
        .map(([key]) => state.get(key)?.costNzd ?? ZERO),
    );

  const costTimeline: CostTimelinePoint[] = [
    { date: options.startDate, totalCostNzd: inScopeCost(), note: 'Opening holdings at start of income year.' },
  ];

  // --- Walk the year ------------------------------------------------------
  for (const txn of sortTxns(txns)) {
    if (txn.tradeDate < options.startDate || txn.tradeDate > options.endDate) continue;
    if (!txn.instrument) {
      if (!IGNORED_FOR_HOLDINGS.has(txn.type)) {
        warnings.push(`Transaction ${txn.id} (${txn.type}) has no instrument and was skipped.`);
      }
      continue;
    }

    const summary = ensureSummary(txn.instrument);
    const current = state.get(summary.key);
    if (!current) continue;

    if (summary.currency === 'NZD' && txn.currency !== 'NZD') summary.currency = txn.currency;

    // Options are not attributing FIF interests, but must be visible, not hidden.
    if (!summary.scope.inScope) {
      excluded.push({
        txnId: txn.id,
        ticker: txn.instrument.ticker,
        type: txn.type,
        reason: summary.scope.note,
        amountNzd: null,
      });
      continue;
    }

    if (UNMODELLED_CORPORATE_ACTIONS.has(txn.type)) {
      blockers.push({
        kind: 'UNMODELLED_CORPORATE_ACTION',
        message:
          `${txn.instrument.ticker}: a ${txn.type} on ${txn.tradeDate} is not modelled automatically. ` +
          'Adjust the affected holding manually before relying on this result.',
        ticker: txn.instrument.ticker,
        date: txn.tradeDate,
      });
      continue;
    }

    if (IGNORED_FOR_HOLDINGS.has(txn.type)) continue;

    // A confirmed leg of an inter-broker transfer: neutral at taxpayer level.
    if (options.matchedTransferTxnIds?.has(txn.id)) {
      warnings.push(
        `${txn.instrument.ticker}: ${txn.type} on ${txn.tradeDate} treated as part of a confirmed ` +
          'inter-broker transfer — a continuing holding, not a disposal and re-acquisition.',
      );
      continue;
    }

    if ((txn.type === 'TRANSFER_IN' || txn.type === 'TRANSFER_OUT')) {
      blockers.push({
        kind: 'UNMATCHED_TRANSFER',
        message:
          `${txn.instrument.ticker}: an unmatched ${txn.type} on ${txn.tradeDate}. Confirm whether this ` +
          'is a transfer between your own accounts (a continuing holding) or a real acquisition/disposal.',
        ticker: txn.instrument.ticker,
        date: txn.tradeDate,
      });
      continue;
    }

    const factor = resolve(txn.currency, txn.tradeDate, {
      txnId: txn.id,
      brokerQuotedRate: txn.brokerQuotedRate,
      brokerQuoteTo: txn.brokerQuoteTo,
      accountBaseCurrency: options.accountBaseCurrencies?.[txn.sourceAccountId] ?? null,
      manualOverride: options.manualFxOverrides?.[txn.id] ?? null,
    });
    if (factor === null) continue;

    if (ACQUISITION_TYPES.has(txn.type)) {
      const quantity = txn.quantity ?? ZERO;
      // Cost is the purchase price plus brokerage (spec §5.2). For an assigned
      // option this is strike x quantity; the premium is deliberately NOT netted
      // off by default (spec §5.1 step 3) — that election is flagged, not assumed.
      const costNzd = txn.grossAmount.plus(txn.fees).times(factor);

      current.quantity = current.quantity.plus(quantity);
      current.costNzd = current.costNzd.plus(costNzd);
      summary.acquiredQuantity = summary.acquiredQuantity.plus(quantity);
      summary.acquiredCostNzd = summary.acquiredCostNzd.plus(costNzd);

      if (current.quantity.greaterThan(summary.peakQuantity)) {
        summary.peakQuantity = current.quantity;
      }
      if (txn.type === 'OPTION_ASSIGNMENT') {
        warnings.push(
          `${txn.instrument.ticker}: option assignment on ${txn.tradeDate} recorded as a share ` +
            `acquisition at the strike price (NZD ${costNzd.toFixed(2)}). The option premium has NOT ` +
            'been netted off the cost — elect that separately if you intend to.',
        );
      }
      costTimeline.push({
        date: txn.tradeDate,
        totalCostNzd: inScopeCost(),
        note: `Acquired ${quantity.toString()} ${txn.instrument.ticker} (cost NZD ${costNzd.toFixed(2)}).`,
      });
    } else if (DISPOSAL_TYPES.has(txn.type)) {
      const quantity = txn.quantity ?? ZERO;
      const proceedsNzd = txn.grossAmount.minus(txn.fees).times(factor);

      // Cost removal on partial disposals. Average cost is the default; the choice
      // must be applied consistently and is surfaced to the user (spec §5.2).
      const costRemoved = current.quantity.isZero()
        ? ZERO
        : current.costNzd.dividedBy(current.quantity).times(quantity);

      current.quantity = current.quantity.minus(quantity);
      current.costNzd = current.costNzd.minus(costRemoved);
      if (current.quantity.isNegative()) {
        warnings.push(
          `${txn.instrument.ticker}: disposals exceed holdings by ${current.quantity.abs().toString()} ` +
            'units — check for a missing opening holding or an unimported buy.',
        );
      }
      summary.disposedQuantity = summary.disposedQuantity.plus(quantity);
      summary.disposalProceedsNzd = summary.disposalProceedsNzd.plus(proceedsNzd);

      costTimeline.push({
        date: txn.tradeDate,
        totalCostNzd: inScopeCost(),
        note: `Disposed ${quantity.toString()} ${txn.instrument.ticker} (cost removed NZD ${costRemoved.toFixed(2)}).`,
      });
    } else if (txn.type === 'DIVIDEND') {
      summary.dividendsNzd = summary.dividendsNzd.plus(txn.grossAmount.times(factor));
    } else if (txn.type === 'DIVIDEND_WITHHOLDING_TAX') {
      summary.withholdingTaxNzd = summary.withholdingTaxNzd.plus(txn.grossAmount.abs().times(factor));
    } else if (txn.type === 'RETURN_OF_CAPITAL') {
      const amountNzd = txn.grossAmount.times(factor);
      current.costNzd = current.costNzd.minus(amountNzd);
      costTimeline.push({
        date: txn.tradeDate,
        totalCostNzd: inScopeCost(),
        note: `Return of capital on ${txn.instrument.ticker} reduced cost by NZD ${amountNzd.toFixed(2)}.`,
      });
    }
  }

  // --- Close the year off -------------------------------------------------
  for (const [key, summary] of summaries) {
    const current = state.get(key);
    summary.closingQuantity = current?.quantity ?? ZERO;
    summary.closingCostNzd = current?.costNzd ?? ZERO;

    if (!summary.scope.inScope) continue;

    if (summary.closingQuantity.isZero()) {
      summary.closingMarketValueNzd = ZERO;
      continue;
    }

    const price = closingPriceByKey.get(key);
    if (!price) {
      blockers.push({
        kind: 'MISSING_CLOSING_PRICE',
        message:
          `No 31 March closing price for ${summary.ticker}. Enter one to continue — a missing price ` +
          'must never be treated as zero.',
        ticker: summary.ticker,
        date: options.endDate,
      });
      continue;
    }
    const factor = resolve(price.currency, options.endDate);
    if (factor === null) continue;
    summary.closingMarketValueNzd = summary.closingQuantity.times(price.pricePerUnit).times(factor);
  }

  return { summaries: [...summaries.values()], costTimeline, blockers, excluded, warnings };
}
