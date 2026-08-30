/**
 * An NZ income year is identified by the calendar year its 31 March end date falls
 * in (spec §3.2 `nzIncomeYear`) — e.g. a trade on 10 June 2025 falls in the year
 * ended 31 March 2026, so `nzIncomeYearFor('2025-06-10') === 2026`.
 *
 * This operates on the ISO date string already resolved to the exchange's local
 * calendar (spec §4.3 timezone rule) — it does no timezone conversion itself.
 */
export function nzIncomeYearFor(isoDate: string): number {
  const [yearStr, monthStr] = isoDate.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return NaN;
  return month <= 3 ? year : year + 1;
}
