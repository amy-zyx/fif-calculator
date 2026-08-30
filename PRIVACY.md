# Privacy

**No transaction data ever leaves your browser.**

This is a static, client-side-only application. There is no backend and no database.

- Your broker export files are parsed entirely in your browser's memory and, if you opt
  in, stored in your browser's local IndexedDB. Nothing is uploaded anywhere.
- The only network requests this app makes are to a price/FX data provider (if you
  configure one), and those requests send only a ticker symbol and a date — never your
  quantities, costs, account identifiers, or any other transaction detail. This is
  enforced by an automated test (`no module in src/engine imports fetch`) and a lint
  rule, and you can verify it yourself by watching the Network tab in your browser's
  developer tools.
- IndexedDB persistence is opt-in. A "Clear all my data" control in the header wipes
  everything the app has stored, immediately and permanently.
- There is no telemetry, analytics, or error-reporting integration of any kind.

This app is not tax advice. See the disclaimer shown on every page and export.
