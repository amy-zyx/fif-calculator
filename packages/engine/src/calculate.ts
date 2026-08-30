import { D, Decimal, ZERO, sum } from './money';
import { dedupeTxns, type DuplicateGroup } from './consolidation/dedupe';
import { findTransferMatches, type TransferMatchCandidate } from './consolidation/transfers';
import { convertToNzd, resolveFxToNzd } from './fx/resolver';
import type { FxPolicy, IrdRateProvider } from './fx/types';
import {
  buildLedger,
  type Blocker,
  type ClosingPrice,
  type CostBasisMethod,
  type ExcludedTxn,
  type HoldingYearSummary,
  type LedgerResult,
  type OpeningHolding,
} from './holdings/ledger';
import { testDeMinimis, type DeMinimisResult } from './methods/deMinimis';
import { electMethod, emptyElection, type ElectionResult } from './methods/election';
import type { ScopeOverride } from './scope/screening';
import { getIncomeYearTaxConfig } from './tax-config';
import type { CanonicalTxn } from './types/canonical-txn';

export interface FifCalculationInput {
  incomeYear: number;
  txns: readonly CanonicalTxn[];
  openingHoldings: readonly OpeningHolding[];
  closingPrices: readonly ClosingPrice[];
  fxPolicy: FxPolicy;
  costBasisMethod: CostBasisMethod;
  ird: IrdRateProvider;
  /** sourceAccountId -> the statement's account base currency (often NOT NZD). */
  accountBaseCurrencies?: Record<string, string>;
  scopeOverrides?: Record<string, ScopeOverride>;
  manualFxOverrides?: Record<string, Decimal>;
  /** Transfer pairs the user has explicitly confirmed (spec §6). */
  confirmedTransferTxnIds?: readonly string[];
  thresholdOverrideNzd?: Decimal;
}

export interface FxVarianceLine {
  txnId: string;
  ticker: string;
  date: string;
  nzdPolicyA: Decimal;
  nzdPolicyB: Decimal;
  differenceNzd: Decimal;
}

export interface FxVariancePanel {
  costBasisNzdPolicyA: Decimal;
  costBasisNzdPolicyB: Decimal;
  peakCostNzdPolicyA: Decimal;
  peakCostNzdPolicyB: Decimal;
  inFifPolicyA: boolean;
  inFifPolicyB: boolean;
  topDifferences: FxVarianceLine[];
}

export interface ForeignTaxCreditLine {
  ticker: string;
  grossWithholdingNzd: Decimal;
}

export interface ForeignTaxCreditSchedule {
  lines: ForeignTaxCreditLine[];
  totalGrossNzd: Decimal;
  note: string;
}

interface CommonResult {
  incomeYear: number;
  fxPolicy: FxPolicy;
  costBasisMethod: CostBasisMethod;
  duplicatesRemoved: DuplicateGroup[];
  transferCandidates: TransferMatchCandidate[];
  excluded: ExcludedTxn[];
  warnings: string[];
  blockers: Blocker[];
  fxVariance: FxVariancePanel;
}

export type FifCalculationResult =
  | (CommonResult & { status: 'BLOCKED' })
  | (CommonResult & {
      status: 'THRESHOLD_AMBIGUOUS';
      deMinimisPolicyA: DeMinimisResult;
      deMinimisPolicyB: DeMinimisResult;
      message: string;
    })
  | (CommonResult & { status: 'NOT_IN_FIF'; deMinimis: DeMinimisResult })
  | (CommonResult & {
      status: 'OK';
      deMinimis: DeMinimisResult;
      election: ElectionResult;
      holdings: HoldingYearSummary[];
      foreignTaxCredits: ForeignTaxCreditSchedule;
    });

const FTC_NOTE =
  'This is the GROSS foreign withholding tax deducted. The amount you can actually claim as a ' +
  'foreign tax credit is capped and depends on your wider circumstances — it is NOT computed here. ' +
  'Country attribution is not derived from broker exports; confirm it with your accountant.';

/**
 * The top-level FIF calculation (spec §5).
 *
 * Order matters here. The de minimis verdict depends on the FX policy, because the
 * test is on NZD cost — so both policy A and policy B are always computed, and a
 * disagreement between them about whether the taxpayer is in FIF at all stops the
 * calculation rather than resolving itself silently (spec §5.7, GT-12).
 */
export function calculateFif(input: FifCalculationInput): FifCalculationResult {
  const config = getIncomeYearTaxConfig(input.incomeYear);
  const { txns: deduped, duplicates } = dedupeTxns(input.txns);
  const transferCandidates = findTransferMatches(deduped);
  const matchedTransferTxnIds = new Set(input.confirmedTransferTxnIds ?? []);

  const ledgerFor = (policy: FxPolicy): LedgerResult =>
    buildLedger(deduped, input.openingHoldings, input.closingPrices, {
      incomeYear: input.incomeYear,
      startDate: config.startDate,
      endDate: config.endDate,
      fxPolicy: policy,
      costBasisMethod: input.costBasisMethod,
      ird: input.ird,
      ...(input.accountBaseCurrencies ? { accountBaseCurrencies: input.accountBaseCurrencies } : {}),
      ...(input.scopeOverrides ? { scopeOverrides: input.scopeOverrides } : {}),
      ...(input.manualFxOverrides ? { manualFxOverrides: input.manualFxOverrides } : {}),
      matchedTransferTxnIds,
    });

  const ledgerA = ledgerFor('A');
  const ledgerB = ledgerFor('B');
  const selected = input.fxPolicy === 'A' ? ledgerA : input.fxPolicy === 'B' ? ledgerB : ledgerFor('C');

  const deMinimisA = testDeMinimis(ledgerA.costTimeline, input.incomeYear, input.thresholdOverrideNzd);
  const deMinimisB = testDeMinimis(ledgerB.costTimeline, input.incomeYear, input.thresholdOverrideNzd);

  const fxVariance: FxVariancePanel = {
    costBasisNzdPolicyA: totalCostBasis(ledgerA),
    costBasisNzdPolicyB: totalCostBasis(ledgerB),
    peakCostNzdPolicyA: deMinimisA.peakCostNzd,
    peakCostNzdPolicyB: deMinimisB.peakCostNzd,
    inFifPolicyA: deMinimisA.inFif,
    inFifPolicyB: deMinimisB.inFif,
    topDifferences: computeTopFxDifferences(deduped, input),
  };

  const common: CommonResult = {
    incomeYear: input.incomeYear,
    fxPolicy: input.fxPolicy,
    costBasisMethod: input.costBasisMethod,
    duplicatesRemoved: duplicates,
    transferCandidates,
    excluded: selected.excluded,
    warnings: selected.warnings,
    blockers: selected.blockers,
    fxVariance,
  };

  // A missing price or an unconfirmed rate must stop the calculation, not default
  // to zero (spec §2, §5 step 5).
  if (selected.blockers.length > 0) {
    return { ...common, status: 'BLOCKED' };
  }

  // The highest-stakes disagreement the tool can produce (spec §5.7).
  if (
    ledgerA.blockers.length === 0 &&
    ledgerB.blockers.length === 0 &&
    deMinimisA.inFif !== deMinimisB.inFif
  ) {
    return {
      ...common,
      status: 'THRESHOLD_AMBIGUOUS',
      deMinimisPolicyA: deMinimisA,
      deMinimisPolicyB: deMinimisB,
      message:
        `Your FX policy changes whether you are in the FIF regime at all. Under IRD rates your peak ` +
        `cost was NZD ${deMinimisA.peakCostNzd.toFixed(2)} (${deMinimisA.inFif ? 'over' : 'under'} the ` +
        `NZD ${deMinimisA.thresholdUsed.toFixed(2)} threshold); under broker dealt rates it was NZD ` +
        `${deMinimisB.peakCostNzd.toFixed(2)} (${deMinimisB.inFif ? 'over' : 'under'}). ` +
        'Choose an FX policy explicitly before a FIF figure can be produced.',
    };
  }

  const deMinimis =
    input.fxPolicy === 'B'
      ? deMinimisB
      : input.fxPolicy === 'A'
        ? deMinimisA
        : testDeMinimis(selected.costTimeline, input.incomeYear, input.thresholdOverrideNzd);

  if (!deMinimis.inFif) {
    return { ...common, status: 'NOT_IN_FIF', deMinimis };
  }

  const inScope = selected.summaries.filter((s) => s.scope.inScope);
  const election = inScope.length === 0 ? emptyElection() : electMethod(selected.summaries, input.incomeYear);

  return {
    ...common,
    status: 'OK',
    deMinimis,
    election,
    holdings: selected.summaries,
    foreignTaxCredits: buildFtcSchedule(selected.summaries),
  };
}

function totalCostBasis(ledger: LedgerResult): Decimal {
  return sum(ledger.summaries.filter((s) => s.scope.inScope).map((s) => s.acquiredCostNzd));
}

function buildFtcSchedule(summaries: readonly HoldingYearSummary[]): ForeignTaxCreditSchedule {
  const lines = summaries
    .filter((s) => s.scope.inScope && s.withholdingTaxNzd.greaterThan(ZERO))
    .map((s) => ({ ticker: s.ticker, grossWithholdingNzd: s.withholdingTaxNzd }));
  return {
    lines,
    totalGrossNzd: sum(lines.map((l) => l.grossWithholdingNzd)),
    note: FTC_NOTE,
  };
}

/**
 * The FX variance panel of spec §5.7 — "cheap to compute and the fastest way to
 * catch a mis-parsed rate column".
 */
function computeTopFxDifferences(
  txns: readonly CanonicalTxn[],
  input: FifCalculationInput,
): FxVarianceLine[] {
  const lines: FxVarianceLine[] = [];

  for (const txn of txns) {
    if (!txn.instrument || txn.currency === 'NZD') continue;
    const request = {
      currency: txn.currency,
      date: txn.tradeDate,
      incomeYear: input.incomeYear,
      txnId: txn.id,
      brokerQuotedRate: txn.brokerQuotedRate,
      brokerQuoteTo: txn.brokerQuoteTo,
      accountBaseCurrency: input.accountBaseCurrencies?.[txn.sourceAccountId] ?? null,
      manualOverride: input.manualFxOverrides?.[txn.id] ?? null,
    };

    const a = resolveFxToNzd(request, 'A', input.ird);
    const b = resolveFxToNzd(request, 'B', input.ird);
    if (a.blocked || b.blocked) continue;

    const amount = txn.grossAmount;
    const nzdPolicyA = convertToNzd(amount, a);
    const nzdPolicyB = convertToNzd(amount, b);
    const differenceNzd = nzdPolicyB.minus(nzdPolicyA);
    if (differenceNzd.isZero()) continue;

    lines.push({
      txnId: txn.id,
      ticker: txn.instrument.ticker,
      date: txn.tradeDate,
      nzdPolicyA,
      nzdPolicyB,
      differenceNzd,
    });
  }

  return lines
    .sort((x, y) => (y.differenceNzd.abs().comparedTo(x.differenceNzd.abs())))
    .slice(0, 10);
}

export { D, ZERO };
