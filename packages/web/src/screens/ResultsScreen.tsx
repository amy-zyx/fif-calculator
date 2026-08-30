import {
  filingSentence,
  formatNzd,
  type Decimal,
  type ElectionResult,
  type FifCalculationResult,
  type HoldingYearSummary,
} from '@fif-calculator/engine';
import { DrillDownValue, type DrillDownDetail } from '../components/DrillDown';
import { FxVariancePanel } from '../components/FxVariancePanel';
import { downloadPdfSummary } from '../export/pdfSummary';
import { downloadSessionFile } from '../export/sessionFile';
import { downloadWorkingPaper } from '../export/workingPaper';
import type { SessionState } from '../state/session';

const nz = (d: Decimal) => `NZD ${formatNzd(d)}`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-gray-200 p-4">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Spec §5.2: the verdict, the peak day, and by how much it was exceeded. */
function DeMinimisCard({ result }: { result: Extract<FifCalculationResult, { status: 'OK' | 'NOT_IN_FIF' }> }) {
  const { deMinimis } = result;
  const detail: DrillDownDetail = {
    title: 'De minimis test',
    formula: 'peak total NZD cost of attributing interests held, at any point in the year  vs  threshold',
    inputs: [
      { label: 'Peak cost', value: nz(deMinimis.peakCostNzd) },
      { label: 'Peak occurred on', value: deMinimis.peakCostDate },
      { label: 'Threshold', value: nz(deMinimis.thresholdUsed), note: `status: ${deMinimis.thresholdStatus}` },
      { label: 'Margin', value: nz(deMinimis.marginNzd) },
    ],
    explanation:
      'The test is on original COST in NZD of interests you HELD, measured at every point in the year — not ' +
      'market value, and not cumulative purchases. If the threshold is exceeded on any single day, FIF applies ' +
      'to your whole portfolio for the whole year, including the first NZD 50,000.',
    sourceRows: deMinimis.timeline.map((p) => ({
      Date: p.date,
      'Running cost NZD': formatNzd(p.totalCostNzd),
      What: p.note,
    })),
  };

  return (
    <Section title="1. Are you in the FIF regime?">
      {deMinimis.thresholdStatus === 'proposed' && (
        <p className="mb-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
          The threshold used for this year is <strong>proposed, not enacted</strong>. Confirm the position before
          you file.
        </p>
      )}
      <p className="text-lg">
        {deMinimis.inFif ? (
          <>
            <strong className="text-amber-800">Yes — the FIF rules apply.</strong> Your holdings cost peaked at{' '}
            <DrillDownValue value={nz(deMinimis.peakCostNzd)} detail={detail} /> on {deMinimis.peakCostDate},
            which is {nz(deMinimis.marginNzd)} over the {nz(deMinimis.thresholdUsed)} threshold.
          </>
        ) : (
          <>
            <strong className="text-green-800">No — you are under the threshold.</strong> Your holdings cost
            peaked at <DrillDownValue value={nz(deMinimis.peakCostNzd)} detail={detail} /> on{' '}
            {deMinimis.peakCostDate}, below the {nz(deMinimis.thresholdUsed)} threshold.
          </>
        )}
      </p>
      {deMinimis.inFif && (
        <p className="mt-2 text-sm text-gray-600">
          Because the threshold was exceeded on at least one day, the whole portfolio is in scope for the whole
          year — including the first {nz(deMinimis.thresholdUsed)}.
        </p>
      )}
    </Section>
  );
}

/** Spec §5.5: the side-by-side comparison and the recommended (lower) figure. */
function MethodComparison({ election }: { election: ElectionResult }) {
  const fdrDetail: DrillDownDetail = {
    title: 'FDR portfolio total',
    formula: 'sum over interests of  max(0,  0.05 x opening market value  +  quick sale adjustment)',
    inputs: election.perHoldingFdr.map((h) => ({
      label: h.ticker,
      value: formatNzd(h.incomeNzd),
      note: `5% of ${formatNzd(h.openingMarketValueNzd)} opening${
        h.quickSale.applies ? ` + quick sale ${formatNzd(h.quickSale.adjustmentNzd)}` : ''
      }`,
    })),
    explanation:
      'Under FDR, dividends from FIF interests are not separately taxable — FDR replaces them. Shares bought ' +
      'during the year and still held at year end contribute nothing, because they were not in the opening value.',
  };

  const cvDetail: DrillDownDetail = {
    title: 'Comparative Value portfolio total',
    formula: '(closing market value + gains) - (opening market value + costs),  portfolio total floored at 0',
    inputs: [
      ...election.perHoldingCv.map((h) => ({ label: h.ticker, value: formatNzd(h.incomeNzd) })),
      { label: 'Portfolio total before floor', value: formatNzd(election.cvRawTotalNzd) },
      { label: 'After floor', value: formatNzd(election.cvTotalNzd) },
    ],
    explanation:
      'The CV portfolio total cannot be less than zero. A loss is reduced to nil — it is not carried forward ' +
      'and cannot be offset against your other income.',
  };

  return (
    <Section title="2. FDR vs Comparative Value">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={`rounded border p-3 ${election.recommendedMethod === 'FDR' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
          <h3 className="text-sm font-medium">Fair Dividend Rate (FDR) 公平股息率法</h3>
          <p className="mt-1">
            <DrillDownValue value={nz(election.fdrTotalNzd)} detail={fdrDetail} emphasis />
          </p>
        </div>
        <div className={`rounded border p-3 ${election.recommendedMethod === 'CV' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
          <h3 className="text-sm font-medium">Comparative Value (CV) 比较价值法</h3>
          <p className="mt-1">
            <DrillDownValue value={nz(election.cvTotalNzd)} detail={cvDetail} emphasis />
          </p>
          {election.cvLossExtinguished && (
            <p className="mt-1 text-xs text-gray-600">
              Raw total was {nz(election.cvRawTotalNzd)} — a loss, reduced to nil.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 rounded bg-gray-50 p-3">
        <p className="text-sm text-gray-600">Recommended (the lower of the two)</p>
        <p className="text-xl font-semibold">
          {election.recommendedMethod} — {nz(election.recommendedIncomeNzd)}
        </p>
        <p className="mt-1 text-sm text-gray-700">{election.explanation}</p>
      </div>
    </Section>
  );
}

function HoldingsTable({ election, holdings }: { election: ElectionResult; holdings: HoldingYearSummary[] }) {
  const inScope = holdings.filter((h) => h.scope.inScope);

  return (
    <Section title="3. Per-holding breakdown">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-600">
              <th className="py-1 pr-3">Holding</th>
              <th className="py-1 pr-3 text-right">Opening MV</th>
              <th className="py-1 pr-3 text-right">Closing MV</th>
              <th className="py-1 pr-3 text-right">FDR</th>
              <th className="py-1 pr-3 text-right">CV</th>
            </tr>
          </thead>
          <tbody>
            {inScope.map((h) => {
              const fdr = election.perHoldingFdr.find((f) => f.key === h.key);
              const cv = election.perHoldingCv.find((c) => c.key === h.key);
              return (
                <tr key={h.key} className="border-b border-gray-100">
                  <td className="py-1 pr-3">
                    {h.ticker}
                    {h.scope.lowConfidenceIdentity && (
                      <span
                        className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-800"
                        title="Matched on ticker alone — confirm this is the right instrument"
                      >
                        low confidence
                      </span>
                    )}
                  </td>
                  <td className="py-1 pr-3 text-right font-mono">{formatNzd(h.openingMarketValueNzd)}</td>
                  <td className="py-1 pr-3 text-right font-mono">{formatNzd(h.closingMarketValueNzd)}</td>
                  <td className="py-1 pr-3 text-right font-mono">
                    {fdr ? (
                      <DrillDownValue
                        value={formatNzd(fdr.incomeNzd)}
                        detail={{
                          title: `${h.ticker} — FDR working`,
                          formula: 'max(0,  0.05 x opening market value  +  quick sale adjustment)',
                          inputs: [
                            { label: 'Opening market value', value: formatNzd(fdr.openingMarketValueNzd) },
                            { label: 'Base FDR (5%)', value: formatNzd(fdr.baseFdrNzd) },
                            { label: 'Quick sale applies', value: fdr.quickSale.applies ? 'yes' : 'no' },
                            ...(fdr.quickSale.applies
                              ? [
                                  { label: 'Peak quantity', value: fdr.quickSale.peakQuantity.toString() },
                                  { label: 'Opening quantity', value: fdr.quickSale.openingQuantity.toString() },
                                  { label: 'Closing quantity', value: fdr.quickSale.closingQuantity.toString() },
                                  {
                                    label: 'Peak holding differential',
                                    value: fdr.quickSale.peakHoldingDifferential.toString(),
                                  },
                                  { label: 'Average cost of shares acquired', value: formatNzd(fdr.quickSale.averageCostNzd) },
                                  {
                                    label: '(a) Peak holding amount',
                                    value: formatNzd(fdr.quickSale.peakHoldingAmountNzd),
                                  },
                                  { label: '(b) Actual quick sale gains', value: formatNzd(fdr.quickSale.quickSaleGainsNzd) },
                                  {
                                    label: 'Adjustment = lesser of (a) and (b)',
                                    value: formatNzd(fdr.quickSale.adjustmentNzd),
                                    note: `binding branch: ${fdr.quickSale.bindingBranch}`,
                                  },
                                ]
                              : []),
                            { label: 'FDR income', value: formatNzd(fdr.incomeNzd) },
                          ],
                          explanation: [
                            'A quick sale is shares acquired and disposed of within the same income year. The ' +
                              'adjustment is the LESSER of the peak holding method amount and the actual gains.',
                            ...fdr.quickSale.notes,
                          ].join(' '),
                        }}
                      />
                    ) : (
                      <span className="text-gray-400" title="FDR is unavailable for this interest">
                        n/a
                      </span>
                    )}
                  </td>
                  <td className="py-1 pr-3 text-right font-mono">
                    {cv && (
                      <DrillDownValue
                        value={formatNzd(cv.incomeNzd)}
                        detail={{
                          title: `${h.ticker} — Comparative Value working`,
                          formula: '(closing market value + gains) - (opening market value + costs)',
                          inputs: [
                            { label: 'Closing market value', value: formatNzd(cv.closingMarketValueNzd) },
                            { label: 'Gains (proceeds + dividends)', value: formatNzd(cv.gainsNzd) },
                            { label: 'Opening market value', value: formatNzd(cv.openingMarketValueNzd) },
                            { label: 'Costs (purchases + brokerage)', value: formatNzd(cv.costsNzd) },
                            { label: 'CV income', value: formatNzd(cv.incomeNzd) },
                          ],
                          explanation:
                            'A negative figure here is not floored at the holding level — the floor is applied ' +
                            'to the portfolio total, so one holding’s loss can offset another’s gain in the same year.',
                        }}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function ForeignTaxCredits({ result }: { result: Extract<FifCalculationResult, { status: 'OK' }> }) {
  const { foreignTaxCredits: ftc } = result;
  if (ftc.lines.length === 0) return null;
  return (
    <Section title="4. Foreign tax credits">
      <table className="w-full text-sm">
        <tbody>
          {ftc.lines.map((l) => (
            <tr key={l.ticker} className="border-b border-gray-100">
              <td className="py-1">{l.ticker}</td>
              <td className="py-1 text-right font-mono">{formatNzd(l.grossWithholdingNzd)}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="py-1">Total gross</td>
            <td className="py-1 text-right font-mono">{formatNzd(ftc.totalGrossNzd)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs text-gray-600">{ftc.note}</p>
    </Section>
  );
}

function ExcludedPanel({ result }: { result: FifCalculationResult }) {
  if (result.excluded.length === 0) return null;
  return (
    <Section title="Not included in FIF — may be taxable under other rules">
      <p className="mb-2 text-sm text-gray-600">
        These were excluded from the FIF calculation. That does <strong>not</strong> mean they are tax-free.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-600">
            <th className="py-1 pr-3">Instrument</th>
            <th className="py-1 pr-3">Type</th>
            <th className="py-1">Why excluded</th>
          </tr>
        </thead>
        <tbody>
          {result.excluded.map((e) => (
            <tr key={e.txnId} className="border-b border-gray-100">
              <td className="py-1 pr-3">{e.ticker}</td>
              <td className="py-1 pr-3">{e.type}</td>
              <td className="py-1 text-gray-700">{e.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

export function ResultsScreen({
  result,
  session,
  onBack,
}: {
  result: FifCalculationResult;
  session: SessionState;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6" data-testid="results-screen">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">
            FIF result — year ended 31 March {session.incomeYear}
          </h1>
          <p className="text-sm text-gray-600">
            FX policy {session.fxPolicy} · cost basis {session.costBasisMethod}
            {session.taxpayerName ? ` · ${session.taxpayerName}` : ''}
          </p>
        </div>
        <button type="button" onClick={onBack} className="rounded border px-3 py-1 text-sm">
          Back
        </button>
      </header>

      {result.status === 'BLOCKED' && (
        <Section title="Calculation blocked">
          <p className="text-sm text-gray-700">
            The calculation cannot continue until these are resolved. A missing price or rate is never treated as
            zero.
          </p>
          <ul className="mt-2 space-y-1 text-sm" data-testid="blockers">
            {result.blockers.map((b, i) => (
              <li key={i} className="rounded bg-red-50 px-3 py-2 text-red-900">
                <strong>{b.kind}</strong> — {b.message}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {result.status === 'THRESHOLD_AMBIGUOUS' && (
        <Section title="Your FX policy changes the answer">
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-900" data-testid="threshold-ambiguous">
            {result.message}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded border p-3">
              <p className="text-sm text-gray-600">Policy A — IRD rates</p>
              <p className="font-mono">{nz(result.deMinimisPolicyA.peakCostNzd)}</p>
              <p className="text-sm">{result.deMinimisPolicyA.inFif ? 'In FIF' : 'Not in FIF'}</p>
            </div>
            <div className="rounded border p-3">
              <p className="text-sm text-gray-600">Policy B — broker dealt rates</p>
              <p className="font-mono">{nz(result.deMinimisPolicyB.peakCostNzd)}</p>
              <p className="text-sm">{result.deMinimisPolicyB.inFif ? 'In FIF' : 'Not in FIF'}</p>
            </div>
          </div>
        </Section>
      )}

      {(result.status === 'OK' || result.status === 'NOT_IN_FIF') && <DeMinimisCard result={result} />}

      {result.status === 'NOT_IN_FIF' && (
        <Section title="What this means">
          <p className="text-sm text-gray-700">
            You are under the de minimis threshold, so the FIF rules do not apply to you for this year. Dividends
            and other income from these investments may still be taxable under ordinary rules — check with your
            accountant.
          </p>
        </Section>
      )}

      {result.status === 'OK' && (
        <>
          <MethodComparison election={result.election} />
          <HoldingsTable election={result.election} holdings={result.holdings} />
          <ForeignTaxCredits result={result} />
        </>
      )}

      <ExcludedPanel result={result} />

      <FxVariancePanel result={result} />

      <Section title="Export">
        <p className="mb-3 text-sm text-gray-600">
          The working paper is the accountant-facing document: one tab per section, with every figure traceable
          back to the transactions and rates behind it.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => downloadWorkingPaper(result, session)}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white"
          >
            Working paper (.xlsx)
          </button>
          <button
            type="button"
            onClick={() => downloadPdfSummary(result, session)}
            className="rounded border px-4 py-2 text-sm"
          >
            Summary (.pdf)
          </button>
          <button
            type="button"
            onClick={() => downloadSessionFile(result, session)}
            className="rounded border px-4 py-2 text-sm"
          >
            Carry forward to next year (.fifsession.json)
          </button>
        </div>
        <p className="mt-3 text-sm text-gray-700">{filingSentence(session.incomeYear)}</p>
      </Section>

      <p className="border-t pt-4 text-xs text-gray-500">
        This tool provides an estimate only and is not tax advice. FIF calculations depend on facts and elections
        specific to you. Verify all figures against IRD guide IR461 and confirm with a chartered accountant before
        filing. The authors accept no liability.
      </p>
    </div>
  );
}
