import { getIncomeYearTaxConfig } from '@fif-calculator/engine';
import { useMemo } from 'react';
import {
  missingClosingPrices,
  missingFxRates,
  requiredClosingPrices,
  requiredFxRates,
} from '../state/requirements';
import {
  fxRateKey,
  type ManualClosingPrice,
  type ManualOpeningHolding,
  type SessionState,
} from '../state/session';

/**
 * Spec §7 step 5 and §2: the exact list of values the calculation needs, entered by
 * hand. This is the ManualEntryProvider path, and it is deliberately fully functional
 * on its own — the app must work end to end with no API key and no network. Any
 * missing value blocks, and is never silently treated as zero.
 *
 * M6 adds the bundled IRD FX dataset and an optional price API on top of this; neither
 * replaces it.
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
            Enter these by hand. Nothing is fetched, and a missing value blocks the calculation rather than
            defaulting to zero.
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
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-600">
              <th className="py-1 pr-3">Currency</th>
              <th className="py-1 pr-3">Date</th>
              <th className="py-1 pr-3">Rate (foreign per NZD)</th>
            </tr>
          </thead>
          <tbody>
            {neededRates.map((req) => (
              <tr key={fxRateKey(req.currency, req.date)} className="border-b border-gray-100">
                <td className="py-1 pr-3 font-mono">{req.currency}</td>
                <td className="py-1 pr-3 font-mono">{req.date}</td>
                <td className="py-1 pr-3">
                  <input
                    aria-label={`Rate for ${req.currency} on ${req.date}`}
                    value={session.fxRates[fxRateKey(req.currency, req.date)] ?? ''}
                    onChange={(e) => setFxRate(req.currency, req.date, e.target.value)}
                    className="w-28 rounded border border-gray-300 px-2 py-1 font-mono"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
