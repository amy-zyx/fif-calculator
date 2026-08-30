import type { Decimal } from '../money';

/** Spec §3.2. */
export type TxnType =
  | 'BUY'
  | 'SELL'
  | 'DIVIDEND'
  | 'DIVIDEND_WITHHOLDING_TAX'
  | 'DRIP'
  | 'SPLIT'
  | 'MERGER'
  | 'SPINOFF'
  | 'RETURN_OF_CAPITAL'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'FX_CONVERSION'
  | 'FEE'
  | 'INTEREST'
  | 'OPTION_TRADE'
  | 'OPTION_ASSIGNMENT'
  | 'OPTION_EXPIRY'
  | 'UNKNOWN';

export const TXN_TYPES: readonly TxnType[] = [
  'BUY',
  'SELL',
  'DIVIDEND',
  'DIVIDEND_WITHHOLDING_TAX',
  'DRIP',
  'SPLIT',
  'MERGER',
  'SPINOFF',
  'RETURN_OF_CAPITAL',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'FX_CONVERSION',
  'FEE',
  'INTEREST',
  'OPTION_TRADE',
  'OPTION_ASSIGNMENT',
  'OPTION_EXPIRY',
  'UNKNOWN',
];

export type AssetClass = 'EQUITY' | 'ETF' | 'FUND' | 'OPTION' | 'BOND' | 'CASH' | 'OTHER';

export type BrokerId =
  | 'IBKR'
  | 'SHARESIES'
  | 'TIGER'
  | 'MOOMOO'
  | 'HATCH'
  | 'STAKE'
  | 'INVESTNOW'
  | 'ASB_SECURITIES'
  | 'USER_DEFINED';

export type FxRateSource =
  | 'BROKER_DIRECT'
  | 'BROKER_CHAINED'
  | 'IRD_MID_MONTH'
  | 'IRD_END_MONTH'
  | 'IRD_ROLLING_AVG'
  | 'MANUAL';

export type FxDirectionConfidence = 'CONFIRMED' | 'INFERRED' | 'UNKNOWN';

export interface InstrumentRef {
  ticker: string;
  exchange: string | null;
  isin: string | null;
  name: string | null;
  assetClass: AssetClass;
}

/** Spec §3.2. Every broker adapter normalises to exactly this shape. */
export interface CanonicalTxn {
  id: string;
  sourceAccountId: string;
  brokerId: BrokerId;
  brokerRef: string | null;

  tradeDate: string; // ISO date, exchange-local calendar — see spec §4.3 timezone rule
  settleDate: string | null;
  nzIncomeYear: number;

  type: TxnType;
  instrument: InstrumentRef | null;
  quantity: Decimal | null; // always positive; direction comes from `type`
  pricePerUnit: Decimal | null;

  currency: string; // ISO 4217 of the trade
  grossAmount: Decimal;
  fees: Decimal;
  netAmount: Decimal;

  // FX — see engine FX resolver (M2, spec §5.7). Never assume a broker's rate column
  // converts to NZD; capture it verbatim and uninterpreted here.
  brokerQuotedRate: Decimal | null;
  brokerQuoteFrom: string | null;
  brokerQuoteTo: string | null;
  brokerRateDirectionConfidence: FxDirectionConfidence;

  fxRateToNzd: Decimal | null;
  fxRateSource: FxRateSource | null;
  fxResolutionTrace: string[];

  rawRow: Record<string, string>;
  parseWarnings: string[];
}
