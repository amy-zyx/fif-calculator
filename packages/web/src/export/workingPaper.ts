import { filingSentence, getIncomeYearTaxConfig, type FifCalculationResult } from '@fif-calculator/engine';
import * as XLSX from 'xlsx';
import { allTxns, type SessionState } from '../state/session';

export const DISCLAIMER =
  'This tool provides an estimate only and is not tax advice. FIF calculations depend on facts and elections ' +
  'specific to you. Verify all figures against IRD guide IR461 and confirm with a chartered accountant before ' +
  'filing. The authors accept no liability.';

type Row = (string | number)[];

/**
 * The accountant-facing deliverable (spec §8.2) — one tab per section, every figure
 * traceable back to the transactions and rates that produced it.
 *
 * Built with SheetJS, which is already a dependency for reading broker .xlsx exports,
 * rather than adding exceljs for the write path alone.
 *
 * Amounts are written as NUMBERS, not preformatted strings, so an accountant can total
 * and re-check a column in Excel. They are rounded to cents at this boundary — the last
 * possible moment — having been carried at full Decimal precision through the engine.
 */
export function buildWorkingPaper(result: FifCalculationResult, session: SessionState): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const config = getIncomeYearTaxConfig(session.incomeYear);
  const money = (d: { toFixed: (n: number) => string }) => Number(d.toFixed(2));

  const addSheet = (name: string, rows: Row[]) => {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  };

  // --- Summary ------------------------------------------------------------
  const summary: Row[] = [
    ['NZ FIF working paper'],
    [],
    ['Taxpayer', session.taxpayerName || '(not given)'],
    ['Income year', `Year ended 31 March ${session.incomeYear}`],
    ['Period', `${config.startDate} to ${config.endDate}`],
    ['FX approach', `Policy ${session.fxPolicy}`],
    ['Cost basis', session.costBasisMethod],
    ['Generated', new Date().toISOString().slice(0, 10)],
    ['Result status', result.status],
    [],
  ];

  if (result.status === 'OK' || result.status === 'NOT_IN_FIF') {
    summary.push(
      ['De minimis threshold', money(result.deMinimis.thresholdUsed), result.deMinimis.thresholdStatus],
      ['Peak cost of holdings NZD', money(result.deMinimis.peakCostNzd)],
      ['Peak occurred on', result.deMinimis.peakCostDate],
      ['In the FIF regime?', result.deMinimis.inFif ? 'YES' : 'NO'],
      [],
    );
  }

  if (result.status === 'OK') {
    summary.push(
      ['FDR portfolio total NZD', money(result.election.fdrTotalNzd)],
      ['CV portfolio total NZD', money(result.election.cvTotalNzd)],
      ['CV total before the zero floor NZD', money(result.election.cvRawTotalNzd)],
      ['Recommended method', result.election.recommendedMethod],
      ['FIF INCOME TO DECLARE NZD', money(result.election.recommendedIncomeNzd)],
      [],
      ['Why', result.election.explanation],
      [],
      ['Filing', filingSentence(session.incomeYear)],
    );
  } else if (result.status === 'THRESHOLD_AMBIGUOUS') {
    summary.push(
      ['BLOCKED — the FX policy changes whether you are in the FIF regime at all'],
      [result.message],
      ['Peak cost under policy A (IRD) NZD', money(result.deMinimisPolicyA.peakCostNzd)],
      ['Peak cost under policy B (broker) NZD', money(result.deMinimisPolicyB.peakCostNzd)],
    );
  } else if (result.status === 'BLOCKED') {
    summary.push(['BLOCKED — see the Assumptions & warnings tab. No FIF figure was produced.']);
  }

  summary.push([], [DISCLAIMER]);
  addSheet('Summary', summary);

  // --- De minimis timeline ------------------------------------------------
  if (result.status === 'OK' || result.status === 'NOT_IN_FIF') {
    addSheet('De minimis timeline', [
      ['The test is on COST of interests HELD at each point in the year — not market value,'],
      ['and not cumulative purchases. Exceeding on any single day brings the whole portfolio in.'],
      [],
      ['Date', 'Running total cost NZD', 'What changed'],
      ...result.deMinimis.timeline.map((p): Row => [p.date, money(p.totalCostNzd), p.note]),
    ]);
  }

  // --- Per-holding FDR and the quick sale workings ------------------------
  if (result.status === 'OK') {
    addSheet('Per-holding FDR', [
      ['FDR income = max(0,  0.05 x opening market value  +  quick sale adjustment)'],
      [],
      ['Holding', 'Opening market value NZD', 'Base FDR (5%) NZD', 'Quick sale adj NZD', 'FDR income NZD'],
      ...result.election.perHoldingFdr.map((h): Row => [
        h.ticker,
        money(h.openingMarketValueNzd),
        money(h.baseFdrNzd),
        money(h.quickSale.adjustmentNzd),
        money(h.incomeNzd),
      ]),
      [],
      ['Total', '', '', '', money(result.election.fdrTotalNzd)],
    ]);

    const quickSaleRows: Row[] = [
      ['A quick sale is shares acquired AND disposed of within the same income year.'],
      ['The adjustment is the LESSER of (a) the peak holding method amount and (b) the actual gains.'],
      [],
      [
        'Holding',
        'Opening qty',
        'Peak qty',
        'Closing qty',
        'Peak holding differential',
        'Avg cost of shares acquired NZD',
        '(a) Peak holding amount NZD',
        '(b) Actual quick sale gains NZD',
        'Binding branch',
        'Adjustment NZD',
      ],
    ];
    for (const h of result.election.perHoldingFdr) {
      const q = h.quickSale;
      if (!q.applies) continue;
      quickSaleRows.push([
        h.ticker,
        Number(q.openingQuantity.toString()),
        Number(q.peakQuantity.toString()),
        Number(q.closingQuantity.toString()),
        Number(q.peakHoldingDifferential.toString()),
        money(q.averageCostNzd),
        money(q.peakHoldingAmountNzd),
        money(q.quickSaleGainsNzd),
        q.bindingBranch,
        money(q.adjustmentNzd),
      ]);
    }
    const notes = result.election.perHoldingFdr.flatMap((h) =>
      h.quickSale.notes.map((n): Row => [h.ticker, n]),
    );
    if (notes.length > 0) quickSaleRows.push([], ['Notes'], ...notes);
    addSheet('Quick sale workings', quickSaleRows);

    addSheet('Per-holding CV', [
      ['CV income = (closing market value + gains) - (opening market value + costs)'],
      ['The portfolio total is floored at zero; individual holdings are not.'],
      [],
      ['Holding', 'Closing MV NZD', 'Gains NZD', 'Opening MV NZD', 'Costs NZD', 'CV income NZD'],
      ...result.election.perHoldingCv.map((h): Row => [
        h.ticker,
        money(h.closingMarketValueNzd),
        money(h.gainsNzd),
        money(h.openingMarketValueNzd),
        money(h.costsNzd),
        money(h.incomeNzd),
      ]),
      [],
      ['Total before floor', '', '', '', '', money(result.election.cvRawTotalNzd)],
      ['Total after floor', '', '', '', '', money(result.election.cvTotalNzd)],
    ]);

    // --- Foreign tax credits ---------------------------------------------
    addSheet('Foreign tax credits', [
      ['Holding', 'Gross foreign withholding tax NZD'],
      ...result.foreignTaxCredits.lines.map((l): Row => [l.ticker, money(l.grossWithholdingNzd)]),
      [],
      ['Total gross', money(result.foreignTaxCredits.totalGrossNzd)],
      [],
      [result.foreignTaxCredits.note],
    ]);
  }

  // --- FX rates supplied --------------------------------------------------
  addSheet('FX rates', [
    ['Rates are in IRD convention: units of foreign currency per 1 NZD.'],
    ['So NZD = foreign amount / rate. These are the rates supplied for this calculation.'],
    [],
    ['Currency', 'Date', 'Rate (foreign per NZD)'],
    ...Object.entries(session.fxRates)
      .filter(([, v]) => v.trim() !== '')
      .map(([key, value]): Row => {
        const [currency, date] = key.split('|');
        return [currency ?? '', date ?? '', Number(value)];
      })
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1]))),
  ]);

  // --- All transactions, with the verbatim source row ---------------------
  const txns = allTxns(session);
  const rawKeys = [...new Set(txns.flatMap((t) => Object.keys(t.rawRow)))];
  addSheet('All transactions', [
    ['Every transaction as imported, with its verbatim source row for audit.'],
    [],
    ['Date', 'Type', 'Ticker', 'Exchange', 'Currency', 'Quantity', 'Price', 'Gross', 'Fees', 'Broker', 'Source file row →', ...rawKeys],
    ...txns.map((t): Row => [
      t.tradeDate,
      t.type,
      t.instrument?.ticker ?? '',
      t.instrument?.exchange ?? '',
      t.currency,
      t.quantity ? Number(t.quantity.toString()) : '',
      t.pricePerUnit ? Number(t.pricePerUnit.toString()) : '',
      Number(t.grossAmount.toFixed(2)),
      Number(t.fees.toFixed(2)),
      t.brokerId,
      '',
      ...rawKeys.map((k) => t.rawRow[k] ?? ''),
    ]),
  ]);

  // --- Assumptions & warnings ---------------------------------------------
  const assumptions: Row[] = [
    ['Assumptions, warnings and excluded items'],
    [],
    ['FX approach', `Policy ${session.fxPolicy}`],
    ['Cost basis for partial disposals', session.costBasisMethod],
    ['De minimis threshold status', config.deMinimisThreshold.status],
    ['Threshold source', config.deMinimisThreshold.source],
    [],
  ];
  if (result.blockers.length > 0) {
    assumptions.push(['BLOCKERS — no figure can be relied on until these are resolved'], ['Kind', 'Message']);
    for (const b of result.blockers) assumptions.push([b.kind, b.message]);
    assumptions.push([]);
  }
  if (result.warnings.length > 0) {
    assumptions.push(['Warnings'], ...result.warnings.map((w): Row => [w]), []);
  }
  if (result.duplicatesRemoved.length > 0) {
    assumptions.push(
      ['Duplicate rows removed'],
      ...result.duplicatesRemoved.map((g): Row => [g.key, `${g.removed.length} removed`]),
      [],
    );
  }
  if (result.excluded.length > 0) {
    assumptions.push(
      ['Excluded from FIF — NOT necessarily tax free'],
      ['Instrument', 'Type', 'Reason'],
      ...result.excluded.map((e): Row => [e.ticker, e.type, e.reason]),
      [],
    );
  }
  assumptions.push([DISCLAIMER]);
  addSheet('Assumptions & warnings', assumptions);

  return wb;
}

export function downloadWorkingPaper(result: FifCalculationResult, session: SessionState): void {
  const wb = buildWorkingPaper(result, session);
  const name = `fif-working-paper-${session.incomeYear}${
    session.taxpayerName ? `-${session.taxpayerName.replace(/\s+/g, '-')}` : ''
  }.xlsx`;
  XLSX.writeFile(wb, name);
}
