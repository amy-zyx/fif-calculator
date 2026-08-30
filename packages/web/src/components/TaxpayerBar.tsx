import {
  activeTaxpayer,
  taxpayerLabel,
  type Workspace,
} from '../state/session';

/**
 * The taxpayer switcher (spec §6).
 *
 * Two people filing separately each have their own NZD 50,000 threshold, so pooling
 * their holdings would silently push one or both into the FIF regime. The isolation is
 * structural — each taxpayer owns a complete, separate session — and this bar exists to
 * make the boundary *visible*, so nobody uploads a spouse's broker export into the
 * wrong person by accident.
 */
export function TaxpayerBar({
  workspace,
  onSwitch,
  onAdd,
  onRemove,
  onCopyFxRates,
}: {
  workspace: Workspace;
  onSwitch: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onCopyFxRates: (sourceId: string) => void;
}) {
  const active = activeTaxpayer(workspace);
  const others = workspace.taxpayers.filter((t) => t.id !== active.id);
  const multiple = workspace.taxpayers.length > 1;

  return (
    <div className="border-b bg-white" data-testid="taxpayer-bar">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-6 py-2 text-sm">
        <span className="text-gray-500">Taxpayer:</span>

        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Taxpayers">
          {workspace.taxpayers.map((taxpayer, i) => {
            const isActive = taxpayer.id === active.id;
            return (
              <button
                key={taxpayer.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSwitch(taxpayer.id)}
                data-testid={`taxpayer-tab-${i}`}
                className={`rounded px-3 py-1 ${
                  isActive ? 'bg-blue-600 text-white' : 'border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {taxpayerLabel(taxpayer, i)}
                {taxpayer.session.accounts.length > 0 && (
                  <span className={isActive ? 'ml-1 opacity-80' : 'ml-1 text-gray-500'}>
                    ({taxpayer.session.accounts.length})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button type="button" onClick={onAdd} className="rounded border px-3 py-1" data-testid="add-taxpayer">
          + Add taxpayer
        </button>

        {multiple && (
          <>
            <button
              type="button"
              onClick={() => onRemove(active.id)}
              className="rounded border border-red-300 px-3 py-1 text-red-700 hover:bg-red-50"
              data-testid="remove-taxpayer"
            >
              Remove this taxpayer
            </button>

            {/* Rates are objective market data, so copying them is safe. Holdings,
                accounts and prices are never copied — that is the pooling this design
                exists to prevent. */}
            <label className="ml-auto flex items-center gap-2 text-gray-600">
              Copy FX rates from
              <select
                aria-label="Copy FX rates from another taxpayer"
                value=""
                onChange={(e) => {
                  if (e.target.value) onCopyFxRates(e.target.value);
                }}
                className="rounded border border-gray-300 px-2 py-1"
              >
                <option value="">choose…</option>
                {others.map((t) => (
                  <option key={t.id} value={t.id}>
                    {taxpayerLabel(t, workspace.taxpayers.indexOf(t))}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>

      {multiple && (
        <p className="mx-auto max-w-5xl px-6 pb-2 text-xs text-gray-500">
          Each taxpayer is calculated completely separately, with their own NZD threshold. Holdings are never
          combined across people.
        </p>
      )}
    </div>
  );
}
