# Privacy

**No transaction data ever leaves your browser.**

This is a static, client-side-only application. There is no backend and no database.

- Your broker export files are parsed entirely in your browser's memory and, if you opt
  in, stored in your browser's local IndexedDB. Nothing is uploaded anywhere.
- The only network requests this app makes are to price and exchange-rate providers,
  and they send only a **ticker symbol, a currency code, and a date** — never your
  quantities, costs, holdings, account identifiers, or name. Concretely:
  - **Exchange rates** are fetched from a public source only when you click "Fill blanks
    from published market rates". The request contains a date and currency codes such as
    `USD,AUD`, and nothing else. No account is needed.
  - **Share prices** are fetched only if you supply your own API key for a price
    provider. That key is stored in your browser and never bundled with the app.
  - Neither is required. You can enter every price and rate by hand and the app works
    end to end with no network at all.

  This is enforced three ways: a test asserting no module outside `src/providers` calls
  `fetch`, a test asserting the outbound request carries no holding data, and a
  Content-Security-Policy that permits connections to those specific hosts and nothing
  else. You can verify it yourself in your browser's Network tab.
- IndexedDB persistence is opt-in. A "Clear all my data" control in the header wipes
  everything the app has stored, immediately and permanently.
- There is no telemetry, analytics, or error-reporting integration of any kind.

This app is not tax advice. See the disclaimer shown on every page and export.
