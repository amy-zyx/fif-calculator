import { dedupeTxns, findTransferMatches } from '@fif-calculator/engine';
import { useMemo } from 'react';
import { allTxns, type SessionState } from '../state/session';

/**
 * Spec §7 step 4: nothing proceeds until warnings are triaged.
 *
 * Deduplication and transfer matching are pure transaction operations — they need no
 * prices or FX rates — so they run here, before the Prices step, and the user resolves
 * them while the source rows are still fresh in mind.
 */
export function ReviewScreen({
  session,
  onChange,
  onNext,
  onBack,
}: {
  session: SessionState;
  onChange: (patch: Partial<SessionState>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const txns = useMemo(() => allTxns(session), [session]);
  const { txns: deduped, duplicates } = useMemo(() => dedupeTxns(txns), [txns]);
  const transferCandidates = useMemo(() => findTransferMatches(deduped), [deduped]);

  const parseErrors = session.accounts.flatMap((a) =>
    a.warnings.filter((w) => w.severity === 'error').map((w) => ({ file: a.fileName, message: w.message })),
  );

  const undecidedTransfers = transferCandidates.filter(
    (c) => !c.txnIds.every((id) => session.confirmedTransferTxnIds.includes(id)),
  );

  const lowConfidence = deduped.filter((t) => t.instrument && !t.instrument.isin && !t.instrument.exchange);

  function confirmTransfer(txnIds: string[]) {
    onChange({
      confirmedTransferTxnIds: [...new Set([...session.confirmedTransferTxnIds, ...txnIds])],
    });
  }

  return (
    <div className="space-y-6" data-testid="review-screen">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">Review your data</h1>
          <p className="text-sm text-gray-600">
            {deduped.length} transactions across {session.accounts.length} file
            {session.accounts.length === 1 ? '' : 's'}.
          </p>
        </div>
        <button type="button" onClick={onBack} className="rounded border px-3 py-1 text-sm">
          Back
        </button>
      </header>

      {duplicates.length > 0 && (
        <section className="rounded border border-gray-200 p-4" data-testid="duplicates-panel">
          <h2 className="font-semibold">
            {duplicates.reduce((n, g) => n + g.removed.length, 0)} duplicate row
            {duplicates.reduce((n, g) => n + g.removed.length, 0) === 1 ? '' : 's'} removed
          </h2>
          <p className="text-sm text-gray-600">
            The same trade appeared in more than one file. One copy was kept — nothing was removed silently.
          </p>
          <ul className="mt-2 text-sm">
            {duplicates.map((g) => (
              <li key={g.key} className="font-mono text-xs text-gray-700">
                {g.kept.instrument?.ticker} {g.kept.type} {g.kept.tradeDate} — kept 1, removed {g.removed.length}
              </li>
            ))}
          </ul>
        </section>
      )}

      {transferCandidates.length > 0 && (
        <section className="rounded border border-amber-300 bg-amber-50 p-4" data-testid="transfers-panel">
          <h2 className="font-semibold">Possible transfers between your own accounts</h2>
          <p className="text-sm text-amber-900">
            Confirm each of these. If a transfer is treated as a sale and a repurchase, the calculation will
            invent a quick sale that never happened.
          </p>
          <ul className="mt-2 space-y-2">
            {transferCandidates.map((c) => {
              const confirmed = c.txnIds.every((id) => session.confirmedTransferTxnIds.includes(id));
              return (
                <li key={`${c.outTxnId}:${c.inTxnId}`} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    {c.quantity} {c.ticker} out on {c.outDate}, in on {c.inDate} ({c.dayGap} day gap)
                  </span>
                  {confirmed ? (
                    <span className="text-green-800">✓ confirmed as my own transfer</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => confirmTransfer(c.txnIds)}
                      className="rounded bg-amber-600 px-3 py-1 text-white"
                    >
                      Yes, this is my own transfer
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {parseErrors.length > 0 && (
        <section className="rounded border border-red-300 bg-red-50 p-4">
          <h2 className="font-semibold text-red-900">Rows that could not be parsed</h2>
          <ul className="mt-1 text-sm text-red-900">
            {parseErrors.map((e, i) => (
              <li key={i}>
                {e.file}: {e.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {lowConfidence.length > 0 && (
        <section className="rounded border border-gray-200 p-4">
          <h2 className="font-semibold">Instruments matched on ticker alone</h2>
          <p className="text-sm text-gray-600">
            These have no ISIN or exchange, so they are matched by ticker only. Check they are what you expect —
            a US <span className="font-mono">AAPL</span> and an ASX <span className="font-mono">AAP</span> must
            never be merged.
          </p>
          <p className="mt-1 font-mono text-xs text-gray-700">
            {[...new Set(lowConfidence.map((t) => t.instrument?.ticker))].join(', ')}
          </p>
        </section>
      )}

      <section className="rounded border border-gray-200 p-4">
        <h2 className="mb-2 font-semibold">Transactions</h2>
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b text-left text-gray-600">
                <th className="py-1 pr-3">Date</th>
                <th className="py-1 pr-3">Type</th>
                <th className="py-1 pr-3">Ticker</th>
                <th className="py-1 pr-3">Ccy</th>
                <th className="py-1 pr-3 text-right">Gross</th>
                <th className="py-1 pr-3 text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {deduped.map((t) => (
                <tr key={t.id} className="border-b border-gray-100">
                  <td className="py-1 pr-3">{t.tradeDate}</td>
                  <td className="py-1 pr-3">{t.type}</td>
                  <td className="py-1 pr-3">{t.instrument?.ticker ?? '—'}</td>
                  <td className="py-1 pr-3">{t.currency}</td>
                  <td className="py-1 pr-3 text-right font-mono">{t.grossAmount.toString()}</td>
                  <td className="py-1 pr-3 text-right font-mono">{t.quantity?.toString() ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {undecidedTransfers.length > 0 && (
        <p className="text-sm text-amber-800" data-testid="review-gate-message">
          Confirm the {undecidedTransfers.length} possible transfer
          {undecidedTransfers.length === 1 ? '' : 's'} above before continuing.
        </p>
      )}

      <button
        type="button"
        onClick={onNext}
        disabled={undecidedTransfers.length > 0}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        Continue to prices
      </button>
    </div>
  );
}
