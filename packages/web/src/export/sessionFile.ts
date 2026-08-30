import { formatNzd, type FifCalculationResult } from '@fif-calculator/engine';
import type { ManualOpeningHolding, SessionState } from '../state/session';

export const SESSION_FILE_VERSION = 1;

/**
 * The carry-forward file (spec §8.5, §6). This year's closing values become next
 * year's PROPOSED opening values — proposed, not automatic, because the user must
 * still confirm them and because a closing market value is not the same thing as an
 * original cost.
 */
export interface FifSessionFile {
  version: number;
  exportedAt: string;
  incomeYear: number;
  taxpayerName: string;
  fxPolicy: SessionState['fxPolicy'];
  costBasisMethod: SessionState['costBasisMethod'];
  /** Opening holdings proposed for the FOLLOWING income year. */
  proposedOpeningHoldings: ManualOpeningHolding[];
  /** What was declared this year, for the record. */
  declared: {
    status: string;
    method: string | null;
    incomeNzd: string | null;
  };
  note: string;
}

const CARRY_FORWARD_NOTE =
  'Opening holdings here are PROPOSED for the following income year, derived from this year’s closing ' +
  'position. Confirm each one before relying on it. Note in particular that `costNzd` is carried forward as ' +
  'the ORIGINAL cost of the holding, not its closing market value — the de minimis test is on cost, and ' +
  'substituting market value would silently change the threshold verdict.';

export function buildSessionFile(result: FifCalculationResult, session: SessionState): FifSessionFile {
  const proposedOpeningHoldings: ManualOpeningHolding[] = [];

  if (result.status === 'OK') {
    for (const holding of result.holdings) {
      if (!holding.scope.inScope) continue;
      if (holding.closingQuantity.isZero()) continue;
      proposedOpeningHoldings.push({
        ticker: holding.ticker,
        exchange: null,
        quantity: holding.closingQuantity.toString(),
        // Closing MARKET price per unit, back-solved from the closing market value, and
        // expressed in NZD — so it is carried with currency NZD, for which the engine
        // uses an identity conversion. This is the opening MARKET value input.
        marketPricePerUnit: holding.closingMarketValueNzd.dividedBy(holding.closingQuantity).toFixed(6),
        currency: 'NZD',
        // The remaining COST basis — deliberately not the market value above. These two
        // are different numbers doing different jobs: cost drives the de minimis test,
        // market value drives FDR. Conflating them silently changes the threshold verdict.
        costNzd: holding.closingCostNzd.toFixed(2),
      });
    }
  }

  return {
    version: SESSION_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    incomeYear: session.incomeYear,
    taxpayerName: session.taxpayerName,
    fxPolicy: session.fxPolicy,
    costBasisMethod: session.costBasisMethod,
    proposedOpeningHoldings,
    declared: {
      status: result.status,
      method: result.status === 'OK' ? result.election.recommendedMethod : null,
      incomeNzd: result.status === 'OK' ? formatNzd(result.election.recommendedIncomeNzd) : null,
    },
    note: CARRY_FORWARD_NOTE,
  };
}

export function parseSessionFile(json: string): FifSessionFile {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Not valid JSON');
  }
  if (typeof data !== 'object' || data === null) throw new Error('Malformed session file');
  const candidate = data as Partial<FifSessionFile>;
  if (candidate.version !== SESSION_FILE_VERSION) {
    throw new Error(`Unsupported session file version: ${String(candidate.version)}`);
  }
  if (!Array.isArray(candidate.proposedOpeningHoldings)) {
    throw new Error('Malformed session file: missing proposedOpeningHoldings');
  }
  return candidate as FifSessionFile;
}

export function downloadSessionFile(result: FifCalculationResult, session: SessionState): void {
  const file = buildSessionFile(result, session);
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fif-${session.incomeYear}.fifsession.json`;
  a.click();
  URL.revokeObjectURL(url);
}
