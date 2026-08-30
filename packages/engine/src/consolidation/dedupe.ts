import type { CanonicalTxn } from '../types/canonical-txn';

export interface DuplicateGroup {
  key: string;
  kept: CanonicalTxn;
  removed: CanonicalTxn[];
}

export interface DedupeResult {
  txns: CanonicalTxn[];
  duplicates: DuplicateGroup[];
}

/**
 * Dedupe key from spec §6: the broker's own reference when it has one, otherwise a
 * composite of the trade's identifying facts.
 */
export function dedupeKey(txn: CanonicalTxn): string {
  if (txn.brokerRef) return `ref:${txn.brokerId}:${txn.brokerRef}`;
  return [
    'composite',
    txn.brokerId,
    txn.sourceAccountId,
    txn.tradeDate,
    txn.instrument?.ticker ?? '',
    txn.type,
    txn.quantity?.toString() ?? '',
    txn.pricePerUnit?.toString() ?? '',
  ].join(':');
}

/**
 * Removes transactions that appear more than once — the same trade arriving in both
 * a monthly statement and a full-history export, for example.
 *
 * Never silent: every removal is returned for the "N duplicate rows removed" review
 * panel the spec requires, so the user can see exactly what was dropped.
 */
export function dedupeTxns(txns: readonly CanonicalTxn[]): DedupeResult {
  const seen = new Map<string, CanonicalTxn>();
  const duplicatesByKey = new Map<string, CanonicalTxn[]>();

  for (const txn of txns) {
    const key = dedupeKey(txn);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, txn);
      continue;
    }
    const list = duplicatesByKey.get(key) ?? [];
    list.push(txn);
    duplicatesByKey.set(key, list);
  }

  const duplicates: DuplicateGroup[] = [...duplicatesByKey.entries()].map(([key, removed]) => ({
    key,
    kept: seen.get(key) as CanonicalTxn,
    removed,
  }));

  return { txns: [...seen.values()], duplicates };
}
