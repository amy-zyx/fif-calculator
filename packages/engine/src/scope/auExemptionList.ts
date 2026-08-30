/**
 * Australian listed share exemption (spec §5.1 step 2).
 *
 * TODO(verify) — VERIFY-ANNUALLY.md item 4. Before relying on this for an income
 * year, a human must re-check:
 *   1. That the exemption's statutory conditions are still as summarised below.
 *   2. Every entry in the list, against the taxpayer's own records and the current
 *      approved ASX index membership as at the relevant date.
 *
 * The exemption broadly covers an interest in a company that is resident in
 * Australia, is listed on an approved ASX index, is not a stapled security, and is
 * required to maintain an imputation credit account. The precise statutory wording
 * is deliberately NOT restated or derived here — this list is a convenience, never
 * an authority, and the UI must say so.
 *
 * Per spec: "Implement this as a maintained list with an 'as at' date, plus a manual
 * override per holding, plus a prominent 'verify this against your own records'
 * note. Do not attempt to derive it live."
 */

export interface AuExemptionList {
  /** The date this list's membership was last checked by a human. */
  asAt: string;
  source: string;
  /** ASX tickers believed to meet the exemption conditions as at `asAt`. */
  tickers: readonly string[];
}

export const AU_EXEMPTION_LIST: AuExemptionList = {
  asAt: '2026-08-30',
  source:
    'Placeholder — NOT yet populated from an authoritative source. Must be filled in and ' +
    'verified by a human before launch (VERIFY-ANNUALLY.md item 4).',
  tickers: [],
};

export function isAuExempt(ticker: string, exchange: string | null, list = AU_EXEMPTION_LIST): boolean {
  if (exchange && exchange.toUpperCase() !== 'ASX') return false;
  return list.tickers.includes(ticker.toUpperCase());
}
