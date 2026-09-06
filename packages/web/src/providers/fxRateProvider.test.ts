import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchFxRates, fetchFxRatesForDate } from './fxRateProvider';

function mockFetch(handler: (url: string) => { ok: boolean; body: unknown }) {
  const spy = vi.fn(async (input: RequestInfo | URL) => {
    const { ok, body } = handler(String(input));
    return { ok, status: ok ? 200 : 500, json: async () => body } as Response;
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchFxRatesForDate', () => {
  it('requests NZD as the base, so the response is already in IRD convention', async () => {
    const spy = mockFetch(() => ({
      ok: true,
      body: { base: 'NZD', date: '2025-06-10', rates: { USD: 0.60525, AUD: 0.9283 } },
    }));

    const result = await fetchFxRatesForDate('2025-06-10', ['USD', 'AUD']);

    const url = String(spy.mock.calls[0]?.[0]);
    expect(url).toContain('base=NZD');
    // Foreign units per 1 NZD — no reciprocal is taken here, which is what keeps the
    // direction bugs of spec §5.7 from having a second place to happen.
    expect(result.quotes.find((q) => q.currency === 'USD')?.rate).toBe('0.60525');
  });

  it('records the date the rate actually belongs to when it differs', async () => {
    // ECB does not publish at weekends; asking for a Sunday returns the Friday rate.
    mockFetch(() => ({ ok: true, body: { base: 'NZD', date: '2025-06-06', rates: { USD: 0.60261 } } }));
    const result = await fetchFxRatesForDate('2025-06-08', ['USD']);

    expect(result.quotes[0]).toMatchObject({
      requestedDate: '2025-06-08',
      actualDate: '2025-06-06',
      source: 'ecb-frankfurter',
    });
  });

  it('never requests NZD against itself', async () => {
    const spy = mockFetch(() => ({ ok: true, body: { base: 'NZD', date: '2025-06-10', rates: {} } }));
    await fetchFxRatesForDate('2025-06-10', ['NZD']);
    expect(spy).not.toHaveBeenCalled();
  });

  it('reports a failure rather than inventing a rate when one is absent', async () => {
    mockFetch(() => ({ ok: true, body: { base: 'NZD', date: '2025-06-10', rates: {} } }));
    const result = await fetchFxRatesForDate('2025-06-10', ['XYZ']);
    expect(result.quotes).toEqual([]);
    expect(result.failures[0]?.currency).toBe('XYZ');
  });

  it('reports a failure on a network error instead of throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const result = await fetchFxRatesForDate('2025-06-10', ['USD']);
    expect(result.quotes).toEqual([]);
    expect(result.failures[0]?.reason).toBe('offline');
  });

  it('rejects a non-positive rate rather than passing it to the engine', async () => {
    mockFetch(() => ({ ok: true, body: { base: 'NZD', date: '2025-06-10', rates: { USD: 0 } } }));
    const result = await fetchFxRatesForDate('2025-06-10', ['USD']);
    expect(result.quotes).toEqual([]);
  });
});

describe('the privacy contract', () => {
  it('sends only a date and currency codes — no holding, cost, account or name', async () => {
    const spy = mockFetch(() => ({ ok: true, body: { base: 'NZD', date: '2025-06-10', rates: { USD: 0.6 } } }));
    await fetchFxRates([{ date: '2025-06-10', currencies: ['USD'] }]);

    const url = String(spy.mock.calls[0]?.[0]);
    expect(url).toBe('https://api.frankfurter.dev/v1/2025-06-10?base=NZD&symbols=USD');
    for (const forbidden of ['quantity', 'cost', 'account', 'taxpayer', 'name', 'holding']) {
      expect(url.toLowerCase()).not.toContain(forbidden);
    }
  });

  it('fetches each date once, batching every currency into a single request', async () => {
    const spy = mockFetch(() => ({
      ok: true,
      body: { base: 'NZD', date: '2025-06-10', rates: { USD: 0.6, AUD: 0.92 } },
    }));
    const result = await fetchFxRates([{ date: '2025-06-10', currencies: ['USD', 'AUD'] }]);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.quotes).toHaveLength(2);
  });
});
