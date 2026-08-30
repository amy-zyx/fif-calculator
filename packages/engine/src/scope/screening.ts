import type { InstrumentRef, TxnType } from '../types/canonical-txn';
import { isAuExempt, type AuExemptionList, AU_EXEMPTION_LIST } from './auExemptionList';
import { instrumentIdentity } from './instrumentKey';

export type ExclusionReason =
  | 'NZ_RESIDENT'
  | 'AU_LISTED_EXEMPTION'
  | 'OPTION_CONTRACT'
  | 'CASH_OR_NON_EQUITY'
  | 'USER_OVERRIDE';

/** A per-holding manual override, per spec §5.1 step 2 and §5.5. */
export interface ScopeOverride {
  /** Force in or out of FIF scope, overriding the automatic screening. */
  inScope: boolean;
  reason: string;
  /**
   * Marks an interest for which FDR is unavailable (non-ordinary shares,
   * fixed-rate foreign equity, non-participating redeemable shares — spec §5.5).
   * These are routed to CV and calculated separately from the election set.
   */
  fdrUnavailable?: boolean;
}

export interface ScopeDecision {
  key: string;
  ticker: string;
  inScope: boolean;
  reason: ExclusionReason | null;
  note: string;
  lowConfidenceIdentity: boolean;
  fdrUnavailable: boolean;
}

const NZ_EXCHANGES = new Set(['NZX', 'NZSX', 'NZAX']);

/**
 * Transaction types that are option contracts in their own right. An option is not
 * an attributing FIF interest, so these are excluded from FIF entirely — but they
 * are surfaced in a separate panel rather than hidden, because premium income is
 * generally taxable under other rules (spec §5.1 step 3).
 */
export const OPTION_TXN_TYPES: ReadonlySet<TxnType> = new Set(['OPTION_TRADE', 'OPTION_EXPIRY']);

/**
 * Runs the scope screening of spec §5.1 in order, recording the reason for every
 * exclusion. Note the deliberate asymmetry: an OPTION_ASSIGNMENT is NOT excluded,
 * because an assigned put creates a real share acquisition at the strike price.
 */
export function screenInstrument(
  ref: InstrumentRef,
  override?: ScopeOverride,
  auList: AuExemptionList = AU_EXEMPTION_LIST,
): ScopeDecision {
  const identity = instrumentIdentity(ref);
  const base = {
    key: identity.key,
    ticker: ref.ticker,
    lowConfidenceIdentity: identity.lowConfidence,
    fdrUnavailable: override?.fdrUnavailable ?? false,
  };

  if (override) {
    return {
      ...base,
      inScope: override.inScope,
      reason: override.inScope ? null : 'USER_OVERRIDE',
      note: override.reason,
    };
  }

  // 1. NZ-resident companies / NZ funds / PIEs are not FIF interests.
  if (ref.exchange && NZ_EXCHANGES.has(ref.exchange.toUpperCase())) {
    return {
      ...base,
      inScope: false,
      reason: 'NZ_RESIDENT',
      note: 'Listed on a New Zealand exchange — not a foreign investment fund interest.',
    };
  }

  // 2. Australian listed share exemption.
  if (isAuExempt(ref.ticker, ref.exchange, auList)) {
    return {
      ...base,
      inScope: false,
      reason: 'AU_LISTED_EXEMPTION',
      note:
        `Treated as covered by the Australian listed share exemption (list as at ${auList.asAt}). ` +
        'Verify this against your own records.',
    };
  }

  // 3. Option contracts are not attributing FIF interests.
  if (ref.assetClass === 'OPTION') {
    return {
      ...base,
      inScope: false,
      reason: 'OPTION_CONTRACT',
      note:
        'An option is not an attributing FIF interest. Not included in FIF — but premium income ' +
        'may be taxable under other rules. Seek advice.',
    };
  }

  if (ref.assetClass === 'CASH') {
    return {
      ...base,
      inScope: false,
      reason: 'CASH_OR_NON_EQUITY',
      note: 'Cash balance — not an attributing FIF interest.',
    };
  }

  // 4. Everything else foreign is an attributing interest.
  return { ...base, inScope: true, reason: null, note: 'Foreign attributing FIF interest.' };
}
