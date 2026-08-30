import {
  getAlternateDeMinimisThreshold,
  getIncomeYearTaxConfig,
  listSupportedIncomeYears,
  type CostBasisMethod,
  type FxPolicy,
} from '@fif-calculator/engine';
import type { SessionState } from '../state/session';

const FX_POLICY_LABELS: Record<FxPolicy, string> = {
  A: 'A — IRD rates for everything (recommended)',
  B: 'B — broker actual rate where available, IRD elsewhere',
  C: 'C — rolling 12-month average (always IRD)',
};

export function SetupScreen({
  session,
  onChange,
  onNext,
}: {
  session: SessionState;
  onChange: (patch: Partial<SessionState>) => void;
  onNext: () => void;
}) {
  const config = getIncomeYearTaxConfig(session.incomeYear);
  const alternate = getAlternateDeMinimisThreshold(session.incomeYear);

  return (
    <div className="space-y-6" data-testid="setup-screen">
      <header>
        <h1 className="text-xl font-bold">Set up</h1>
        <p className="text-sm text-gray-600">
          These choices must be applied consistently across your whole portfolio, and they appear on every export.
        </p>
      </header>

      <label className="block">
        <span className="text-sm font-medium">Taxpayer name (stored only in your browser)</span>
        <input
          value={session.taxpayerName}
          onChange={(e) => onChange({ taxpayerName: e.target.value })}
          className="mt-1 block w-full max-w-sm rounded border border-gray-300 px-2 py-1"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Income year (year ended 31 March)</span>
        <select
          value={session.incomeYear}
          onChange={(e) => onChange({ incomeYear: Number(e.target.value) })}
          className="mt-1 block rounded border border-gray-300 px-2 py-1"
        >
          {listSupportedIncomeYears().map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>

      <div className="rounded border border-gray-200 p-3 text-sm">
        <p>
          De minimis threshold for {session.incomeYear}:{' '}
          <strong>NZD {config.deMinimisThreshold.amountNzd.toFixed(2)}</strong>{' '}
          <span className="text-gray-500">({config.deMinimisThreshold.status})</span>
        </p>
        {config.deMinimisThreshold.status === 'proposed' && (
          <p className="mt-2 rounded bg-amber-50 px-3 py-2 text-amber-900" data-testid="proposed-threshold-warning">
            This threshold is <strong>proposed, not enacted</strong>. {config.deMinimisThreshold.source}
            {alternate && (
              <>
                {' '}
                The figure under current law is NZD {alternate.amountNzd.toFixed(2)}. Check the position before
                you file — the two can give opposite answers.
              </>
            )}
          </p>
        )}
      </div>

      <fieldset>
        <legend className="text-sm font-medium">FX conversion approach</legend>
        <p className="text-xs text-gray-500">
          IR461 requires one approach applied consistently. Both A and B are always computed so you can see the
          variance, but this is the one your figures use.
        </p>
        {(Object.keys(FX_POLICY_LABELS) as FxPolicy[]).map((policy) => (
          <label key={policy} className="mt-1 block text-sm">
            <input
              type="radio"
              name="fxPolicy"
              value={policy}
              checked={session.fxPolicy === policy}
              onChange={() => onChange({ fxPolicy: policy })}
              className="mr-2"
            />
            {FX_POLICY_LABELS[policy]}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Cost basis for partial disposals</legend>
        {(['AVERAGE', 'FIFO'] as CostBasisMethod[]).map((method) => (
          <label key={method} className="mt-1 block text-sm">
            <input
              type="radio"
              name="costBasis"
              value={method}
              checked={session.costBasisMethod === method}
              onChange={() => onChange({ costBasisMethod: method })}
              className="mr-2"
            />
            {method === 'AVERAGE' ? 'Average cost (default)' : 'FIFO'}
          </label>
        ))}
      </fieldset>

      <button type="button" onClick={onNext} className="rounded bg-blue-600 px-4 py-2 text-white">
        Continue to upload
      </button>
    </div>
  );
}
