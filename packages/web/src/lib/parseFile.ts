import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ParsedFile } from '../adapters/types';

/** Spec §2 Chapter "Vite + React..." stack: papaparse for CSV, SheetJS for xlsx/xls. */
export async function parseUploadedFile(file: File, sourceAccountId: string): Promise<ParsedFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) {
    const text = await file.text();
    return parseCsvText(text, file.name, sourceAccountId);
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    return parseXlsxBuffer(buffer, file.name, sourceAccountId);
  }
  throw new Error(`Unsupported file type: ${file.name}. Expected .csv, .xlsx, or .xls.`);
}

/**
 * Parses raw CSV text into a ParsedFile. Row 0 becomes `headers`; this is a real
 * header row for single-table exports, and just "the first row" for multi-section
 * exports (see ParsedFile doc comment) — adapters for the latter re-scan every row
 * themselves via `allRows()`.
 */
export function parseCsvText(text: string, fileName: string, sourceAccountId: string): ParsedFile {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
  const rows = result.data;
  const [headers, ...rest] = rows;
  return { fileName, headers: headers ?? [], rows: rest, sourceAccountId };
}

export function parseXlsxBuffer(buffer: ArrayBuffer, fileName: string, sourceAccountId: string): ParsedFile {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error(`${fileName}: workbook has no sheets`);
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) throw new Error(`${fileName}: could not read sheet "${firstSheetName}"`);
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' });
  const [headers, ...rest] = rows;
  return { fileName, headers: headers ?? [], rows: rest, sourceAccountId };
}
