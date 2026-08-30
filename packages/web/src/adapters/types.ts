import type { BrokerId, CanonicalTxn } from '@fif-calculator/engine';

/**
 * A file after the raw CSV/XLSX bytes have been split into rows, but before any
 * broker-specific interpretation. `headers` is row 0; `rows` is everything after.
 * For a well-formed single-table export this is a real header row. For a
 * multi-section export (e.g. IBKR Activity Statements, spec §4.3) it's just the
 * first row of the file — one signal among several an adapter's `detect()` can use —
 * and the adapter's `parse()` re-scans `allRows(file)` itself to find section
 * boundaries rather than trusting `headers` as THE header row.
 */
export interface ParsedFile {
  fileName: string;
  headers: string[];
  rows: string[][];
  sourceAccountId: string;
}

export function allRows(file: ParsedFile): string[][] {
  return [file.headers, ...file.rows];
}

export interface ParseWarning {
  message: string;
  rowIndex?: number;
  severity: 'info' | 'warning' | 'error';
}

/** Spec §4.1. */
export interface BrokerAdapter {
  id: BrokerId;
  displayName: string;
  /**
   * Whether this adapter has been validated against a real anonymised export
   * (spec §4.2 point 4). The UI must show an amber "beta" banner while this is
   * false — never claim confidence the adapter hasn't earned.
   */
  verified: boolean;
  /** 0..1 confidence this file was produced by this broker/report type. */
  detect(headers: string[], sampleRows: string[][]): number;
  parse(file: ParsedFile): { txns: CanonicalTxn[]; warnings: ParseWarning[] };
  /** Paths to anonymised sample files used by this adapter's own tests. */
  fixtures: string[];
}

/** Below this confidence, fall back to the Column Mapping Wizard (spec §4.2 point 2). */
export const DETECTION_THRESHOLD = 0.8;
