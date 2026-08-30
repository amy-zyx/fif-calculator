import type { CanonicalTxn } from '../types/canonical-txn';
import { instrumentKey } from '../scope/instrumentKey';

export interface TransferMatchCandidate {
  outTxnId: string;
  inTxnId: string;
  ticker: string;
  quantity: string;
  outDate: string;
  inDate: string;
  dayGap: number;
  /** Both leg ids, for passing to the ledger once the user confirms. */
  txnIds: string[];
}

const MAX_DAY_GAP = 10;

function daysBetween(a: string, b: string): number {
  const ms = Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`));
  return Math.round(ms / 86_400_000);
}

/**
 * Finds candidate inter-broker transfer pairs: a TRANSFER_OUT at one broker that
 * looks like the TRANSFER_IN at another (spec §6).
 *
 * These are only ever CANDIDATES. The user must confirm each one, because getting
 * this wrong silently manufactures a fake quick sale — the transfer would otherwise
 * look like a disposal at one broker and a fresh acquisition at the other, inventing
 * FDR quick sale income out of nothing (see GT-6).
 */
export function findTransferMatches(txns: readonly CanonicalTxn[]): TransferMatchCandidate[] {
  const outs = txns.filter((t) => t.type === 'TRANSFER_OUT' && t.instrument && t.quantity);
  const ins = txns.filter((t) => t.type === 'TRANSFER_IN' && t.instrument && t.quantity);

  const candidates: TransferMatchCandidate[] = [];
  const usedIns = new Set<string>();

  for (const out of outs) {
    const outKey = instrumentKey(out.instrument!);
    const match = ins.find(
      (candidate) =>
        !usedIns.has(candidate.id) &&
        instrumentKey(candidate.instrument!) === outKey &&
        candidate.quantity!.equals(out.quantity!) &&
        daysBetween(out.tradeDate, candidate.tradeDate) <= MAX_DAY_GAP,
    );
    if (!match) continue;

    usedIns.add(match.id);
    candidates.push({
      outTxnId: out.id,
      inTxnId: match.id,
      ticker: out.instrument!.ticker,
      quantity: out.quantity!.toString(),
      outDate: out.tradeDate,
      inDate: match.tradeDate,
      dayGap: daysBetween(out.tradeDate, match.tradeDate),
      txnIds: [out.id, match.id],
    });
  }

  return candidates;
}
