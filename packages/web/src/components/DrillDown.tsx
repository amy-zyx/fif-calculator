import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface DrillDownInput {
  label: string;
  value: string;
  note?: string;
}

/**
 * The working behind a single number on the results screen. Spec §7: every number is
 * clickable and opens a drill-down showing the formula, the inputs, the FX rates, and
 * the source transactions — "the app is not a black box".
 */
export interface DrillDownDetail {
  title: string;
  /** The formula in plain arithmetic, e.g. "0.05 x opening market value". */
  formula: string;
  inputs: DrillDownInput[];
  /** Rule or citation text explaining why the formula is what it is. */
  explanation?: string;
  sourceRows?: Array<Record<string, string>>;
}

interface DrillDownContextValue {
  open: (detail: DrillDownDetail) => void;
  close: () => void;
  active: DrillDownDetail | null;
}

const DrillDownContext = createContext<DrillDownContextValue | null>(null);

export function DrillDownProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<DrillDownDetail | null>(null);
  const value = useMemo<DrillDownContextValue>(
    () => ({ active, open: setActive, close: () => setActive(null) }),
    [active],
  );
  return <DrillDownContext.Provider value={value}>{children}</DrillDownContext.Provider>;
}

function useDrillDown(): DrillDownContextValue {
  const ctx = useContext(DrillDownContext);
  if (!ctx) throw new Error('useDrillDown must be used inside a DrillDownProvider');
  return ctx;
}

/**
 * A number the user can click to see how it was derived. Rendered as a real button so
 * it is reachable by keyboard and announced by screen readers, not just clickable.
 */
export function DrillDownValue({
  value,
  detail,
  className = '',
  emphasis = false,
}: {
  value: string;
  detail: DrillDownDetail;
  className?: string;
  emphasis?: boolean;
}) {
  const { open } = useDrillDown();
  return (
    <button
      type="button"
      onClick={() => open(detail)}
      aria-label={`${detail.title}: ${value}. Show working.`}
      className={`underline decoration-dotted underline-offset-4 hover:decoration-solid focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        emphasis ? 'text-2xl font-semibold' : ''
      } ${className}`}
    >
      {value}
    </button>
  );
}

export function DrillDownPanel() {
  const { active, close } = useDrillDown();
  if (!active) return null;

  return (
    <aside
      role="dialog"
      aria-label={`Working for ${active.title}`}
      className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-gray-300 bg-white p-6 shadow-xl"
      data-testid="drilldown-panel"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold">{active.title}</h2>
        <button type="button" onClick={close} aria-label="Close working" className="text-gray-500 hover:text-black">
          ×
        </button>
      </div>

      <section className="mt-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">Formula</h3>
        <p className="mt-1 rounded bg-gray-50 p-2 font-mono text-sm">{active.formula}</p>
      </section>

      <section className="mt-4">
        <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">Inputs</h3>
        <table className="mt-1 w-full text-sm">
          <tbody>
            {active.inputs.map((input) => (
              <tr key={input.label} className="border-b border-gray-100">
                <td className="py-1 pr-3 text-gray-600">
                  {input.label}
                  {input.note && <span className="block text-xs text-gray-400">{input.note}</span>}
                </td>
                <td className="py-1 text-right font-mono">{input.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {active.explanation && (
        <section className="mt-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">Why</h3>
          <p className="mt-1 text-sm text-gray-700">{active.explanation}</p>
        </section>
      )}

      {active.sourceRows && active.sourceRows.length > 0 && (
        <section className="mt-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Source transactions ({active.sourceRows.length})
          </h3>
          <div className="mt-1 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500">
                  {Object.keys(active.sourceRows[0] ?? {}).map((h) => (
                    <th key={h} className="pr-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {active.sourceRows.map((row, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    {Object.values(row).map((cell, ci) => (
                      <td key={ci} className="pr-2 py-1 font-mono">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </aside>
  );
}
