# Bundled IRD foreign exchange rates

IRD publishes its exchange rate tables as web pages and spreadsheets, with **no public
API**. So the rates are bundled here as a versioned dataset (spec §2) rather than
fetched at runtime.

## The dataset is currently EMPTY, on purpose

`2026.json` and `2027.json` contain no rates. **No rate in this app has been transcribed
from IRD.** Inventing plausible-looking exchange rates would produce tax figures that
look authoritative and are wrong, which is worse than producing none — so the files ship
empty and the app falls back to manual entry, which is fully functional.

Until someone completes the procedure below, every user types their own rates on the
Prices screen. That path is supported indefinitely and is not a degraded mode.

## Convention — get this right or every figure is wrong

Rates are stored exactly as IRD publishes them: **units of foreign currency per 1 NZD**.

An IRD USD rate of `0.5800` means *1 NZD buys 0.58 USD*, so converting a USD amount into
NZD **divides**:

```
NZD 379,310.34 = USD 220,000 / 0.5800
```

The engine takes that reciprocal in exactly one place (`irdRateToNzdFactor`). Do not
pre-invert anything when transcribing.

## Refresh procedure

1. Go to IRD's foreign exchange rates page:
   <https://www.ird.govt.nz/international-tax/business/foreign-currency/exchange-rates>
2. Download the table for the income year you are adding. IRD publishes several sets —
   take the **mid-month** rates unless you have a specific reason to use another, since
   the app's default FX approach (policy A) treats the published mid-month rate as
   equivalent to an actual rate for the day.
3. Transcribe into `{incomeYear}.json` in the shape below. The income year is the
   calendar year the 31 March year-end falls in, so `2026.json` covers
   1 April 2025 – 31 March 2026.
4. Set `sourceUrl`, `retrievedOn`, and `retrievedBy` honestly.
5. Run `npm test` — `irdDataset.test.ts` validates the shape, the date range, and that
   every rate is a positive decimal string.
6. Spot-check at least three rates against the IRD page by eye before committing.
7. Update `VERIFY-ANNUALLY.md` item 5 with the date you checked.

## Shape

```json
{
  "incomeYear": 2026,
  "sourceUrl": "https://www.ird.govt.nz/...",
  "retrievedOn": "2026-08-30",
  "retrievedBy": "name or initials",
  "note": "Mid-month rates.",
  "rates": {
    "USD": { "2025-04-15": "0.5800", "2025-05-15": "0.5850" },
    "AUD": { "2025-04-15": "0.9200" }
  }
}
```

Rates are decimal **strings**, never JSON numbers — a JSON number is a float, and this
codebase does not do float arithmetic on money or rates.
