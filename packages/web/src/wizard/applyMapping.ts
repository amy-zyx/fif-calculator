import { D, TXN_TYPES, type CanonicalTxn, type InstrumentRef, type TxnType } from '@fif-calculator/engine';
import { nzIncomeYearFor } from '../lib/nzIncomeYear';
import type { ParsedFile, ParseWarning } from '../adapters/types';
import { REQUIRED_FIELD_KEYS, type CanonicalFieldKey } from './canonicalFields';

/** Canonical field -> the source file's column header it was dropped onto. */
export type ColumnMapping = Partial<Record<CanonicalFieldKey, string>>;

/** Raw value found in the mapped `type` column -> the TxnType it means. */
export type TypeValueMap = Record<string, TxnType>;

export function isMappingComplete(mapping: ColumnMapping): boolean {
  return REQUIRED_FIELD_KEYS.every((key) => mapping[key] !== undefined && mapping[key] !== '');
}

/** Distinct raw values seen in the mapped `type` column, for the wizard's type-mapping step. */
export function distinctTypeValues(file: ParsedFile, mapping: ColumnMapping): string[] {
  const header = mapping.type;
  if (!header) return [];
  const colIndex = file.headers.indexOf(header);
  if (colIndex < 0) return [];
  const seen = new Set<string>();
  for (const row of file.rows) {
    const value = row[colIndex];
    if (value) seen.add(value);
  }
  return [...seen].sort();
}

function tryParseDecimal(raw: string | undefined, onError: (msg: string) => void, label: string) {
  if (!raw) return null;
  try {
    return D(raw);
  } catch {
    onError(`Could not parse ${label} "${raw}"`);
    return null;
  }
}

/**
 * Turns a completed Column Mapping Wizard mapping into CanonicalTxns. Deliberately
 * simple for M1 — it does not attempt sign-convention inference, FX resolution, or
 * dedupe (spec §5.7, §6 are M2/M6). It exists so the wizard's live preview and
 * "Continue" step have real, testable output.
 */
export function applyMapping(
  file: ParsedFile,
  mapping: ColumnMapping,
  typeValueMap: TypeValueMap,
  sourceAccountId: string,
): { txns: CanonicalTxn[]; warnings: ParseWarning[] } {
  const warnings: ParseWarning[] = [];
  const colIndex = (key: CanonicalFieldKey): number => {
    const header = mapping[key];
    return header ? file.headers.indexOf(header) : -1;
  };

  const idx: Record<CanonicalFieldKey, number> = {
    tradeDate: colIndex('tradeDate'),
    type: colIndex('type'),
    ticker: colIndex('ticker'),
    currency: colIndex('currency'),
    grossAmount: colIndex('grossAmount'),
    quantity: colIndex('quantity'),
    pricePerUnit: colIndex('pricePerUnit'),
    fees: colIndex('fees'),
    fxRateColumn: colIndex('fxRateColumn'),
  };

  const txns: CanonicalTxn[] = [];

  file.rows.forEach((row, i) => {
    const get = (key: CanonicalFieldKey): string | undefined => {
      const index = idx[key];
      return index >= 0 ? row[index] : undefined;
    };
    const rowWarnings: string[] = [];

    const tradeDateRaw = get('tradeDate');
    const typeRaw = get('type');
    const ticker = get('ticker');
    const currency = get('currency');
    const grossAmountRaw = get('grossAmount');

    if (!tradeDateRaw || !typeRaw || !ticker || !currency || !grossAmountRaw) {
      warnings.push({ message: `Row ${i + 1}: missing a required mapped field, skipped`, rowIndex: i, severity: 'error' });
      return;
    }

    const grossAmount = tryParseDecimal(grossAmountRaw, (m) => warnings.push({ message: `Row ${i + 1}: ${m}, skipped`, rowIndex: i, severity: 'error' }), 'gross amount');
    if (!grossAmount) return;

    let type: TxnType = typeValueMap[typeRaw] ?? 'UNKNOWN';
    if (!TXN_TYPES.includes(type)) type = 'UNKNOWN';
    if (type === 'UNKNOWN') {
      rowWarnings.push(`Raw type value "${typeRaw}" has no mapping — defaulted to UNKNOWN`);
    }

    const quantityRaw = tryParseDecimal(get('quantity'), (m) => rowWarnings.push(m), 'quantity');
    const pricePerUnit = tryParseDecimal(get('pricePerUnit'), (m) => rowWarnings.push(m), 'price per unit');
    const feesRaw = tryParseDecimal(get('fees'), (m) => rowWarnings.push(m), 'fees');
    const brokerQuotedRate = tryParseDecimal(get('fxRateColumn'), (m) => rowWarnings.push(m), 'FX rate');

    const fees = feesRaw ? feesRaw.abs() : D(0);
    const quantity = quantityRaw ? quantityRaw.abs() : null;
    const grossAmountAbs = grossAmount.abs();

    const instrument: InstrumentRef = { ticker, exchange: null, isin: null, name: null, assetClass: 'OTHER' };

    txns.push({
      id: `${file.fileName}#wizard#${i + 1}`,
      sourceAccountId,
      brokerId: 'USER_DEFINED',
      brokerRef: null,
      tradeDate: tradeDateRaw,
      settleDate: null,
      nzIncomeYear: nzIncomeYearFor(tradeDateRaw),
      type,
      instrument,
      quantity,
      pricePerUnit,
      currency,
      grossAmount: grossAmountAbs,
      fees,
      netAmount: grossAmountAbs.plus(fees),
      brokerQuotedRate,
      brokerQuoteFrom: null,
      brokerQuoteTo: null,
      brokerRateDirectionConfidence: 'UNKNOWN',
      fxRateToNzd: null,
      fxRateSource: null,
      fxResolutionTrace: [],
      rawRow: Object.fromEntries(file.headers.map((h, hi) => [h, row[hi] ?? ''])),
      parseWarnings: rowWarnings,
    });
  });

  return { txns, warnings };
}
