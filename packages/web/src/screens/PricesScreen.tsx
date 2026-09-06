import { getIncomeYearTaxConfig } from '@fif-calculator/engine';
import { useMemo, useState } from 'react';
import { fetchFxRates } from '../providers/fxRateProvider';
import {
  coveringRate,
  IRD_FX_URL,
  missingClosingPrices,
  missingFxRates,
  requiredClosingPrices,
  requiredCurrencies,
  requiredFxRates,
} from '../state/requirements';
import {
  fxRateKey,
  type ManualClosingPrice,
  type ManualOpeningHolding,
  type SessionState,
} from '../state/session';

/**
 * Spec §7 step 5 and §2: the exact list of values the calculation needs.
 *
 * Manual entry remains the baseline and is fully functional on its own — the app works
 * end to end with no API key and no network, and any missing value blocks rather than
 * being silently treated as zero. Fetching published FX rates is an OPTIONAL convenience
 * layered on top: it is only triggered by an explicit click, it fills blanks only, and
 * it never overwrites a figure the user typed.
 */
export function PricesScreen({
  session,
  onChange,
  onNext,
  onBack,
}: {
  session: SessionState;
  onChange: (patch: Partial<SessionState>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const config = getIncomeYearTaxConfig(session.incomeYear);
  const [fetchState, setFetchState] = useState<{
    status: 'idle' | 'loading' | 'done' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });
  const neededPrices = useMemo(() => requiredClosingPrices(session), [session]);
  const neededRates = useMemo(() => requiredFxRates(session), [session]);
  const stillMissingPrices = missingClosingPrices(session);
  const stillMissingRates = missingFxRates(session);
  const ready = stillMissingPrices.length === 0 && stillMissingRates.length === 0;

  /**
   * `defaultCurrency` comes from the requirement — the currency the instrument actually
   * traded in. It must not be assumed: a new row previously defaulted to USD, so an ASX
   * holding displayed AUD (the requirement's value, shown as a fallback) while the
   * session stored USD, and the closing price was then converted at the USD rate.
   * Silent, and wrong in exactly the way that produces a plausible bad tax figure.
   */
  function setClosingPrice(
    ticker: string,
    exchange: string | null,
    defaultCurrency: string,
    patch: Partial<ManualClosingPrice>,
  ) {
    const existing = session.closingPrices.find((p) => p.ticker.toUpperCase() === ticker.toUpperCase());
    const next = existing
      ? session.closingPrices.map((p) => (p === existing ? { ...p, ...patch } : p))
      : [...session.closingPrices, { ticker, exchange, pricePerUnit: '', currency: defaultCurrency, ...patch }];
    onChange({ closingPrices: next });
  }

  function setFxRate(currency: string, date: string, value: string) {
    onChange({ fxRates: { ...session.fxRates, [fxRateKey(currency, date)]: value } });
  }

  /**
   * Fetches published market rates for every date still outstanding.
   *
   * Only blanks are filled — a figure the user typed is never overwritten — and the
   * source and the date the rate actually belongs to are recorded, because ECB does not
   * publish at weekends and a 31 March that lands on one would otherwise quietly use a
   * different day's rate.
   */
  async function fetchPublicRates() {
    setFetchState({ status: 'loading', message: 'Fetching published rates…' });
    const outstanding = neededRates.filter(
      (r) => coveringRate(session, r.currency, r.date) === null,
    );
    const byDate = new Map<string, string[]>();
    for (const r of outstanding) {
      byDate.set(r.date, [...(byDate.get(r.date) ?? []), r.currency]);
    }
    if (byDate.size === 0) {
      setFetchState({ status: 'idle', message: 'Nothing outstanding to fetch.' });
      return;
    }

    const result = await fetchFxRates([...byDate.entries()].map(([date, currencies]) => ({ date, currencies })));
    const next = { ...session.fxRates };
    const notes: string[] = [];
    for (const quote of result.quotes) {
      const key = fxRateKey(quote.currency, quote.requestedDate);
      const existing = next[key];
      if (existing && existing.trim() !== '') continue;
      next[key] = quote.rate;
      if (quote.actualDate !== quote.requestedDate) {
        notes.push(`${quote.currency} ${quote.requestedDate}: used the rate published ${quote.actualDate}.`);
      }
    }
    onChange({ fxRates: next });

    const failed = result.failures.length;
    setFetchState({
      status: failed > 0 ? 'error' : 'done',
      message:
        `Filled ${result.quotes.length} rate(s) from ECB reference rates.` +
        (failed > 0 ? ` ${failed} could not be fetched — enter those by hand.` : '') +
        (notes.length > 0 ? ` ${notes.join(' ')}` : ''),
    });
  }

  /**
   * Copies one rate onto every date for that currency that has no rate of its own.
   *
   * An explicit action with the value shown on the button, never a silent default — the
   * user is asserting that this published rate applies to those dates, which is how
   * IRD's monthly tables work. Dates with their own figure are left alone.
   */
  function fillDown(currency: string, value: string) {
    const next = { ...session.fxRates };
    for (const req of neededRates) {
      if (req.currency !== currency) continue;
      const key = fxRateKey(req.currency, req.date);
      const existing = next[key];
      if (!existing || existing.trim() === '') next[key] = value;
    }
    onChange({ fxRates: next });
  }

  function addOpeningHolding() {
    const blank: ManualOpeningHolding = {
      ticker: '',
      exchange: null,
      quantity: '',
      marketPricePerUnit: '',
      currency: 'USD',
      costNzd: '',
    };
    onChange({ openingHoldings: [...session.openingHoldings, blank] });
  }

  function setOpeningHolding(index: number, patch: Partial<ManualOpeningHolding>) {
    onChange({
      openingHoldings: session.openingHoldings.map((h, i) => (i === index ? { ...h, ...patch } : h)),
    });
  }

  function removeOpeningHolding(index: number) {
    onChange({ openingHoldings: session.openingHoldings.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-6" data-testid="prices-screen">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">Prices and FX rates</h1>
          <p className="text-sm text-gray-600">
            Closing prices are entered by hand. Exchange rates can be fetched from a public source or typed in.
            A missing value blocks the calculation rather than defaulting to zero.
          </p>
        </div>
        <button type="button" onClick={onBack} className="rounded border px-3 py-1 text-sm">
          Back
        </button>
      </header>

      <section className="rounded border border-gray-200 p-4" data-testid="opening-holdings">
        <h2 className="font-semibold">Opening holdings at 1 April {session.incomeYear - 1}</h2>
        <p className="text-sm text-gray-600">
          What you already held at the <strong>start</strong> of the year. This drives your FDR income — 5% of
          opening market value — so leaving it empty gives an FDR figure of zero. Next year the app carries these
          forward for you from this year&apos;s closing values.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Original cost in NZD is asked for separately because the de minimis test is on cost, not market value —
          it cannot be derived from the price.
        </p>
        {session.openingHoldings.length > 0 && (
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-600">
                <th className="py-1 pr-2">Ticker</th>
                <th className="py-1 pr-2">Exchange</th>
                <th className="py-1 pr-2">Quantity</th>
                <th className="py-1 pr-2">Price at 1 Apr</th>
                <th className="py-1 pr-2">Ccy</th>
                <th className="py-1 pr-2">Original cost NZD</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {session.openingHoldings.map((h, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`Opening holding ${i + 1} ticker`}
                      value={h.ticker}
                      onChange={(e) => setOpeningHolding(i, { ticker: e.target.value.toUpperCase() })}
                      className="w-24 rounded border border-gray-300 px-2 py-1 font-mono uppercase"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`Opening holding ${i + 1} exchange`}
                      value={h.exchange ?? ''}
                      onChange={(e) => setOpeningHolding(i, { exchange: e.target.value.toUpperCase() || null })}
                      className="w-24 rounded border border-gray-300 px-2 py-1 font-mono uppercase"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`Opening holding ${i + 1} quantity`}
                      value={h.quantity}
                      onChange={(e) => setOpeningHolding(i, { quantity: e.target.value })}
                      className="w-24 rounded border border-gray-300 px-2 py-1 font-mono"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`Opening holding ${i + 1} price`}
                      value={h.marketPricePerUnit}
                      onChange={(e) => setOpeningHolding(i, { marketPricePerUnit: e.target.value })}
                      className="w-24 rounded border border-gray-300 px-2 py-1 font-mono"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`Opening holding ${i + 1} currency`}
                      value={h.currency}
                      onChange={(e) => setOpeningHolding(i, { currency: e.target.value.toUpperCase() })}
                      className="w-16 rounded border border-gray-300 px-2 py-1 font-mono uppercase"
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`Opening holding ${i + 1} cost NZD`}
                      value={h.costNzd}
                      onChange={(e) => setOpeningHolding(i, { costNzd: e.target.value })}
                      className="w-28 rounded border border-gray-300 px-2 py-1 font-mono"
                    />
                  </td>
                  <td className="py-1">
                    <button
                      type="button"
                      onClick={() => removeOpeningHolding(i)}
                      aria-label={`Remove opening holding ${i + 1}`}
                      className="text-gray-500 hover:text-red-600"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button type="button" onClick={addOpeningHolding} className="mt-2 rounded border px-3 py-1 text-sm">
          Add an opening holding
        </button>
      </section>

      <section className="rounded border border-gray-200 p-4">
        <h2 className="font-semibold">Closing prices at 31 March {session.incomeYear}</h2>
        <p className="text-sm text-gray-600">
          The closing price on the last trading day on or before {config.endDate}, in the instrument&apos;s own
          currency.
        </p>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-600">
              <th className="py-1 pr-3">Instrument</th>
              <th className="py-1 pr-3">Price per unit</th>
              <th className="py-1 pr-3">Currency</th>
            </tr>
          </thead>
          <tbody>
            {neededPrices.map((req) => {
              const entry = session.closingPrices.find(
                (p) => p.ticker.toUpperCase() === req.ticker.toUpperCase(),
              );
              return (
                <tr key={`${req.ticker}|${req.exchange ?? ''}`} className="border-b border-gray-100">
                  <td className="py-1 pr-3">
                    {req.ticker}
                    {req.exchange && <span className="text-gray-500"> · {req.exchange}</span>}
                  </td>
                  <td className="py-1 pr-3">
                    <input
                      aria-label={`Closing price for ${req.ticker}`}
                      value={entry?.pricePerUnit ?? ''}
                      onChange={(e) =>
                        setClosingPrice(req.ticker, req.exchange, req.currency, { pricePerUnit: e.target.value })
                      }
                      className="w-28 rounded border border-gray-300 px-2 py-1 font-mono"
                    />
                  </td>
                  <td className="py-1 pr-3">
                    <input
                      aria-label={`Currency for ${req.ticker}`}
                      value={entry?.currency ?? req.currency}
                      onChange={(e) =>
                        setClosingPrice(req.ticker, req.exchange, req.currency, {
                          currency: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-20 rounded border border-gray-300 px-2 py-1 font-mono uppercase"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="rounded border border-gray-200 p-4">
        <h2 className="font-semibold">IRD exchange rates</h2>
        <p className="text-sm text-gray-600">
          In IRD&apos;s published convention: <strong>units of foreign currency per 1 NZD</strong>. For example a
          USD rate of <span className="font-mono">0.5800</span> means 1 NZD buys 0.58 USD.
        </p>
        <p className="mt-1 text-sm text-gray-600">
          IRD publishes one rate per month, and a rate applies to every date up to the next published one — so
          you usually only need <strong>one figure per currency per month</strong>, not one per trade date. A date
          below shows as covered once an earlier rate for that currency exists.
        </p>
        <div className="mt-3 rounded border border-gray-200 bg-gray-50 p-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void fetchPublicRates()}
              disabled={fetchState.status === 'loading'}
              data-testid="fetch-fx"
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:bg-gray-300"
            >
              {fetchState.status === 'loading' ? 'Fetching…' : 'Fill blanks from published market rates'}
            </button>
            {fetchState.message && (
              <span
                data-testid="fetch-fx-message"
                className={`text-xs ${fetchState.status === 'error' ? 'text-amber-800' : 'text-gray-600'}`}
              >
                {fetchState.message}
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-600">
            These are <strong>European Central Bank reference rates</strong> for the actual day, not IRD&apos;s
            published table. IR461 permits the actual rate for the day — IRD accepts its own mid-month rate as
            equivalent rather than requiring it — so this is a defensible basis, but it will not match IRD&apos;s
            figures exactly and whichever basis you choose must be applied consistently. The source and the date
            each rate belongs to are recorded in the working paper. Only blank dates are filled; anything you
            typed is left alone.
          </p>
        </div>

        <p className="mt-2 text-sm">
          <a
            href={IRD_FX_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="text-blue-700 underline"
            data-testid="ird-fx-link"
          >
            Open IRD&apos;s exchange rate tables
          </a>{' '}
          <span className="text-gray-500">
            — nothing is fetched automatically; copy the figures from the source you can cite.
          </span>
        </p>

        {requiredCurrencies(session).map((currency) => {
          const forCurrency = neededRates.filter((r) => r.currency === currency);
          const firstEntered = forCurrency
            .map((r) => session.fxRates[fxRateKey(r.currency, r.date)])
            .find((v) => v && v.trim() !== '');
          return (
            <div key={currency} className="mt-4">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-medium">{currency}</h3>
                <a
                  href={`${IRD_FX_URL}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-xs text-blue-700 underline"
                >
                  look up {currency}
                </a>
                {firstEntered && (
                  <button
                    type="button"
                    data-testid={`fill-down-${currency}`}
                    onClick={() => fillDown(currency, firstEntered)}
                    className="rounded border px-2 py-1 text-xs"
                  >
                    Apply {firstEntered} to every blank {currency} date
                  </button>
                )}
              </div>
              <table className="mt-1 w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-600">
                    <th className="py-1 pr-3">Date</th>
                    <th className="py-1 pr-3">Rate (foreign per NZD)</th>
                    <th className="py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {forCurrency.map((req) => {
                    const own = session.fxRates[fxRateKey(req.currency, req.date)] ?? '';
                    const covering = coveringRate(session, req.currency, req.date);
                    return (
                      <tr key={fxRateKey(req.currency, req.date)} className="border-b border-gray-100">
                        <td className="py-1 pr-3 font-mono">{req.date}</td>
                        <td className="py-1 pr-3">
                          <input
                            aria-label={`Rate for ${req.currency} on ${req.date}`}
                            value={own}
                            placeholder={covering && !covering.exact ? covering.value : ''}
                            onChange={(e) => setFxRate(req.currency, req.date, e.target.value)}
                            className="w-28 rounded border border-gray-300 px-2 py-1 font-mono"
                          />
                        </td>
                        <td className="py-1 text-xs">
                          {own.trim() !== '' ? (
                            <span className="text-green-800">entered</span>
                          ) : covering ? (
                            <span className="text-gray-600">
                              using {covering.value} from {covering.date}
                            </span>
                          ) : (
                            <span className="text-amber-800">needed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </section>

      {!ready && (
        <p className="text-sm text-amber-800" data-testid="prices-gate-message">
          Still needed: {stillMissingPrices.length} closing price
          {stillMissingPrices.length === 1 ? '' : 's'} and {stillMissingRates.length} exchange rate
          {stillMissingRates.length === 1 ? '' : 's'}.
        </p>
      )}

      <button
        type="button"
        onClick={onNext}
        disabled={!ready}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        Calculate
      </button>
    </div>
  );
}
