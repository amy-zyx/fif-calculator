import { getIncomeYearTaxConfig, type IrdRateTable } from '@fif-calculator/engine';
import { z } from 'zod';
import fx2026 from './ird-fx/2026.json';
import fx2027 from './ird-fx/2027.json';

/**
 * The bundled IRD rate dataset (spec §2 — "IRD FX rates have no public API").
 *
 * The datasets currently ship EMPTY. No rate in this repo has been transcribed from
 * IRD, because inventing plausible-looking exchange rates would produce authoritative-
 * looking tax figures that are wrong. `packages/web/src/data/ird-fx/README.md` has the
 * refresh procedure; until someone completes it, the app uses manual entry, which is
 * fully functional and is not a degraded mode.
 */
export const irdDatasetSchema = z.object({
  incomeYear: z.number().int(),
  sourceUrl: z.string().url(),
  retrievedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  retrievedBy: z.string().nullable(),
  note: z.string(),
  // Rates as decimal STRINGS. A JSON number is a float, and this codebase does no float
  // arithmetic on money or rates.
  rates: z.record(z.record(z.string().regex(/^\d+(\.\d+)?$/))),
});

export type IrdDataset = z.infer<typeof irdDatasetSchema>;

const RAW_DATASETS: unknown[] = [fx2026, fx2027];

export function loadIrdDatasets(): IrdDataset[] {
  return RAW_DATASETS.map((raw) => irdDatasetSchema.parse(raw));
}

export function getIrdDataset(incomeYear: number): IrdDataset | null {
  return loadIrdDatasets().find((d) => d.incomeYear === incomeYear) ?? null;
}

/** True when the bundled dataset actually carries rates for this year. */
export function hasBundledRates(incomeYear: number): boolean {
  const dataset = getIrdDataset(incomeYear);
  if (!dataset) return false;
  return Object.values(dataset.rates).some((byDate) => Object.keys(byDate).length > 0);
}

/**
 * The bundled rates in the shape the engine's TableIrdRateProvider consumes. Returns an
 * empty table when nothing is bundled — the caller then relies on manual entry, and a
 * genuinely missing rate still blocks the calculation rather than defaulting to zero.
 */
export function bundledRateTable(incomeYear: number): IrdRateTable {
  const dataset = getIrdDataset(incomeYear);
  if (!dataset) return {};
  const table: IrdRateTable = {};
  for (const [currency, byDate] of Object.entries(dataset.rates)) {
    table[currency] = { ...byDate };
  }
  return table;
}

/**
 * Every bundled rate must fall inside the income year it claims to cover. A rate filed
 * under the wrong year would silently be picked up by the provider's carry-forward
 * lookup and applied to dates it was never published for.
 */
export function datasetDateProblems(dataset: IrdDataset): string[] {
  const config = getIncomeYearTaxConfig(dataset.incomeYear);
  const problems: string[] = [];
  for (const [currency, byDate] of Object.entries(dataset.rates)) {
    for (const date of Object.keys(byDate)) {
      if (date < config.startDate || date > config.endDate) {
        problems.push(
          `${currency} ${date} is outside the ${dataset.incomeYear} income year (${config.startDate} to ${config.endDate}).`,
        );
      }
    }
  }
  return problems;
}
