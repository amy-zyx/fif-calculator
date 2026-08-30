import { z } from 'zod';
import { Decimal } from '../money';
import { TXN_TYPES } from './canonical-txn';

/**
 * zod schema for CanonicalTxn (spec: "zod — schema validation of parsed rows").
 * Broker adapters build a CanonicalTxn directly (with real Decimal instances) and
 * should NOT round-trip through this schema for their own construction — it exists
 * to validate rows coming from a less-trusted source, principally a saved/imported
 * Column Mapping Wizard profile or a re-imported `.fifsession.json`.
 */
const decimalSchema = z.custom<Decimal>((v) => v instanceof Decimal, {
  message: 'expected a Decimal instance — never a plain number (see money.ts)',
});

export const instrumentRefSchema = z.object({
  ticker: z.string().min(1),
  exchange: z.string().nullable(),
  isin: z.string().nullable(),
  name: z.string().nullable(),
  assetClass: z.enum(['EQUITY', 'ETF', 'FUND', 'OPTION', 'BOND', 'CASH', 'OTHER']),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected an ISO date YYYY-MM-DD');

export const canonicalTxnSchema = z.object({
  id: z.string().min(1),
  sourceAccountId: z.string().min(1),
  brokerId: z.enum([
    'IBKR',
    'SHARESIES',
    'TIGER',
    'MOOMOO',
    'HATCH',
    'STAKE',
    'INVESTNOW',
    'ASB_SECURITIES',
    'USER_DEFINED',
  ]),
  brokerRef: z.string().nullable(),

  tradeDate: isoDate,
  settleDate: isoDate.nullable(),
  nzIncomeYear: z.number().int(),

  type: z.enum(TXN_TYPES as [string, ...string[]]),
  instrument: instrumentRefSchema.nullable(),
  quantity: decimalSchema.nullable(),
  pricePerUnit: decimalSchema.nullable(),

  currency: z.string().length(3),
  grossAmount: decimalSchema,
  fees: decimalSchema,
  netAmount: decimalSchema,

  brokerQuotedRate: decimalSchema.nullable(),
  brokerQuoteFrom: z.string().nullable(),
  brokerQuoteTo: z.string().nullable(),
  brokerRateDirectionConfidence: z.enum(['CONFIRMED', 'INFERRED', 'UNKNOWN']),

  fxRateToNzd: decimalSchema.nullable(),
  fxRateSource: z
    .enum(['BROKER_DIRECT', 'BROKER_CHAINED', 'IRD_MID_MONTH', 'IRD_END_MONTH', 'IRD_ROLLING_AVG', 'MANUAL'])
    .nullable(),
  fxResolutionTrace: z.array(z.string()),

  rawRow: z.record(z.string()),
  parseWarnings: z.array(z.string()),
});
