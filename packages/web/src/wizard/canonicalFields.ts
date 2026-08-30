export type CanonicalFieldKey =
  | 'tradeDate'
  | 'type'
  | 'ticker'
  | 'currency'
  | 'grossAmount'
  | 'quantity'
  | 'pricePerUnit'
  | 'fees'
  | 'fxRateColumn';

export interface CanonicalFieldDef {
  key: CanonicalFieldKey;
  label: string;
  hint: string;
  required: boolean;
}

/** Spec §4.2 point 2: the fields a user drags their file's own columns onto. */
export const CANONICAL_FIELDS: readonly CanonicalFieldDef[] = [
  { key: 'tradeDate', label: 'Trade date', hint: 'Exchange-local date the trade happened', required: true },
  { key: 'type', label: 'Transaction type', hint: "Buy / Sell / Dividend / etc — you'll map each raw value next", required: true },
  { key: 'ticker', label: 'Ticker / symbol', hint: '', required: true },
  { key: 'currency', label: 'Trade currency', hint: 'ISO code, e.g. USD', required: true },
  { key: 'grossAmount', label: 'Gross amount', hint: 'Total trade value before fees', required: true },
  { key: 'quantity', label: 'Quantity', hint: 'Number of shares/units', required: false },
  { key: 'pricePerUnit', label: 'Price per unit', hint: '', required: false },
  { key: 'fees', label: 'Fees / brokerage', hint: '', required: false },
  {
    key: 'fxRateColumn',
    label: 'FX rate column',
    hint: "Captured as-is — you'll be asked what it converts to (spec §5.7)",
    required: false,
  },
];

export const REQUIRED_FIELD_KEYS: readonly CanonicalFieldKey[] = CANONICAL_FIELDS.filter(
  (f) => f.required,
).map((f) => f.key);
