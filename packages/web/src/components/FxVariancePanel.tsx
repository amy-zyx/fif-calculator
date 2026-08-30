import { formatNzd, type Decimal, type FifCalculationResult } from '@fif-calculator/engine';

const nz = (d: Decimal | null) => (d === null ? '—' : `NZD ${formatNzd(d)}`);

/**
 * Spec §5.7: both FX policies are always computed, and the variance between them is
 * always shown. "This is cheap to compute and it is the fastest way to catch a
 * mis-parsed rate column."
 *
 * A 0.3–0.8% gap between a broker's dealt rate and IRD's published rate is a normal FX
 * spread, not a bug. A large gap on one transaction, though, usually means that row's
 * rate was parsed in the wrong direction or against the wrong currency — which is why
 * the biggest differences are listed individually rather than only in aggregate.
 */
export function FxVariancePanel({ result }: { result: FifCalculationResult }) {
  const v = result.fxVariance;
  const verdictDiffers = v.inFifPolicyA !== v.inFifPolicyB;

  return (
    <section className="rounded border border-gray-200 p-4" data-testid="fx-variance-panel">
      <h2 className="mb-1 font-semibold">FX variance — policy A vs policy B</h2>
      <p className="mb-3 text-sm text-gray-600">
        Every figure is computed under both IRD rates (A) and broker dealt rates (B), whichever you selected. A
        small gap is a normal FX spread. A large one on a single transaction usually means that row&apos;s rate
        was read in the wrong direction, or against the wrong currency.
      </p>

      {verdictDiffers && (
        <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-900">
          The two policies disagree about whether you are in the FIF regime at all. This is the highest-stakes
          disagreement the tool can produce — resolve it before relying on any figure.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-600">
              <th className="py-1 pr-3" />
              <th className="py-1 pr-3 text-right">Policy A (IRD)</th>
              <th className="py-1 pr-3 text-right">Policy B (broker)</th>
              <th className="py-1 text-right">Difference</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-1 pr-3">Cost basis acquired in year</td>
              <td className="py-1 pr-3 text-right font-mono">{nz(v.costBasisNzdPolicyA)}</td>
              <td className="py-1 pr-3 text-right font-mono">{nz(v.costBasisNzdPolicyB)}</td>
              <td className="py-1 text-right font-mono">
                {nz(v.costBasisNzdPolicyB.minus(v.costBasisNzdPolicyA))}
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-1 pr-3">Peak cost (drives the threshold)</td>
              <td className="py-1 pr-3 text-right font-mono">{nz(v.peakCostNzdPolicyA)}</td>
              <td className="py-1 pr-3 text-right font-mono">{nz(v.peakCostNzdPolicyB)}</td>
              <td className="py-1 text-right font-mono">
                {nz(v.peakCostNzdPolicyB.minus(v.peakCostNzdPolicyA))}
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-1 pr-3">In the FIF regime?</td>
              <td className={`py-1 pr-3 text-right ${verdictDiffers ? 'font-semibold text-red-700' : ''}`}>
                {v.inFifPolicyA ? 'Yes' : 'No'}
              </td>
              <td className={`py-1 pr-3 text-right ${verdictDiffers ? 'font-semibold text-red-700' : ''}`}>
                {v.inFifPolicyB ? 'Yes' : 'No'}
              </td>
              <td className="py-1 text-right">{verdictDiffers ? 'DISAGREE' : 'agree'}</td>
            </tr>
            <tr>
              <td className="py-1 pr-3">FIF income</td>
              <td className="py-1 pr-3 text-right font-mono">{nz(v.fifIncomeNzdPolicyA)}</td>
              <td className="py-1 pr-3 text-right font-mono">{nz(v.fifIncomeNzdPolicyB)}</td>
              <td className="py-1 text-right font-mono">
                {v.fifIncomeNzdPolicyA && v.fifIncomeNzdPolicyB
                  ? nz(v.fifIncomeNzdPolicyB.minus(v.fifIncomeNzdPolicyA))
                  : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {v.topDifferences.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-medium">
            Largest per-transaction differences ({v.topDifferences.length})
          </h3>
          <div className="mt-1 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-600">
                  <th className="py-1 pr-3">Date</th>
                  <th className="py-1 pr-3">Ticker</th>
                  <th className="py-1 pr-3 text-right">Policy A</th>
                  <th className="py-1 pr-3 text-right">Policy B</th>
                  <th className="py-1 text-right">Difference</th>
                </tr>
              </thead>
              <tbody>
                {v.topDifferences.map((line) => (
                  <tr key={line.txnId} className="border-b border-gray-100">
                    <td className="py-1 pr-3">{line.date}</td>
                    <td className="py-1 pr-3">{line.ticker}</td>
                    <td className="py-1 pr-3 text-right font-mono">{formatNzd(line.nzdPolicyA)}</td>
                    <td className="py-1 pr-3 text-right font-mono">{formatNzd(line.nzdPolicyB)}</td>
                    <td className="py-1 text-right font-mono">{formatNzd(line.differenceNzd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-gray-500">
          No per-transaction differences — no broker rate was supplied, so both policies used IRD rates.
        </p>
      )}
    </section>
  );
}
