import { instrumentKey, screenInstrument, type InstrumentRef } from '@fif-calculator/engine';
import { useMemo } from 'react';
import { allTxns, type SessionState } from '../state/session';

type Choice = 'AUTO' | 'IN' | 'OUT';

function choiceFor(session: SessionState, key: string): Choice {
  const override = session.scopeOverrides[key];
  if (!override) return 'AUTO';
  return override.inScope ? 'IN' : 'OUT';
}

/**
 * Per-holding scope and treatment overrides (spec §5.1 step 2, §5.5).
 *
 * Two judgements the engine cannot make on its own live here:
 *
 *  - **The Australian listed share exemption.** Whether a holding qualifies depends on
 *    the company's residence, its index membership, whether it is stapled, and whether
 *    it maintains an imputation credit account. The bundled list is empty and the spec
 *    is explicit that it must not be derived live, so the user has to say.
 *  - **Whether FDR is unavailable** for the interest (non-ordinary shares, fixed-rate
 *    foreign equity, non-participating redeemable shares). Those are routed to CV and
 *    calculated separately from the FDR/CV election set.
 *
 * Both default to AUTO — the engine's own screening — so nothing changes unless the
 * user deliberately asserts something the app cannot know.
 */
export function ScopeOverrides({
  session,
  onChange,
}: {
  session: SessionState;
  onChange: (patch: Partial<SessionState>) => void;
}) {
  const instruments = useMemo(() => {
    const byKey = new Map<string, InstrumentRef>();
    for (const txn of allTxns(session)) {
      if (txn.instrument) byKey.set(instrumentKey(txn.instrument), txn.instrument);
    }
    for (const holding of session.openingHoldings) {
      if (!holding.ticker.trim()) continue;
      const ref: InstrumentRef = {
        ticker: holding.ticker,
        exchange: holding.exchange,
        isin: null,
        name: null,
        assetClass: 'EQUITY',
      };
      const key = instrumentKey(ref);
      if (!byKey.has(key)) byKey.set(key, ref);
    }
    return [...byKey.entries()].sort((a, b) => a[1].ticker.localeCompare(b[1].ticker));
  }, [session]);

  if (instruments.length === 0) return null;

  function setChoice(key: string, ref: InstrumentRef, choice: Choice) {
    const next = { ...session.scopeOverrides };
    if (choice === 'AUTO') {
      delete next[key];
    } else {
      next[key] = {
        inScope: choice === 'IN',
        reason:
          choice === 'OUT'
            ? `You marked ${ref.ticker} as outside the FIF rules (e.g. the Australian listed share exemption).`
            : `You marked ${ref.ticker} as an attributing FIF interest.`,
        ...(next[key]?.fdrUnavailable ? { fdrUnavailable: true } : {}),
      };
    }
    onChange({ scopeOverrides: next });
  }

  function setFdrUnavailable(key: string, ref: InstrumentRef, value: boolean) {
    const existing = session.scopeOverrides[key];
    const next = { ...session.scopeOverrides };
    next[key] = {
      inScope: existing?.inScope ?? true,
      reason: existing?.reason ?? `Treatment set manually for ${ref.ticker}.`,
      ...(value ? { fdrUnavailable: true } : {}),
    };
    if (!value && !existing) delete next[key];
    onChange({ scopeOverrides: next });
  }

  return (
    <section className="rounded border border-gray-200 p-4" data-testid="scope-overrides">
      <h2 className="font-semibold">Holding treatment</h2>
      <p className="text-sm text-gray-600">
        Leave these on <strong>Auto</strong> unless you know something the app cannot. The Australian listed
        share exemption in particular depends on facts about the company that are not in your broker export —
        the bundled exemption list is empty, so nothing is treated as exempt automatically.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-600">
              <th className="py-1 pr-3">Holding</th>
              <th className="py-1 pr-3">Automatic screening</th>
              <th className="py-1 pr-3">In FIF scope</th>
              <th className="py-1">FDR unavailable</th>
            </tr>
          </thead>
          <tbody>
            {instruments.map(([key, ref]) => {
              const auto = screenInstrument(ref);
              const choice = choiceFor(session, key);
              return (
                <tr key={key} className="border-b border-gray-100">
                  <td className="py-1 pr-3">
                    {ref.ticker}
                    {ref.exchange && <span className="text-gray-500"> · {ref.exchange}</span>}
                  </td>
                  <td className="py-1 pr-3 text-gray-600">
                    {auto.inScope ? 'In scope' : `Excluded — ${auto.reason}`}
                  </td>
                  <td className="py-1 pr-3">
                    <select
                      aria-label={`FIF scope for ${ref.ticker}`}
                      value={choice}
                      onChange={(e) => setChoice(key, ref, e.target.value as Choice)}
                      className="rounded border border-gray-300 px-2 py-1"
                    >
                      <option value="AUTO">Auto</option>
                      <option value="IN">Force in scope</option>
                      <option value="OUT">Force out (e.g. AU exemption)</option>
                    </select>
                  </td>
                  <td className="py-1">
                    <input
                      type="checkbox"
                      aria-label={`FDR unavailable for ${ref.ticker}`}
                      checked={session.scopeOverrides[key]?.fdrUnavailable ?? false}
                      onChange={(e) => setFdrUnavailable(key, ref, e.target.checked)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-gray-500">
        &ldquo;FDR unavailable&rdquo; covers non-ordinary shares, fixed-rate foreign equity and
        non-participating redeemable shares. Those interests are always valued under Comparative Value, separately
        from the FDR/CV choice you make for the rest of the portfolio.
      </p>
    </section>
  );
}
