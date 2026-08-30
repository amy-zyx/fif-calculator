import { D, type CanonicalTxn, type InstrumentRef } from '@fif-calculator/engine';
import { nzIncomeYearFor } from '../../lib/nzIncomeYear';
import { allRows, type BrokerAdapter, type ParsedFile, type ParseWarning } from '../types';

const SECTION_NAMES = new Set([
  'Statement',
  'Account Information',
  'Trades',
  'Dividends',
  'Open Positions',
  'Cash Report',
  'Interest',
  'Fees',
]);

/** One row of a multi-section IBKR export, still keyed by its section. */
interface SectionRow {
  section: string;
  discriminator: string; // 'Header' | 'Data' | ...
  cells: string[]; // everything after [section, discriminator]
}

function toSectionRows(file: ParsedFile): SectionRow[] {
  const out: SectionRow[] = [];
  for (const row of allRows(file)) {
    const [section, discriminator, ...cells] = row;
    if (section === undefined || discriminator === undefined) continue;
    if (!SECTION_NAMES.has(section)) continue;
    out.push({ section, discriminator, cells });
  }
  return out;
}

/**
 * Builds column-name -> value maps for every Data row in `section`, using the
 * section's own Header row for column names (spec §4.3: multi-section files must be
 * split on section headers before parsing). Returns [] if the section has no Header
 * row or no Data rows — never guesses column positions.
 */
function readSection(rows: SectionRow[], section: string): Array<Record<string, string>> {
  const headerRow = rows.find((r) => r.section === section && r.discriminator === 'Header');
  if (!headerRow) return [];
  const columns = headerRow.cells;
  return rows
    .filter((r) => r.section === section && r.discriminator === 'Data')
    .map((r) => {
      const record: Record<string, string> = { DataDiscriminator: r.cells[0] ?? '' };
      columns.forEach((col, i) => {
        record[col] = r.cells[i] ?? '';
      });
      return record;
    });
}

function parseTradeDate(raw: string): string {
  // IBKR "Date/Time" cell looks like "2025-06-10, 09:30:00" — exchange-local trade
  // date, per spec §4.3 timezone convention. We store the date component only.
  const datePart = raw.split(',')[0]?.trim();
  return datePart ?? raw.trim();
}

function assetClassFor(ibkrCategory: string): InstrumentRef['assetClass'] {
  switch (ibkrCategory) {
    case 'Stocks':
      return 'EQUITY';
    case 'Equity and Index Options':
      return 'OPTION';
    case 'Bonds':
      return 'BOND';
    default:
      return 'OTHER';
  }
}

function parseTrades(
  rows: SectionRow[],
  file: ParsedFile,
  warnings: ParseWarning[],
): CanonicalTxn[] {
  const trades = readSection(rows, 'Trades');
  const txns: CanonicalTxn[] = [];
  let index = 0;
  for (const row of trades) {
    index += 1;
    // Only individual executions carry a real trade; IBKR statements also emit
    // SubTotal/Total rollup rows in the same section, which must be skipped or
    // every trade would be double-counted.
    if (row.DataDiscriminator !== 'Order') continue;

    const quantityRaw = row['Quantity'];
    const priceRaw = row['T. Price'];
    const proceedsRaw = row['Proceeds'];
    const commRaw = row['Comm/Fee'] ?? '0';
    const symbol = row['Symbol'];
    const currency = row['Currency'];
    const dateRaw = row['Date/Time'];

    if (!quantityRaw || !priceRaw || !proceedsRaw || !symbol || !currency || !dateRaw) {
      warnings.push({
        message: `Trades row ${index}: missing a required field, skipped`,
        severity: 'error',
      });
      continue;
    }

    const signedQuantity = D(quantityRaw);
    const quantity = signedQuantity.abs();
    const fees = D(commRaw).abs();
    const grossAmount = D(proceedsRaw).abs();
    const netAmount = D(proceedsRaw).plus(D(commRaw)).abs();
    const tradeDate = parseTradeDate(dateRaw);

    const instrument: InstrumentRef = {
      ticker: symbol,
      exchange: null,
      isin: null,
      name: null,
      assetClass: assetClassFor(row['Asset Category'] ?? ''),
    };

    txns.push({
      id: `${file.fileName}#trades#${index}`,
      sourceAccountId: file.sourceAccountId,
      brokerId: 'IBKR',
      brokerRef: null,
      tradeDate,
      settleDate: null,
      nzIncomeYear: nzIncomeYearFor(tradeDate),
      type: signedQuantity.isNegative() ? 'SELL' : 'BUY',
      instrument,
      quantity,
      pricePerUnit: D(priceRaw),
      currency,
      grossAmount,
      fees,
      netAmount,
      brokerQuotedRate: null,
      brokerQuoteFrom: null,
      brokerQuoteTo: null,
      brokerRateDirectionConfidence: 'UNKNOWN',
      fxRateToNzd: null,
      fxRateSource: null,
      fxResolutionTrace: [],
      rawRow: row,
      parseWarnings: [],
    });
  }
  return txns;
}

const DIVIDEND_TICKER_PATTERN = /^([A-Z.]+)\(/;

function parseDividends(rows: SectionRow[], file: ParsedFile, warnings: ParseWarning[]): CanonicalTxn[] {
  const dividends = readSection(rows, 'Dividends');
  const txns: CanonicalTxn[] = [];
  let index = 0;
  for (const row of dividends) {
    index += 1;
    const amountRaw = row['Amount'];
    const dateRaw = row['Date'];
    const currency = row['Currency'];
    const description = row['Description'] ?? '';
    const tickerMatch = DIVIDEND_TICKER_PATTERN.exec(description);

    if (!amountRaw || !dateRaw || !currency || !tickerMatch) {
      warnings.push({
        message: `Dividends row ${index}: could not parse ticker/amount/date, skipped`,
        severity: 'error',
      });
      continue;
    }

    const instrument: InstrumentRef = {
      ticker: tickerMatch[1] ?? '',
      exchange: null,
      isin: null,
      name: null,
      assetClass: 'EQUITY',
    };

    txns.push({
      id: `${file.fileName}#dividends#${index}`,
      sourceAccountId: file.sourceAccountId,
      brokerId: 'IBKR',
      brokerRef: null,
      tradeDate: dateRaw,
      settleDate: null,
      nzIncomeYear: nzIncomeYearFor(dateRaw),
      type: 'DIVIDEND',
      instrument,
      quantity: null,
      pricePerUnit: null,
      currency,
      grossAmount: D(amountRaw),
      fees: D(0),
      netAmount: D(amountRaw),
      brokerQuotedRate: null,
      brokerQuoteFrom: null,
      brokerQuoteTo: null,
      brokerRateDirectionConfidence: 'UNKNOWN',
      fxRateToNzd: null,
      fxRateSource: null,
      fxResolutionTrace: [],
      rawRow: row,
      parseWarnings: [],
    });
  }
  return txns;
}

export const ibkrActivityStatementAdapter: BrokerAdapter = {
  id: 'IBKR',
  displayName: 'Interactive Brokers (Activity Statement)',
  // Not yet validated against a real anonymised IBKR export — spec §4.2 point 4.
  // Must stay false, and the UI must show the amber "beta" banner, until that
  // validation happens.
  verified: false,
  fixtures: ['src/adapters/ibkr/fixtures/ibkr-activity-statement.csv'],

  detect(headers, sampleRows) {
    const rows = [headers, ...sampleRows];
    let sectionHits = 0;
    let brokerNameHit = false;
    for (const row of rows) {
      const [section, discriminator] = row;
      if (section && SECTION_NAMES.has(section) && (discriminator === 'Header' || discriminator === 'Data')) {
        sectionHits += 1;
      }
      if (row.some((cell) => cell?.includes('Interactive Brokers'))) {
        brokerNameHit = true;
      }
    }
    if (sectionHits === 0) return 0;
    // Multiple distinct section rows is a strong signal this is IBKR's multi-section
    // format; the literal broker name (when present, e.g. in the Statement section)
    // pushes confidence further but isn't required — some exports omit it.
    let confidence = Math.min(0.5 + sectionHits * 0.05, 0.95);
    if (brokerNameHit) confidence = Math.min(confidence + 0.05, 0.98);
    return confidence;
  },

  parse(file) {
    const warnings: ParseWarning[] = [];
    const sectionRows = toSectionRows(file);
    const txns = [
      ...parseTrades(sectionRows, file, warnings),
      ...parseDividends(sectionRows, file, warnings),
    ];
    if (txns.length === 0) {
      warnings.push({
        message: 'No Trades or Dividends rows recognised in this file — check it is an IBKR Activity Statement CSV.',
        severity: 'error',
      });
    }
    return { txns, warnings };
  },
};
