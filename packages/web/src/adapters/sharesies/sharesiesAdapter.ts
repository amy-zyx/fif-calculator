import { D, ZERO, type CanonicalTxn, type InstrumentRef, type TxnType } from '@fif-calculator/engine';
import { nzIncomeYearFor } from '../../lib/nzIncomeYear';
import { allRows, type BrokerAdapter, type ParseWarning } from '../types';

/**
 * Sharesies transaction report CSV.
 *
 * Validated against a real export. Structurally this is the simplest format so far —
 * one row per trade, each with its own Trade ID — but it carries one serious trap.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE TIMEZONE TRAP — spec §4.3, and it is live in real data.
 * ─────────────────────────────────────────────────────────────────────────────
 * Every timestamp is stamped UTC. For NZX that is routinely the WRONG DATE: NZ is
 * UTC+12/+13, so a real row at "2025-05-08 22:58 (UTC)" happened on 9 May in Auckland,
 * and most NZX rows in a real report sit between 21:00 and 23:30 UTC — all a day
 * earlier than they actually were.
 *
 * At the year boundary this changes which TAX YEAR a trade belongs to: a trade at
 * "2026-03-31 21:00 (UTC)" on NZX is 1 April 2026 locally, i.e. the NEXT income year.
 * Taking the UTC date would file it against the wrong return.
 *
 * So the date is converted to the exchange's own local calendar before use.
 */

export const EXPECTED_HEADERS = [
  'Trade ID',
  'Trade date',
  'Instrument code',
  'Instrument name',
  'Market code',
  'Quantity',
  'Price',
  'Transaction type',
  'Currency',
  'Amount',
  'Transaction fee',
  'Transaction method',
] as const;

/**
 * Exchange -> IANA timezone. Deliberately explicit: an unknown market must not silently
 * fall back to UTC, because that is precisely the bug this table exists to prevent.
 */
const EXCHANGE_TIMEZONES: Record<string, string> = {
  NZX: 'Pacific/Auckland',
  ASX: 'Australia/Sydney',
  NYSE: 'America/New_York',
  NASDAQ: 'America/New_York',
  AMEX: 'America/New_York',
  NYSEARCA: 'America/New_York',
  CBOE: 'America/Chicago',
};

/** "2025-05-08 22:58:37.637288 (UTC)" -> a real instant, or null. */
export function parseSharesiesTimestamp(raw: string): Date | null {
  const cleaned = raw.replace(/\s*\(UTC\)\s*$/i, '').trim();
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?$/.exec(cleaned);
  if (!match) return null;
  const instant = new Date(`${match[1]}T${match[2]}${match[3] ?? ''}Z`);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

/**
 * The trade date in the EXCHANGE's local calendar. Returns null for an exchange whose
 * timezone is unknown, so the caller can warn rather than quietly use the UTC date.
 */
export function exchangeLocalDate(instant: Date, marketCode: string): string | null {
  const timeZone = EXCHANGE_TIMEZONES[marketCode.toUpperCase()];
  if (!timeZone) return null;
  // en-CA formats as YYYY-MM-DD, which is the ISO form used throughout the engine.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

function toDecimalOr(raw: string | undefined, fallback = ZERO) {
  const cleaned = (raw ?? '').replace(/,/g, '').trim();
  if (cleaned === '') return fallback;
  try {
    return D(cleaned);
  } catch {
    return fallback;
  }
}

function txnTypeFor(transactionType: string): TxnType {
  switch (transactionType.toUpperCase()) {
    case 'BUY':
      return 'BUY';
    case 'SELL':
      return 'SELL';
    default:
      return 'UNKNOWN';
  }
}

export const sharesiesTransactionReportAdapter: BrokerAdapter = {
  id: 'SHARESIES',
  displayName: 'Sharesies (transaction report)',
  // Validated against a real export.
  verified: true,
  fixtures: ['src/adapters/sharesies/fixtures/sharesies-transaction-report.csv'],

  detect(headers) {
    const present = new Set(headers.map((h) => h.trim()));
    const hits = EXPECTED_HEADERS.filter((h) => present.has(h)).length;
    if (hits < 6) return 0;
    // A single-table CSV, so the header row alone is the whole signature.
    return Math.min(0.5 + (hits / EXPECTED_HEADERS.length) * 0.49, 0.99);
  },

  parse(file) {
    const warnings: ParseWarning[] = [];
    const txns: CanonicalTxn[] = [];
    const rows = allRows(file);
    const header = rows[0];
    if (!header) return { txns, warnings };

    const col: Record<string, number> = {};
    header.forEach((name, i) => {
      const key = name.trim();
      if (key && !(key in col)) col[key] = i;
    });

    const at = (row: string[], name: string): string => {
      const i = col[name];
      return i === undefined ? '' : (row[i] ?? '').trim();
    };

    let shiftedDates = 0;

    rows.slice(1).forEach((row, i) => {
      if (row.length === 0 || row.every((c) => c.trim() === '')) return;

      const tradeId = at(row, 'Trade ID');
      const ticker = at(row, 'Instrument code');
      const marketCode = at(row, 'Market code');
      const rawTimestamp = at(row, 'Trade date');
      const currency = at(row, 'Currency').toUpperCase();
      const transactionType = at(row, 'Transaction type');
      const method = at(row, 'Transaction method');

      const instant = parseSharesiesTimestamp(rawTimestamp);
      if (!ticker || !currency || !instant) {
        warnings.push({
          message: `Row ${i + 1}: missing an instrument code, currency or trade date — skipped.`,
          rowIndex: i,
          severity: 'error',
        });
        return;
      }

      const localDate = exchangeLocalDate(instant, marketCode);
      const utcDate = instant.toISOString().slice(0, 10);
      if (!localDate) {
        warnings.push({
          message:
            `Row ${i + 1}: market code "${marketCode}" is not recognised, so the trade date could not be ` +
            'converted from UTC to the exchange’s local date. Check this row by hand — near 31 March it can ' +
            'change which tax year the trade falls in.',
          rowIndex: i,
          severity: 'error',
        });
        return;
      }
      if (localDate !== utcDate) shiftedDates += 1;

      const rowWarnings: string[] = [];
      const type = txnTypeFor(transactionType);
      if (type === 'UNKNOWN') {
        rowWarnings.push(`Unrecognised transaction type "${transactionType}".`);
      }
      // A PORTFOLIO_FEE row is a real disposal — Sharesies sells a fraction of a holding
      // to pay the fee — so it must reduce the holding. It is flagged because a stream of
      // tiny disposals can look like trading activity in the quick sale working.
      if (method.toUpperCase() === 'PORTFOLIO_FEE') {
        rowWarnings.push('Disposal made to pay a portfolio fee, not a decision to sell.');
      }

      const instrument: InstrumentRef = {
        ticker,
        exchange: marketCode || null,
        isin: null,
        name: at(row, 'Instrument name') || null,
        assetClass: 'EQUITY',
      };

      const gross = toDecimalOr(at(row, 'Amount')).abs();
      const fees = toDecimalOr(at(row, 'Transaction fee')).abs();

      txns.push({
        id: `${file.fileName}#${tradeId || i + 1}`,
        sourceAccountId: file.sourceAccountId,
        brokerId: 'SHARESIES',
        // Sharesies' own trade id — a stable dedupe key across overlapping exports.
        brokerRef: tradeId || null,
        tradeDate: localDate,
        settleDate: null,
        nzIncomeYear: nzIncomeYearFor(localDate),
        type,
        instrument,
        quantity: toDecimalOr(at(row, 'Quantity')).abs(),
        pricePerUnit: toDecimalOr(at(row, 'Price')),
        currency,
        grossAmount: gross,
        fees,
        netAmount: gross.plus(fees),
        // Sharesies reports each trade in its own currency and quotes no FX rate at all,
        // so there is nothing to capture and nothing is invented.
        brokerQuotedRate: null,
        brokerQuoteFrom: null,
        brokerQuoteTo: null,
        brokerRateDirectionConfidence: 'UNKNOWN',
        fxRateToNzd: null,
        fxRateSource: null,
        fxResolutionTrace: [],
        rawRow: {
          'Trade ID': tradeId,
          'Trade date': rawTimestamp,
          'Market code': marketCode,
          'Transaction method': method,
          Portfolio: at(row, 'Portfolio'),
        },
        parseWarnings: rowWarnings,
      });
    });

    if (shiftedDates > 0) {
      warnings.push({
        severity: 'info',
        message:
          `${shiftedDates} trade date(s) moved to a different calendar day once converted from Sharesies' UTC ` +
          'timestamps to the exchange’s local date. This is expected — NZX trades in particular are usually ' +
          'stamped the previous evening in UTC — and it is what makes the tax year attribution correct.',
      });
    }

    if (txns.length === 0) {
      warnings.push({
        severity: 'error',
        message: 'No transactions were recognised — check this is a Sharesies transaction report CSV.',
      });
    }

    return { txns, warnings };
  },
};
