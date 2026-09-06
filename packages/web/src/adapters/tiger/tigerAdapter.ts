import { D, ZERO, type CanonicalTxn, type InstrumentRef, type TxnType } from '@fif-calculator/engine';
import { nzIncomeYearFor } from '../../lib/nzIncomeYear';
import { allRows, type BrokerAdapter, type ParseWarning } from '../types';

/**
 * Tiger Trade (老虎) Activity Statement CSV.
 *
 * Validated against a real anonymised export (2025-04-01 – 2026-03-31, USD-based
 * margin account). The fixture beside this file reproduces its structure.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DOUBLE-COUNTING TRAP — the single most important thing in this adapter.
 * ─────────────────────────────────────────────────────────────────────────────
 * In the Trades section, a row WITH a symbol is the ORDER-level aggregate. The rows
 * that follow it with a BLANK symbol are that order's individual fills, and they sum
 * exactly to the order quantity (verified across all 57 order groups in the real
 * export). Both kinds are marked `DATA`.
 *
 * So a parser that treats every `DATA` row as a trade counts every order twice —
 * doubling quantity and cost, which doubles the de minimis peak (and can flip the
 * threshold verdict) and doubles FDR income. Note this is NOT the same trap as
 * IBKR's `SubTotal`/`Total` rollup rows, which are at least labelled as such.
 *
 * This adapter takes the ORDER rows and ignores the fills.
 */

const SECTIONS = new Set([
  'Activity Statement',
  'Name',
  'Account Information',
  'Account Overview',
  'Cash Report',
  'Base Currency Exchange Rate',
  'Financial Instrument Information',
  'Trades',
  'Dividends',
  'Exercise and Expiration',
  'Interest',
  'Interest Accruals',
  'Allowance',
]);

/** Tiger marks real rows with these in column 3; IBKR uses Header/Data in column 1. */
const DISCRIMINATORS = new Set(['DATA', 'HEADER_DATA', 'TOTAL']);

/**
 * Leading columns are stable across row shapes and are read by fixed position.
 * Everything after the fee block is read by counting BACK from the end — see
 * `tailOf` for why.
 */
const LEAD = { symbol: 4, market: 5, exchange: 6, activity: 7, quantity: 8, price: 9, amount: 10 } as const;
const FIRST_FEE_COLUMN = 11;

/**
 * Tiger's Trades rows do NOT all have the same width as their own header: in the real
 * export the header and the Option/Crypto rows have 52 columns while every Stock row
 * has 53. One unlabelled extra column in the fee block shifts Trade Time, Settle Date
 * and Currency by one, so reading those by header index silently returns the wrong
 * cells for every stock trade — the settle date arrives where the trade date belongs
 * and the currency is missing entirely.
 *
 * The last three columns are always Trade Time, Settle Date, Currency, and the two
 * before them are Realized P/L and Notes. Counting back from the end is therefore
 * correct for both widths, and stays correct if Tiger adds another fee column.
 */
function tailOf(row: string[]): { tradeTime: string; settleDate: string; currency: string; lastFee: number } {
  const n = row.length;
  return {
    tradeTime: row[n - 3] ?? '',
    settleDate: row[n - 2] ?? '',
    currency: row[n - 1] ?? '',
    // Fees run from the first fee column up to just before Realized P/L (n-5).
    lastFee: n - 6,
  };
}

/**
 * Tiger puts the identifier in parentheses after the display name:
 *   "BHP GROUP LTD (BHP.AU)"                 -> BHP, market AU
 *   "Adobe (ADBE)"                           -> ADBE, no suffix
 *   "Alphabet (GOOG 20250905 PUT 215.0)"     -> GOOG, contract descriptor kept as name
 *
 * An option contract is distinguished by whitespace inside the parentheses. The
 * UNDERLYING ticker is taken, so contracts group under the share they relate to (and
 * so an assignment can be tied to the right holding); the full contract string is kept
 * as the name, because that is what the user needs to see in the excluded-items panel.
 */
export function parseTigerSymbol(raw: string): {
  ticker: string;
  marketSuffix: string | null;
  name: string;
  contract: string | null;
} | null {
  const match = /^(.*)\(([^()]+)\)\s*$/.exec(raw.trim());
  if (!match) return null;
  const displayName = (match[1] ?? '').trim();
  const inner = (match[2] ?? '').trim();
  if (!inner) return null;

  if (/\s/.test(inner)) {
    const underlying = inner.split(/\s+/)[0] ?? inner;
    return { ticker: underlying, marketSuffix: null, name: inner, contract: inner };
  }

  const dot = inner.indexOf('.');
  if (dot > 0) {
    return {
      ticker: inner.slice(0, dot),
      marketSuffix: inner.slice(dot + 1),
      name: displayName,
      contract: null,
    };
  }
  return { ticker: inner, marketSuffix: null, name: displayName, contract: null };
}

/** Trade Time is "2025-07-22\n11:29:55, Australia/Sydney" — exchange-local (spec §4.3). */
export function parseTigerTradeDate(raw: string): string | null {
  const first = raw.split('\n')[0]?.trim();
  return first && /^\d{4}-\d{2}-\d{2}$/.test(first) ? first : null;
}

function num(raw: string | undefined): string {
  return (raw ?? '').replace(/,/g, '').trim();
}

function toDecimalOr(raw: string | undefined, fallback = ZERO) {
  const cleaned = num(raw);
  if (cleaned === '' || cleaned === '-') return fallback;
  try {
    return D(cleaned);
  } catch {
    return fallback;
  }
}

/**
 * Stock activity types. `OpenShort` is a short sale — the taxpayer never held the
 * shares, so mapping it to SELL would remove holdings that were never there. It is
 * surfaced as UNKNOWN with a warning instead of being guessed at.
 */
function stockTxnType(activity: string): { type: TxnType; warning: string | null } {
  switch (activity) {
    case 'Open':
      return { type: 'BUY', warning: null };
    case 'Close':
      return { type: 'SELL', warning: null };
    case 'OpenShort':
      return {
        type: 'UNKNOWN',
        warning:
          'a short sale (OpenShort) was found. Short positions are not modelled — review this holding by hand.',
      };
    default:
      return { type: 'UNKNOWN', warning: `unrecognised activity type "${activity}"` };
  }
}

function extractBaseCurrency(rows: string[][]): string | null {
  const header = rows.find((r) => r[0] === 'Account Information' && r.includes('Base Currency'));
  const data = rows.find((r) => r[0] === 'Account Information' && r[3] === 'DATA');
  if (!header || !data) return null;
  const at = header.indexOf('Base Currency');
  return at >= 0 ? (data[at] ?? '').trim() || null : null;
}

/** "Overseas withholding tax: 0.10<br/>NZ Resident withholding tax: 26.30" */
function sumWithholding(raw: string): string {
  let total = ZERO;
  for (const part of raw.split(/<br\s*\/?>/i)) {
    const match = /:\s*([\d.,]+)\s*$/.exec(part.trim());
    if (match?.[1]) total = total.plus(toDecimalOr(match[1]));
  }
  return total.toString();
}

export const tigerActivityStatementAdapter: BrokerAdapter = {
  id: 'TIGER',
  displayName: 'Tiger Trade (Activity Statement)',
  // Validated against a real anonymised export, so this one is genuinely verified —
  // unlike the IBKR adapter, which is still awaiting a real file.
  verified: true,
  fixtures: ['src/adapters/tiger/fixtures/tiger-activity-statement.csv'],

  detect(headers, sampleRows) {
    const rows = [headers, ...sampleRows];
    let sectionHits = 0;
    let discriminatorHits = 0;
    let tigerSignature = false;

    for (const row of rows) {
      if (row[0] && SECTIONS.has(row[0])) sectionHits += 1;
      if (row[3] && DISCRIMINATORS.has(row[3])) discriminatorHits += 1;
      // Only Tiger publishes a to-base FX table in the statement; IBKR does not.
      if (row[0] === 'Base Currency Exchange Rate') tigerSignature = true;
      if (row[0] === 'Activity Statement' && row.length >= 5) tigerSignature = true;
    }

    if (sectionHits === 0 || discriminatorHits === 0) return 0;
    let confidence = Math.min(0.55 + discriminatorHits * 0.04, 0.9);
    if (tigerSignature) confidence = Math.min(confidence + 0.09, 0.99);
    return confidence;
  },

  parse(file) {
    const warnings: ParseWarning[] = [];
    const rows = allRows(file);
    const txns: CanonicalTxn[] = [];
    const hasTrades = rows.some((r) => r[0] === 'Trades' && r[4] === 'Symbol');
    const baseCurrency = extractBaseCurrency(rows);

    if (baseCurrency && baseCurrency !== 'NZD') {
      warnings.push({
        severity: 'warning',
        message:
          `This account's base currency is ${baseCurrency}, not NZD. Tiger's own exchange rates convert to ` +
          `${baseCurrency}, never directly to NZD, so every amount must be converted via IRD rates. Check the ` +
          'FX variance panel before relying on the figures.',
      });
    }

    if (hasTrades) {
      let orderIndex = 0;

      for (const row of rows) {
        if (row[0] !== 'Trades' || row[3] !== 'DATA') continue;

        const symbolRaw = (row[LEAD.symbol] ?? '').trim();
        // A blank symbol means this row is a FILL of the order above it. Skipping these
        // is what prevents every quantity being counted twice — see the note at the top.
        if (symbolRaw === '') continue;

        const subtype = row[1];
        // Forex rows are cash conversions between currencies, not holdings, and use a
        // completely different (13-column) layout. They are not FIF interests.
        if (subtype === 'Forex') continue;

        if (subtype === 'Crypto') {
          warnings.push({
            severity: 'warning',
            message: `Crypto trade (${symbolRaw}) skipped — crypto is outside this tool's scope and is taxed under different rules.`,
          });
          continue;
        }

        const parsedSymbol = parseTigerSymbol(symbolRaw);
        const tail = tailOf(row);
        const tradeDate = parseTigerTradeDate(tail.tradeTime);
        const currency = tail.currency.trim();

        if (!parsedSymbol || !tradeDate || !currency) {
          warnings.push({
            severity: 'error',
            message: `Trade row for "${symbolRaw || '(blank)'}" is missing a symbol, trade date or currency — skipped.`,
          });
          continue;
        }

        orderIndex += 1;
        const signedQuantity = toDecimalOr(row[LEAD.quantity]);
        const amount = toDecimalOr(row[LEAD.amount]);
        let fees = ZERO;
        for (let i = FIRST_FEE_COLUMN; i <= tail.lastFee; i += 1) {
          fees = fees.plus(toDecimalOr(row[i]).abs());
        }

        const isOption = subtype === 'Option';
        const activity = (row[LEAD.activity] ?? '').trim();
        const mapped = isOption
          ? { type: 'OPTION_TRADE' as TxnType, warning: null }
          : stockTxnType(activity);
        if (mapped.warning) {
          warnings.push({ severity: 'warning', message: `${parsedSymbol.ticker}: ${mapped.warning}` });
        }

        const instrument: InstrumentRef = {
          ticker: parsedSymbol.ticker,
          exchange: (row[LEAD.exchange] ?? '').trim() || null,
          isin: null,
          name: parsedSymbol.name || null,
          assetClass: isOption ? 'OPTION' : 'EQUITY',
        };

        txns.push({
          id: `${file.fileName}#trade#${orderIndex}`,
          sourceAccountId: file.sourceAccountId,
          brokerId: 'TIGER',
          brokerRef: null,
          tradeDate,
          settleDate: tail.settleDate.trim() || null,
          nzIncomeYear: nzIncomeYearFor(tradeDate),
          type: mapped.type,
          instrument,
          quantity: signedQuantity.abs(),
          pricePerUnit: toDecimalOr(row[LEAD.price], ZERO),
          currency,
          grossAmount: amount.abs(),
          fees,
          netAmount: amount.abs().plus(fees),
          // Tiger's rates convert to the account BASE currency, not NZD, and the
          // statement carries no per-trade rate at all — so nothing is captured here
          // rather than something being invented. See spec §5.7 trap 1.
          brokerQuotedRate: null,
          brokerQuoteFrom: null,
          brokerQuoteTo: baseCurrency,
          brokerRateDirectionConfidence: 'UNKNOWN',
          fxRateToNzd: null,
          fxRateSource: null,
          fxResolutionTrace: [],
          rawRow: { Symbol: symbolRaw, 'Activity Type': activity, Market: row[LEAD.market] ?? '' },
          parseWarnings: [],
        });
      }
    }

    // --- Dividends ---------------------------------------------------------
    const dividendHeader = rows.find((r) => r[0] === 'Dividends' && r.includes('Cash Dividends'));
    if (dividendHeader) {
      const col: Record<string, number> = {};
      dividendHeader.forEach((n, i) => {
        if (n && !(n in col)) col[n] = i;
      });
      let i = 0;
      for (const row of rows) {
        if (row[0] !== 'Dividends' || row[3] !== 'DATA') continue;
        i += 1;
        const product = (row[col['Symbol'] ?? -1] ?? '').trim();
        const parsed = parseTigerSymbol(product);
        const date = (row[col['Date'] ?? -1] ?? '').trim();
        const gross = toDecimalOr(row[col['Cash Dividends'] ?? -1]);
        const currency = (row[col['Currency'] ?? -1] ?? '').trim();
        if (!parsed || !date || !currency) {
          warnings.push({ severity: 'error', message: `Dividend row ${i} could not be parsed — skipped.` });
          continue;
        }

        const base: Omit<CanonicalTxn, 'id' | 'type' | 'grossAmount' | 'netAmount'> = {
          sourceAccountId: file.sourceAccountId,
          brokerId: 'TIGER',
          brokerRef: null,
          tradeDate: date,
          settleDate: null,
          nzIncomeYear: nzIncomeYearFor(date),
          instrument: {
            ticker: parsed.ticker,
            exchange: null,
            isin: null,
            name: parsed.name || null,
            assetClass: 'EQUITY',
          },
          quantity: null,
          pricePerUnit: null,
          currency,
          fees: ZERO,
          brokerQuotedRate: null,
          brokerQuoteFrom: null,
          brokerQuoteTo: baseCurrency,
          brokerRateDirectionConfidence: 'UNKNOWN',
          fxRateToNzd: null,
          fxRateSource: null,
          fxResolutionTrace: [],
          rawRow: { Product: product },
          parseWarnings: [],
        };

        txns.push({ ...base, id: `${file.fileName}#dividend#${i}`, type: 'DIVIDEND', grossAmount: gross, netAmount: gross });

        const withheld = D(sumWithholding(row[col['Fees & Tax'] ?? -1] ?? ''));
        if (withheld.greaterThan(ZERO)) {
          txns.push({
            ...base,
            id: `${file.fileName}#dividend-wht#${i}`,
            type: 'DIVIDEND_WITHHOLDING_TAX',
            grossAmount: withheld,
            netAmount: withheld,
          });
        }
      }
    }

    if (txns.length === 0) {
      warnings.push({
        severity: 'error',
        message: 'No trades or dividends were recognised — check this is a Tiger Activity Statement CSV.',
      });
    }

    return { txns, warnings };
  },
};
