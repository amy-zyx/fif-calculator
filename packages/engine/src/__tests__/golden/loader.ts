import { D, ZERO } from '../../money';
import { TableIrdRateProvider, type IrdRateTable } from '../../fx/irdProvider';
import type { FxPolicy } from '../../fx/types';
import type { CostBasisMethod, ClosingPrice, OpeningHolding } from '../../holdings/ledger';
import type { FifCalculationInput } from '../../calculate';
import type { AssetClass, BrokerId, CanonicalTxn, InstrumentRef, TxnType } from '../../types/canonical-txn';

export interface GoldenInstrument {
  ticker: string;
  exchange?: string;
  isin?: string;
  assetClass?: AssetClass;
}

export interface GoldenTxn extends GoldenInstrument {
  id: string;
  date: string;
  type: TxnType;
  currency: string;
  gross: string;
  quantity?: string;
  price?: string;
  fees?: string;
  account?: string;
  brokerId?: BrokerId;
  brokerRef?: string;
  brokerQuotedRate?: string;
  brokerQuoteTo?: string;
}

export interface GoldenOpeningHolding extends GoldenInstrument {
  quantity: string;
  marketPricePerUnit: string;
  currency: string;
  costNzd: string;
}

export interface GoldenClosingPrice extends GoldenInstrument {
  pricePerUnit: string;
  currency: string;
}

export interface GoldenFixture {
  id: string;
  title: string;
  description: string;
  input: {
    incomeYear: number;
    fxPolicy: FxPolicy;
    costBasisMethod: CostBasisMethod;
    irdRates: IrdRateTable;
    openingHoldings: GoldenOpeningHolding[];
    closingPrices: GoldenClosingPrice[];
    txns: GoldenTxn[];
    accountBaseCurrencies?: Record<string, string>;
    confirmedTransferTxnIds?: string[];
    thresholdOverrideNzd?: string;
  };
  expected: GoldenExpected;
}

export interface GoldenExpected {
  status: 'OK' | 'NOT_IN_FIF' | 'THRESHOLD_AMBIGUOUS' | 'BLOCKED';
  inFif?: boolean;
  peakCostNzd?: string;
  peakCostDate?: string;
  fdrTotalNzd?: string;
  cvTotalNzd?: string;
  cvRawTotalNzd?: string;
  recommendedMethod?: 'FDR' | 'CV';
  recommendedIncomeNzd?: string;
  duplicatesRemovedCount?: number;
  excludedTickers?: string[];
  blockerKinds?: string[];
  peakCostNzdPolicyA?: string;
  peakCostNzdPolicyB?: string;
  /**
   * Total NZD cost of interests ACQUIRED during the year, under policy A. Available
   * on every status, unlike `holdings` — which is why GT-5 uses it to prove the
   * de minimis test reads holdings at a point in time rather than summing the year's
   * purchases (a NOT_IN_FIF result exposes no per-holding working to assert against).
   */
  costBasisNzdPolicyA?: string;
  /** Only asserted when `status` is OK — a non-OK result carries no per-holding working. */
  holdings?: Record<string, GoldenHoldingExpectation>;
}

export interface GoldenHoldingExpectation {
  openingMarketValueNzd?: string;
  closingMarketValueNzd?: string;
  acquiredCostNzd?: string;
  acquiredQuantity?: string;
  disposalProceedsNzd?: string;
  peakQuantity?: string;
  closingQuantity?: string;
  fdrIncomeNzd?: string;
  quickSaleApplies?: boolean;
  quickSaleAdjustmentNzd?: string;
  quickSaleBindingBranch?: 'PEAK_HOLDING' | 'ACTUAL_GAINS' | 'NONE';
  peakHoldingAmountNzd?: string;
  quickSaleGainsNzd?: string;
  averageCostNzd?: string;
  cvIncomeNzd?: string;
  /**
   * Values this figure must NOT take. Records the specific silent failure a case
   * guards against, so the fixture states the trap in the open rather than relying
   * on a reader inferring it from the correct value alone (see GT-10).
   */
  acquiredCostNzdMustNotBe?: string[];
}

function toInstrumentRef(src: GoldenInstrument): InstrumentRef {
  return {
    ticker: src.ticker,
    exchange: src.exchange ?? null,
    isin: src.isin ?? null,
    name: null,
    assetClass: src.assetClass ?? 'EQUITY',
  };
}

export function toCanonicalTxn(src: GoldenTxn, incomeYear: number): CanonicalTxn {
  const gross = D(src.gross);
  const fees = src.fees ? D(src.fees) : ZERO;
  return {
    id: src.id,
    sourceAccountId: src.account ?? 'acct_1',
    brokerId: src.brokerId ?? 'IBKR',
    brokerRef: src.brokerRef ?? null,
    tradeDate: src.date,
    settleDate: null,
    nzIncomeYear: incomeYear,
    type: src.type,
    instrument: toInstrumentRef(src),
    quantity: src.quantity ? D(src.quantity) : null,
    pricePerUnit: src.price ? D(src.price) : null,
    currency: src.currency,
    grossAmount: gross,
    fees,
    netAmount: gross.plus(fees),
    brokerQuotedRate: src.brokerQuotedRate ? D(src.brokerQuotedRate) : null,
    brokerQuoteFrom: src.brokerQuotedRate ? src.currency : null,
    brokerQuoteTo: src.brokerQuoteTo ?? null,
    brokerRateDirectionConfidence: 'UNKNOWN',
    fxRateToNzd: null,
    fxRateSource: null,
    fxResolutionTrace: [],
    rawRow: {},
    parseWarnings: [],
  };
}

export function toOpeningHolding(src: GoldenOpeningHolding): OpeningHolding {
  return {
    instrument: toInstrumentRef(src),
    quantity: D(src.quantity),
    marketPricePerUnit: D(src.marketPricePerUnit),
    currency: src.currency,
    costNzd: D(src.costNzd),
  };
}

export function toClosingPrice(src: GoldenClosingPrice): ClosingPrice {
  return {
    instrument: toInstrumentRef(src),
    pricePerUnit: D(src.pricePerUnit),
    currency: src.currency,
  };
}

export function toCalculationInput(fixture: GoldenFixture): FifCalculationInput {
  const { input } = fixture;
  return {
    incomeYear: input.incomeYear,
    txns: input.txns.map((t) => toCanonicalTxn(t, input.incomeYear)),
    openingHoldings: input.openingHoldings.map(toOpeningHolding),
    closingPrices: input.closingPrices.map(toClosingPrice),
    fxPolicy: input.fxPolicy,
    costBasisMethod: input.costBasisMethod,
    ird: new TableIrdRateProvider(input.irdRates),
    ...(input.accountBaseCurrencies ? { accountBaseCurrencies: input.accountBaseCurrencies } : {}),
    ...(input.confirmedTransferTxnIds ? { confirmedTransferTxnIds: input.confirmedTransferTxnIds } : {}),
    ...(input.thresholdOverrideNzd ? { thresholdOverrideNzd: D(input.thresholdOverrideNzd) } : {}),
  };
}
