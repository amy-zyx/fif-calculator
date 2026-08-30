import { filingSentence, formatNzd, type FifCalculationResult } from '@fif-calculator/engine';
import { jsPDF } from 'jspdf';
import type { SessionState } from '../state/session';
import { DISCLAIMER } from './workingPaper';

/**
 * The 1–2 page summary for the user's own records (spec §8.3). Deliberately short: the
 * detail lives in the xlsx working paper, and this exists so there is something to file
 * away alongside the return.
 */
export function buildPdfSummary(result: FifCalculationResult, session: SessionState): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;

  const line = (text: string, size = 10, bold = false, gap = 14) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    for (const wrapped of doc.splitTextToSize(text, width) as string[]) {
      if (y > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(wrapped, margin, y);
      y += gap;
    }
  };

  line('NZ FIF income summary', 16, true, 22);
  line(`Year ended 31 March ${session.incomeYear}`, 11, false, 18);
  if (session.taxpayerName) line(session.taxpayerName, 11, false, 18);
  y += 6;

  if (result.status === 'OK') {
    line('FIF income to declare', 11, true);
    line(`NZD ${formatNzd(result.election.recommendedIncomeNzd)}`, 22, true, 28);
    line(`Method: ${result.election.recommendedMethod}`, 10);
    y += 6;

    line('How this compares', 11, true);
    line(`Fair Dividend Rate (FDR): NZD ${formatNzd(result.election.fdrTotalNzd)}`);
    line(`Comparative Value (CV): NZD ${formatNzd(result.election.cvTotalNzd)}`);
    if (result.election.cvLossExtinguished) {
      line(
        `CV before the zero floor was NZD ${formatNzd(result.election.cvRawTotalNzd)} — a loss, reduced to nil. ` +
          'It is not carried forward and cannot offset your other income.',
      );
    }
    y += 6;

    line('De minimis', 11, true);
    line(
      `Peak cost of holdings was NZD ${formatNzd(result.deMinimis.peakCostNzd)} on ${result.deMinimis.peakCostDate}, ` +
        `against a threshold of NZD ${formatNzd(result.deMinimis.thresholdUsed)} (${result.deMinimis.thresholdStatus}).`,
    );
    y += 6;

    line('Holdings', 11, true);
    for (const h of result.holdings.filter((x) => x.scope.inScope)) {
      const fdr = result.election.perHoldingFdr.find((f) => f.key === h.key);
      const cv = result.election.perHoldingCv.find((c) => c.key === h.key);
      line(
        `${h.ticker} — opening NZD ${formatNzd(h.openingMarketValueNzd)}, closing NZD ${formatNzd(h.closingMarketValueNzd)}, ` +
          `FDR ${fdr ? formatNzd(fdr.incomeNzd) : 'n/a'}, CV ${cv ? formatNzd(cv.incomeNzd) : 'n/a'}`,
        9,
      );
    }

    if (result.foreignTaxCredits.lines.length > 0) {
      y += 6;
      line('Foreign tax credits', 11, true);
      line(
        `Gross foreign withholding tax: NZD ${formatNzd(result.foreignTaxCredits.totalGrossNzd)}. ` +
          'The claimable amount is capped and is not computed here.',
        9,
      );
    }
  } else if (result.status === 'NOT_IN_FIF') {
    line('You are under the de minimis threshold', 13, true, 20);
    line(
      `Peak cost of holdings was NZD ${formatNzd(result.deMinimis.peakCostNzd)} on ${result.deMinimis.peakCostDate}, ` +
        `below the NZD ${formatNzd(result.deMinimis.thresholdUsed)} threshold, so the FIF rules do not apply to ` +
        'you for this year. Income from these investments may still be taxable under ordinary rules.',
    );
  } else {
    line('No FIF figure was produced', 13, true, 20);
    line(
      result.status === 'THRESHOLD_AMBIGUOUS'
        ? result.message
        : 'The calculation was blocked. See the working paper for what needs resolving.',
    );
  }

  y += 10;
  line('Basis of preparation', 11, true);
  line(`FX approach: policy ${session.fxPolicy}. Cost basis: ${session.costBasisMethod}.`, 9);
  line(filingSentence(session.incomeYear), 9);

  y += 10;
  line(DISCLAIMER, 8, false, 11);

  return doc;
}

export function downloadPdfSummary(result: FifCalculationResult, session: SessionState): void {
  buildPdfSummary(result, session).save(`fif-summary-${session.incomeYear}.pdf`);
}
