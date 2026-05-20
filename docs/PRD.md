# FIF Calculator App – Product Requirements Document

**Version:** 1.2  
**Date:** 20 May 2026  
**Owner:** Amy  
**Market:** New Zealand first  
**Product type:** Mobile-responsive web app first; optional App Store / Google Play mobile app later  
**Primary goal:** Help NZ investors upload broker files and generate reviewable FIF taxable income working papers for IR3/accountant review.  
**Future expansion:** App Store / Google Play app after web workflow is validated; Australia only after NZ product proves demand, accuracy, and commercial viability.

\---

# Part B — Detailed PRD

\---

# 1\. Executive Summary

Build a free / freemium web app that helps New Zealand investors calculate Foreign Investment Fund income from overseas shares, ETFs, and foreign funds by uploading broker CSV/XLSX files instead of manually entering transactions into calculators or spreadsheets.

The product should convert messy broker exports into a normalised investment ledger, calculate FIF income using supported methods, and produce an accountant-friendly report with full calculation details, assumptions, warnings, and audit trail.

The first product should be **NZ FIF only**. Australia should remain a future expansion only if the NZ product proves technical accuracy, user demand, and willingness to pay.

\---

# 2\. Product Principles

1. **NZ first** — solve one jurisdiction deeply before expanding.
2. **CSV/XLSX first** — assume users can download files, but formats vary.
3. **Human review required** — never silently trust messy financial data.
4. **Transparent calculations** — every number must trace back to source rows and assumptions.
5. **Tax-advice boundary** — prepare working values, but do not determine final legal position.
6. **Accountant-friendly** — output should be easy for accountants to review.
7. **Privacy-sensitive** — financial data should be minimised, encrypted, and deletable.
8. **Extensible architecture** — import and ledger foundation should later support Australia if needed.

\---

# 3\. Scope

## 3.1 MVP Scope

The MVP supports:

* New Zealand individual investors and eligible trustees at a basic level.
* Standard NZ income year: 1 April to 31 March.
* Listed foreign shares.
* Foreign ETFs and listed foreign funds where market value is available.
* FDR and CV calculations.
* Quick-sale adjustments for common same-year buy/sell scenarios.
* FIF cost-threshold review.
* ASX exemption flagging.
* Foreign withholding tax summary.
* Broker CSV/XLSX upload and manual mapping.
* PDF/CSV working-paper export.

## 3.2 Out of Scope for MVP

The MVP does not support:

* Direct IRD filing.
* Personal tax advice.
* Full company/trust/partnership workflows.
* Foreign superannuation calculations.
* Foreign life insurance calculations.
* Controlled foreign company calculations.
* Derivatives, CFDs, crypto, futures, options, margin trading, short selling.
* Full corporate action automation.
* Cost Method automation.
* Deemed Rate of Return method.
* Revenue Account Method full implementation.
* Attributable FIF Income Method.
* Australia calculations.

## 3.3 Mobile App Scope

The MVP should be a mobile-responsive web app. Native iOS and Android apps should be future scope unless there is strong evidence that mobile-first users cannot complete the workflow through the web app.

### In MVP Scope

* Mobile-responsive web layout.
* Web upload using browser file picker.
* Support upload from phone Files/Downloads/Cloud Drive where browser allows.
* Mobile-friendly broker download instructions.
* PDF report download on mobile.
* Email report link to self.
* PWA-ready design where practical.

### Out of MVP Scope

* Native iOS app submission to App Store.
* Native Android app submission to Google Play.
* Native file share-sheet integration.
* Push notifications.
* In-app purchases.
* Offline calculation.
* Mobile camera/OCR extraction from broker screenshots.

### Future App Scope

* iOS app distributed via App Store.
* Android app distributed via Google Play.
* Native document picker.
* Share-sheet import from Files, Downloads, Drive, OneDrive, iCloud, Gmail, or broker app attachment flows.
* Secure local cache for recent reports.
* Push reminders around tax-year end.
* Biometric unlock for saved calculations.
* App-specific onboarding for downloading broker files.

## 3.4 Future Scope

Future phases may add:

* Cost Method.
* Revenue Account Method screening and calculation support.
* More corporate action handling.
* Historical price lookup.
* Automated IRD/RBNZ FX rate loading.
* Accountant portal.
* Australia foreign investment tax module.

\---

# 4\. User Personas

## 4.1 DIY NZ Retail Investor

**Profile:** Holds US shares and ETFs through Sharesies, Hatch, Stake, or IBKR.  
**Pain:** Knows FIF may apply but does not know how to calculate it.  
**Need:** Upload files, get clear warnings, calculate FDR/CV, export report.

## 4.2 Near-Threshold Investor

**Profile:** Has invested around NZD 40,000–70,000 offshore.  
**Pain:** Unsure whether the NZD 50,000 cost threshold has been exceeded.  
**Need:** Threshold checker using historical purchases and FX conversion.

## 4.3 Multi-Broker Investor

**Profile:** Uses Sharesies for ETFs, Hatch for US stocks, IBKR for active trading.  
**Pain:** Each broker has separate reports; no single FIF view.  
**Need:** Multi-file import, deduplication, consolidated FIF output.

## 4.4 Accountant / Tax Agent

**Profile:** Receives client CSVs, screenshots, PDFs, and incomplete exports.  
**Pain:** Too much manual cleaning and reconciliation.  
**Need:** Standardised import, exception list, calculation audit pack.

## 4.5 Migrant / Returning NZ Resident

**Profile:** Arrived in NZ with overseas investments.  
**Pain:** Residency timing, transitional resident status, and method eligibility can be complex.  
**Need:** Screening questions and clear “needs professional advice” path.

\---

# 5\. User Journey

## 5.1 First-Time User Flow

1. User lands on the app.
2. User selects “Start NZ FIF calculation”.
3. App explains scope and disclaimer.
4. User selects income year.
5. App asks screening questions.
6. User uploads broker files.
7. App detects broker and file type.
8. App previews rows.
9. App suggests column mappings.
10. User confirms or edits mappings.
11. App normalises data.
12. App reconstructs holdings.
13. App identifies missing data and validation issues.
14. User resolves warnings or enters missing values.
15. App calculates threshold, FDR, CV, and quick-sale adjustment.
16. App shows method comparison and warnings.
17. User exports PDF/CSV working papers.
18. User can save or delete calculation data.

## 5.2 Returning User Flow

1. User logs in or opens saved calculation.
2. User selects saved portfolio.
3. User selects new income year.
4. App reuses prior broker mappings.
5. User uploads new files.
6. App compares opening holdings to prior year closing holdings.
7. User resolves exceptions.
8. App generates current-year report.

## 5.3 Accountant Flow

1. Accountant creates client calculation.
2. Client uploads files or sends files to accountant.
3. App maps and validates data.
4. Accountant reviews exceptions and manual adjustments.
5. App generates report pack.
6. Accountant uses output for IR3/tax return preparation.

\---

# 6\. Screening Questions

The app should ask these before calculation:

1. Are you a New Zealand tax resident for this income year?
2. Are you a transitional resident?
3. Are you calculating for an individual, joint account, trust, company, or other entity?
4. Do the uploaded files include all overseas investments you held during the year?
5. Did you hold any foreign shares/funds outside these brokers?
6. Did you own 10% or more of any foreign company or fund?
7. Did you hold Australian listed shares?
8. Did you hold options, futures, crypto, CFDs, margin products, or short positions?
9. Did you transfer holdings between brokers?
10. Did you receive foreign dividends or distributions?
11. Did you have stock splits, mergers, spin-offs, returns of capital, or symbol changes?
12. Did you have foreign superannuation or foreign life insurance interests?

## 6.1 Screening Outcomes

The app should classify the calculation as one of:

1. Ready to calculate.
2. Can calculate with warnings.
3. Needs missing data.
4. Out of MVP scope.
5. Likely no FIF calculation required, but ordinary income may still apply.
6. Needs accountant review.

\---

# 7\. FIF Rules and Product Logic

## 7.1 Tax Year

Default NZ income year:

* Start: 1 April
* End: 31 March

Non-standard balance dates should be future/accountant mode.

## 7.2 FIF Scope

The app should ask whether investments include:

* shares in overseas companies;
* foreign ETFs;
* foreign unit trusts;
* foreign managed funds;
* foreign superannuation interests;
* foreign life insurance interests.

MVP supports listed foreign shares and ETFs/funds where market values are available.

## 7.3 FIF Threshold Logic

For many individual investors, FIF calculations are not required if total cost of attributing FIF interests does not exceed NZD 50,000 at any time in the year.

The app should calculate an estimated threshold position from uploaded data rather than simply asking the user.

Threshold workflow:

1. Import all historical purchases for FIF-relevant investments where available.
2. Convert purchase cost to NZD using selected FX policy.
3. Include brokerage/transaction costs where appropriate.
4. Track cost of holdings through buys, sells, transfers, and corporate actions.
5. Identify whether cost exceeded NZD 50,000 at any point in the income year.
6. Ask user to confirm whether foreign investments outside uploaded files exist.
7. Output “likely under threshold”, “likely over threshold”, or “cannot determine”.

## 7.4 ASX-Listed Australian Company Exemption

Certain Australian listed companies may be exempt from FIF rules if conditions are met. The app should:

* identify ASX-listed holdings;
* ask for ASX ticker/exchange;
* flag holdings that may be FIF-exempt;
* allow user/accountant confirmation;
* treat confirmed exempt holdings separately from FIF holdings;
* include dividends from exempt holdings in a separate overseas income summary.

The app must avoid confidently saying “exempt” unless reference data and user confirmation support it.

## 7.5 Foreign Dividends and Foreign Withholding Tax

Under FIF methods, dividends may not be taxed separately in the same way as ordinary dividends, but they may still be relevant for CV and foreign tax credit review.

The report should include:

* dividends received;
* foreign withholding tax;
* currency;
* NZD converted amount;
* associated FIF/exempt investment;
* warning about foreign tax credit limitations.

\---

# 8\. Calculation Methods

## 8.1 Fair Dividend Rate Method

### Formula Summary

> FIF income = 5% × opening market value on 1 April + quick-sale adjustment

### Required Inputs

* Opening quantity at 1 April.
* Opening market price or market value.
* Currency.
* FX rate to NZD.
* Buys during year.
* Sells during year.
* Same-year buy/sell pairs for quick-sale logic.
* Dividends/distributions where relevant for quick-sale gain calculations.
* Fees/brokerage where relevant.

### Output Fields

* Symbol.
* Investment name.
* Opening quantity.
* Opening market value in foreign currency.
* Opening market value in NZD.
* Base FDR income.
* Quick-sale adjustment.
* Total FDR income.
* Warnings.

## 8.2 Comparative Value Method

### Formula Summary

> CV income = closing market value + sales proceeds + dividends received − opening market value − purchases

### Required Inputs

* Opening market value in NZD.
* Closing market value in NZD.
* Purchases in NZD.
* Sales proceeds in NZD.
* Dividends/distributions in NZD.
* FX rates.
* Adjustments and fees where relevant.

### Output Fields

* Symbol.
* Opening value NZD.
* Closing value NZD.
* Purchases NZD.
* Sales NZD.
* Dividends NZD.
* CV income/loss.
* Taxable CV amount.
* Warnings.

## 8.3 Quick-Sale Adjustment

Quick-sale logic is complex but important because many retail users buy and sell in the same year.

MVP should support:

* detection of same-year buy and sell activity;
* FIFO matching by default;
* ability to review matched trades;
* calculation of peak holding method amount;
* calculation of quick-sale gain amount;
* selected adjustment as the lesser amount;
* export of full worksheet.

## 8.4 Method Comparison

The app should show:

|Method|Result|Status|
|-|-:|-|
|FDR|$X|Available / warning / blocked|
|CV|$Y|Available / warning / blocked|
|Lower calculated amount|$Z|Requires user/accountant confirmation|

The app should avoid wording like “this is definitely your tax to pay”. Use:

> Based on the data provided, this is the lower calculated method result. Please confirm method eligibility and treatment before filing.

## 8.5 Future Methods

Future advanced/accountant features may include:

* Cost Method.
* Deemed Rate of Return Method.
* Revenue Account Method.
* Attributable FIF Income Method.

These should not be implemented in the first MVP unless validated by a tax professional.

\---

# 9\. Broker Support and Input Sources

## 9.1 Broker Priority Matrix

|Priority|Platform|Main files to support|Native FIF/tax support|MVP notes|
|-:|-|-|-|-|
|1|Sharesies|Transaction CSV, holdings summary/report, FIF cost columns, dividend/tax data|Yes, paid FIF income report available after tax year end|High NZ retail usage. Compete on multi-broker, lower-friction, and audit workflow.|
|2|Hatch|Transactions CSV, holdings export, dividends/tax reports, Hatch FIF report|Yes|Strong US-share investor base. Need handle money-market rows and opening holdings.|
|3|Interactive Brokers|Activity Statement, Custom Statement, Flex Query CSV/XML/Text|No NZ-specific FIF report|Best advanced-user segment. Provide recommended Flex Query template.|
|4|Stake|Financial year investment activity XLSX, separate ASX/US tabs|No native NZ FIF; Sharesight integration/import available|XLSX and multi-tab support important.|
|5|Tiger Brokers|Statements/tax reports, Sharesight connection, trade confirmation emails|Sharesight route; broker statements vary|Multi-market and complex product risk. MVP support shares/ETFs only.|
|6|Moomoo|CSV trade export via tax documents / Sharesight manual import|Sharesight route; API mainly AU-specific|Support after core brokers; transferred holdings may need manual entry.|
|7|Generic broker|User-mapped CSV/XLSX|Varies|Needed for long-tail market but not first parser priority.|

## 9.2 Input Methods

### MVP

* Drag-and-drop CSV upload.
* XLSX upload.
* Manual table entry/paste for missing values.
* Manual mapping wizard.
* Broker template selection.

### Later

* ZIP upload.
* PDF extraction only for selected report formats.
* Broker API integrations.
* Sharesight import/export compatibility.
* Accountant bulk upload.

## 9.3 Required File Categories

|File category|Purpose|Required for MVP?|
|-|-|-|
|Transaction history|Buys, sells, fees, transfers, corporate action clues|Yes|
|Holdings report|Opening and closing position values|Strongly recommended|
|Dividend/distribution report|CV method and withholding tax summary|Yes if dividends occurred|
|FX/cash report|NZD conversions and cash movements|Recommended|
|Broker FIF/tax report|Reconciliation/reference only|Optional|
|Manual entry template|Fill missing values|Yes|

\---

# 10\. CSV/XLSX Parsing and Column Detection

## 10.1 Parsing Strategy

The product should use a hybrid approach:

1. Deterministic parsing for known broker templates.
2. Rule-based column matching.
3. AI-assisted mapping suggestions where useful.
4. User confirmation for low-confidence mappings.
5. Saved templates after correction.

## 10.2 File Detection Signals

The app should detect broker and file type using:

* file name;
* worksheet name;
* report title rows;
* column headers;
* date range rows;
* known transaction type labels;
* currency fields;
* known broker-specific phrases;
* sample values;
* debit/credit signs;
* row count and section layout.

## 10.3 File Types to Detect

1. Transaction history.
2. Holdings snapshot.
3. Dividend/distribution report.
4. Cash/FX ledger.
5. Tax/FIF report.
6. Activity statement.
7. Realised gains report.
8. Unknown/manual mapping required.

## 10.4 Column Name Detection Examples

The app should recognise common column-name variations.

### Date Columns

Possible source names:

* Date
* Trade Date
* Transaction Date
* Settlement Date
* Activity Date
* Created At
* Filled Date
* Execution Date
* Contract Date
* Payment Date
* Ex Date
* Ex-Dividend Date
* Record Date

Canonical targets:

* transaction\_date
* settlement\_date
* payment\_date
* ex\_dividend\_date
* as\_at\_date

### Symbol / Security Columns

Possible source names:

* Symbol
* Ticker
* Code
* Instrument
* Security
* Stock
* Asset
* Holding
* Product
* Contract
* ISIN
* CUSIP
* Sedol
* Exchange Code

Canonical targets:

* symbol
* exchange
* isin
* cusip
* investment\_name

### Quantity Columns

Possible source names:

* Quantity
* Qty
* Shares
* Units
* Filled Quantity
* Executed Quantity
* Quantity Filled
* Number of Shares
* Holding Quantity
* Units Held

Canonical targets:

* quantity
* quantity\_held
* quantity\_bought
* quantity\_sold

### Price Columns

Possible source names:

* Price
* Unit Price
* Average Price
* Fill Price
* Execution Price
* Market Price
* Close Price
* Share Price
* Cost per Share
* Purchase Price

Canonical targets:

* unit\_price
* market\_price
* opening\_price
* closing\_price

### Amount / Value Columns

Possible source names:

* Amount
* Net Amount
* Gross Amount
* Value
* Trade Value
* Total
* Total Amount
* Debit
* Credit
* Proceeds
* Cost Basis
* Consideration
* Market Value
* Portfolio Value
* Cash Amount

Canonical targets:

* gross\_amount
* net\_amount
* purchase\_amount
* sale\_proceeds
* market\_value
* opening\_value
* closing\_value

### Fee Columns

Possible source names:

* Fee
* Fees
* Brokerage
* Commission
* Charges
* Transaction Fee
* Platform Fee
* Regulatory Fee
* SEC Fee
* FINRA Fee

Canonical targets:

* fees
* brokerage
* transaction\_cost

### Tax Columns

Possible source names:

* Tax
* Taxes
* Withholding Tax
* WHT
* Foreign Tax
* Tax Withheld
* Non-Resident Withholding Tax
* NRWT
* Dividend Tax

Canonical targets:

* tax\_withheld
* foreign\_tax\_withheld
* withholding\_tax\_nzd

### Currency / FX Columns

Possible source names:

* Currency
* CCY
* Trade Currency
* Settlement Currency
* Local Currency
* Base Currency
* FX Rate
* Exchange Rate
* Conversion Rate
* NZD Amount
* NZ Dollar Amount
* Converted Amount

Canonical targets:

* currency
* settlement\_currency
* fx\_rate\_to\_nzd
* amount\_nzd

### Transaction Type Columns

Possible source names:

* Type
* Activity Type
* Transaction Type
* Description
* Action
* Category
* Sub Type
* Event Type
* Order Type
* Movement Type

Canonical targets:

* source\_transaction\_type
* mapped\_transaction\_type

### Account / Broker Columns

Possible source names:

* Account
* Account ID
* Account Number
* Portfolio
* Broker
* Custodian
* User
* Wallet
* Cash Account

Canonical targets:

* broker\_name
* account\_reference
* portfolio\_name

\---

# 11\. Canonical Data Requirements

## 11.1 Investment Fields

* Broker.
* Account reference.
* Symbol/ticker.
* Exchange.
* ISIN/CUSIP if available.
* Investment name.
* Country.
* Asset type.
* Currency.
* FIF relevance flag.
* ASX exemption status.
* Unsupported product flag.

## 11.2 Transaction Fields

* Source file.
* Source row number.
* Transaction date.
* Settlement date.
* Original transaction type.
* Mapped transaction type.
* Symbol.
* Quantity.
* Unit price.
* Gross amount.
* Fees.
* Tax withheld.
* Net amount.
* Currency.
* FX rate.
* NZD amount.
* Reference ID.

## 11.3 Holding Fields

* As-at date.
* Symbol.
* Quantity.
* Market price.
* Market value.
* Currency.
* FX rate.
* NZD market value.
* Source.

## 11.4 Dividend / Income Fields

* Payment date.
* Ex-dividend date if available.
* Declaration date if available.
* Symbol.
* Gross income.
* Foreign tax withheld.
* Net income.
* Currency.
* FX rate.
* NZD gross income.
* NZD tax withheld.
* Reinvestment flag.

## 11.5 FX Fields

* Conversion date.
* From currency.
* To currency.
* Rate.
* Rate method.
* Rate source.
* Original amount.
* Converted NZD amount.

## 11.6 Manual Adjustment Fields

* Adjustment ID.
* Affected entity.
* Affected field.
* Old value.
* New value.
* Reason.
* Adjusted by.
* Adjusted at.

\---

# 12\. Functional Requirements

## 12.1 Account and Session Modes

### Session Mode

* Upload files.
* Process calculation.
* Export result.
* Auto-delete after session expiry.
* No account required.

### Account Mode

* Save portfolios.
* Save broker mappings.
* Save calculation history.
* Reuse previous year closing holdings.
* Delete data on request.

## 12.2 Upload and File Detection

### Must Have

* Upload one or multiple CSV/XLSX files.
* Detect broker where possible.
* Detect file type: transactions, holdings, dividends, FX/cash, tax report, unknown.
* Preview data before import.
* Preserve raw source rows.
* Do not silently discard unknown rows.

### Acceptance Criteria

* User can upload multiple files.
* App shows preview before import.
* User can remove a file before processing.
* Every source row receives source file and row number.
* Unknown rows are retained and flagged.

## 12.3 Column Mapping Wizard

### Must Have

* Auto-suggest column mappings with confidence score.
* Let user correct mappings.
* Show sample values for each column.
* Mark required fields.
* Explain why each required field is needed.
* Save mapping template for future uploads.

### Acceptance Criteria

* User can complete import even when broker is unknown, if required fields are mapped manually.
* Low-confidence mappings require confirmation.
* User changes are stored in audit log.

## 12.4 Transaction Classification

### Standard Types

* Buy.
* Sell.
* Dividend.
* Distribution.
* Foreign tax withheld.
* Fee.
* FX conversion.
* Cash deposit.
* Cash withdrawal.
* Transfer in.
* Transfer out.
* Stock split.
* Reverse split.
* Return of capital.
* Ticker change.
* Merger/spin-off.
* Interest.
* Money market fund buy.
* Money market fund sell.
* Unknown.

### Requirements

* Preserve original source type.
* Store mapped type.
* Allow user override.
* Require review of unknown types.
* Exclude unsupported types from final calculations unless manually handled.

## 12.5 Holdings Reconstruction

### Requirements

For each investment:

1. Load opening holdings if available.
2. Add buys and transfers in.
3. Subtract sells and transfers out.
4. Apply stock split adjustments where provided.
5. Calculate closing units.
6. Compare calculated holdings to uploaded holdings.
7. Flag mismatches.
8. Allow manual adjustment with reason.

### Acceptance Criteria

* Negative holdings are blocking errors unless explained.
* Closing mismatch above tolerance is a warning or blocking error.
* User can enter manual opening/closing holdings.
* Manual adjustments require a reason.

## 12.6 Market Value Engine

### Sources

1. Uploaded holdings report.
2. Broker-provided values.
3. Historical price provider.
4. Manual user entry.
5. Accountant adjustment.

### Requirements

* Store source of market value.
* Store price date.
* Store currency.
* Store FX rate used.
* Flag missing values.
* Support non-trading-day rule in later phase.

## 12.7 FX Engine

### Sources

1. Broker-provided FX rate.
2. IRD-published rates.
3. Reserve Bank of New Zealand rates.
4. Other central bank rates.
5. Manual user entry.

### Supported Methods

* Broker-provided rate.
* Spot rate for date.
* Mid-month rate.
* End-of-month rate.
* Rolling 12-month average.
* Manual override.

### Requirements

* User selects FX policy.
* App applies policy consistently within calculation.
* Every converted amount stores FX source, method, and date.
* Missing FX rates are blocking errors for required values.
* App allows manual override with reason.

## 12.8 FIF Threshold Checker

### Requirements

* Calculate estimated cost of attributing FIF interests in NZD.
* Include all uploaded FIF-relevant holdings.
* Ask user to confirm outside holdings.
* Apply cost-tracking logic where needed.
* Identify whether threshold exceeded during the year.
* Output threshold status.

### Output States

* Likely under threshold based on uploaded data.
* Likely over threshold based on uploaded data.
* Cannot determine because historical data missing.
* Cannot determine because outside holdings not provided.
* Out of MVP scope / needs accountant review.

## 12.9 ASX Exemption Flagging

### Requirements

* Identify ASX holdings.
* Flag possible exemption.
* Allow user/accountant to mark as exempt or included.
* Exclude confirmed exempt holdings from FIF calculation.
* Include exempt dividends in ordinary overseas income summary.

## 12.10 FDR Calculation Engine

### Requirements

* Calculate 5% of opening market value.
* Detect quick-sale candidates.
* Calculate quick-sale adjustment.
* Produce investment-level and portfolio-level results.
* Store method version.

### FDR Output Fields

* Investment ID.
* Symbol.
* Opening quantity.
* Opening price.
* Opening value foreign currency.
* Opening value NZD.
* FDR base income.
* Quick-sale adjustment.
* Total FDR income.
* Warnings.

## 12.11 CV Calculation Engine

### Requirements

* Calculate opening market value.
* Calculate closing market value.
* Sum purchases.
* Sum sales proceeds.
* Sum dividends/distributions.
* Calculate CV return.
* Flag negative results and display taxable treatment clearly.
* Output investment-level and portfolio-level results.

### CV Output Fields

* Investment ID.
* Symbol.
* Opening value NZD.
* Closing value NZD.
* Purchases NZD.
* Sales proceeds NZD.
* Dividends NZD.
* CV income/loss.
* Taxable CV amount.
* Warnings.

## 12.12 Quick-Sale Worksheet

### Requirements

* Identify buy and sell transactions within the same income year.
* Match parcels using FIFO by default.
* Allow user/accountant review.
* Calculate peak holding method amount.
* Calculate quick-sale gain amount.
* Select the lesser adjustment.
* Export worksheet.

## 12.13 Method Comparison

### Requirements

* Show FDR and CV side by side.
* Show lower calculated amount.
* Warn user that method eligibility and consistency must be confirmed.
* Do not auto-file or declare final tax position.

## 12.14 Foreign Withholding Tax Summary

### Requirements

* Summarise foreign tax withheld by investment and country.
* Link tax withheld to dividend/income rows.
* Convert to NZD.
* Flag unmatched withholding tax.
* Warn about claim limitations.

\---

# 13\. Validation Dashboard

## 13.1 Blocking Errors

The app must block finalisation when any of the following exist:

* Missing tax year.
* Missing investment identifier.
* Missing FX rate for required value.
* Missing opening market value for FDR.
* Missing closing market value for CV.
* Unknown transaction type not reviewed.
* Negative holdings.
* Sell quantity exceeds available quantity.
* Unsupported product included in final calculation.
* Duplicate transaction likely affecting final amount.
* Missing manual confirmation for outside holdings.

## 13.2 Warnings

The app should warn but may allow finalisation with user acknowledgement:

* Low-confidence mapping.
* Possible duplicate transaction.
* Possible ASX exemption.
* Holdings mismatch.
* Possible stock split or corporate action.
* Money market fund transaction.
* Dividend date ambiguity.
* Manual market value used.
* FX policy differs from broker FX.
* Outside holdings not confirmed.
* Market price source is manual.
* Broker tax report differs from calculated result.

## 13.3 Informational Messages

The app should show:

* Rows excluded from calculation.
* Broker template used.
* FX policy used.
* Market value source.
* Calculation engine version.
* Report generated date.

## 13.4 Validation UX

* User can filter by severity.
* User can click issue and go to affected rows.
* User can resolve, ignore, or explain warnings.
* Blocking errors must be resolved before final PDF export.

\---

# 14\. Outputs and Reports

## 14.1 On-Screen Dashboard

The dashboard should show:

* Tax year.
* Brokers/files uploaded.
* Data quality score.
* Threshold status.
* Included holdings.
* Excluded holdings.
* Possible exempt holdings.
* FDR total.
* CV total.
* Quick-sale adjustment total.
* Lower calculated result.
* Warnings and blocking issues.
* Export readiness status.

## 14.2 PDF Report

The PDF report should include:

1. Cover page.
2. Disclaimer.
3. User assumptions and screening answers.
4. Source file manifest.
5. FIF threshold working.
6. Included and excluded investments.
7. FDR summary.
8. CV summary.
9. Quick-sale worksheet.
10. Foreign dividend/withholding tax summary.
11. Manual adjustments.
12. Validation issues.
13. Calculation version.
14. Appendix with investment-level details.

## 14.3 CSV Export Pack

The CSV export pack should include:

* `source\\\_file\\\_manifest.csv`
* `normalised\\\_transactions.csv`
* `holdings\\\_reconstruction.csv`
* `fif\\\_threshold\\\_working.csv`
* `fdr\\\_calculation\\\_lines.csv`
* `cv\\\_calculation\\\_lines.csv`
* `quick\\\_sale\\\_adjustments.csv`
* `foreign\\\_tax\\\_paid\\\_summary.csv`
* `validation\\\_issues.csv`
* `manual\\\_adjustments.csv`
* `fx\\\_rates\\\_used.csv`
* `market\\\_values\\\_used.csv`

## 14.4 Accountant Pack

Later phase:

* ZIP file containing PDF and all CSVs.
* Accountant review checklist.
* Client assumptions summary.
* Exception list.
* Data quality score.

\---

# 15\. Data Model

## 15.1 User

* user\_id
* email
* name
* residency\_country
* entity\_type
* created\_at
* deleted\_at
* consent\_flags

## 15.2 Portfolio

* portfolio\_id
* user\_id
* name
* base\_currency
* created\_at

## 15.3 TaxYear

* tax\_year\_id
* jurisdiction
* start\_date
* end\_date
* label

## 15.4 BrokerAccount

* broker\_account\_id
* portfolio\_id
* broker\_name
* account\_reference
* account\_currency

## 15.5 UploadedFile

* file\_id
* user\_id
* portfolio\_id
* broker\_account\_id
* file\_name
* file\_hash
* upload\_time
* file\_type\_detected
* file\_type\_confirmed
* row\_count
* status

## 15.6 SourceRow

* source\_row\_id
* file\_id
* row\_number
* raw\_json
* parse\_status
* warning\_flags

## 15.7 ColumnMapping

* mapping\_id
* file\_id
* source\_column
* canonical\_field
* confidence\_score
* user\_confirmed

## 15.8 Investment

* investment\_id
* symbol
* exchange
* isin
* cusip
* name
* country
* asset\_type
* currency
* fif\_relevant\_flag
* asx\_exemption\_status
* unsupported\_reason

## 15.9 Transaction

* transaction\_id
* source\_row\_id
* broker\_account\_id
* investment\_id
* transaction\_date
* settlement\_date
* source\_type
* mapped\_type
* quantity
* unit\_price
* gross\_amount
* fees
* tax\_withheld
* net\_amount
* currency
* fx\_rate\_to\_nzd
* amount\_nzd
* status

## 15.10 HoldingSnapshot

* holding\_snapshot\_id
* broker\_account\_id
* investment\_id
* as\_at\_date
* quantity
* market\_price
* market\_value
* currency
* fx\_rate\_to\_nzd
* market\_value\_nzd
* source\_type

## 15.11 FXRate

* fx\_rate\_id
* date
* from\_currency
* to\_currency
* rate
* source
* method
* imported\_at

## 15.12 MarketPrice

* market\_price\_id
* investment\_id
* price\_date
* currency
* close\_price
* source
* confidence\_score

## 15.13 ValidationIssue

* issue\_id
* severity
* issue\_type
* entity\_type
* entity\_id
* message
* resolution\_status
* user\_note

## 15.14 ManualAdjustment

* adjustment\_id
* entity\_type
* entity\_id
* field\_name
* old\_value
* new\_value
* reason
* adjusted\_by
* adjusted\_at

## 15.15 CalculationRun

* calculation\_run\_id
* portfolio\_id
* tax\_year\_id
* run\_time
* calculation\_version
* fx\_policy
* price\_policy
* status

## 15.16 FDRCalculationLine

* calculation\_line\_id
* calculation\_run\_id
* investment\_id
* opening\_value\_nzd
* base\_fdr\_income\_nzd
* quick\_sale\_adjustment\_nzd
* total\_fdr\_income\_nzd
* warnings

## 15.17 CVCalculationLine

* calculation\_line\_id
* calculation\_run\_id
* investment\_id
* opening\_value\_nzd
* closing\_value\_nzd
* purchases\_nzd
* sales\_nzd
* dividends\_nzd
* cv\_income\_nzd
* taxable\_cv\_income\_nzd
* warnings

## 15.18 QuickSaleLine

* quick\_sale\_line\_id
* calculation\_run\_id
* investment\_id
* buy\_transaction\_id
* sell\_transaction\_id
* quantity
* cost\_nzd
* proceeds\_nzd
* dividends\_nzd
* gain\_method\_amount\_nzd
* peak\_method\_amount\_nzd
* selected\_amount\_nzd

\---

# 16\. Calculation Workflow

## 16.1 Normalisation Step

1. Load raw rows.
2. Detect file type.
3. Map columns.
4. Convert dates.
5. Standardise symbols and exchanges.
6. Standardise currencies.
7. Classify transaction type.
8. Convert quantities and amounts.
9. Link income/tax rows to investments.
10. Generate validation issues.

## 16.2 Holdings Step

1. Load opening holdings if available.
2. Reconstruct holdings from transactions.
3. Compare reconstructed and uploaded holdings.
4. Apply manual corrections.
5. Create final holdings table.

## 16.3 FX Step

1. Determine FX policy.
2. Use broker FX where selected/available.
3. Use approved rate source where configured.
4. Convert every relevant amount.
5. Store rate source.
6. Flag missing rates.

## 16.4 Threshold Step

1. Identify FIF-relevant investments.
2. Exclude confirmed exempt investments.
3. Calculate cost in NZD.
4. Track cost through the year.
5. Determine whether threshold was exceeded.
6. Output threshold result.

## 16.5 FDR Step

1. Get opening market values in NZD.
2. Calculate 5% base income.
3. Identify same-year buy-and-sell activity.
4. Calculate quick-sale adjustment.
5. Sum by investment and portfolio.
6. Output FDR report.

## 16.6 CV Step

1. Get opening value.
2. Get closing value.
3. Sum purchases.
4. Sum sales.
5. Sum dividends.
6. Apply CV formula.
7. Display taxable result and losses clearly.
8. Output CV report.

## 16.7 Method Comparison Step

1. Check method availability warnings.
2. Compare FDR and CV totals.
3. Show lower calculated amount where applicable.
4. Display caveats.
5. Generate report.

\---

# 17\. UX Requirements

## 17.1 Key Screens

1. Landing page.
2. Start calculation.
3. Tax year selection.
4. Screening questions.
5. Upload files.
6. File preview.
7. Broker detection result.
8. Column mapping wizard.
9. Data validation dashboard.
10. Holdings reconciliation.
11. Missing data entry.
12. FIF threshold result.
13. FDR/CV calculation page.
14. Quick-sale worksheet page.
15. Method comparison page.
16. Report export page.
17. Data deletion/settings page.

## 17.2 UI Principles

* Calm and trustworthy.
* Simple language first.
* Technical detail expandable.
* Show confidence scores.
* Never hide assumptions.
* Make errors actionable.
* Encourage accountant review for complex cases.

## 17.3 UX Copy Examples

### Warning Example

> We found 14 transactions that look like corporate actions or transfers. These may affect your FIF calculation. Please review them before finalising your report.

### Method Warning Example

> We can calculate FDR and CV from your data, but method eligibility depends on your personal situation and the type of investment. This tool prepares a working paper, not tax advice.

### Missing Data Example

> We could not find a 1 April opening market value for VOO. Upload a holdings report, use historical price lookup, or enter the value manually.

\---

# 18\. Technical Approach, Tech Stack Options, and App Feasibility

## 18.1 Technical Goals

The technology stack should support:

* fast MVP development;
* reliable CSV/XLSX parsing;
* deterministic tax calculations;
* large-file handling;
* privacy-sensitive financial data processing;
* PDF and CSV report generation;
* audit trail and traceability;
* future support for multiple brokers and possibly Australia.

The most important technical principle is:

> AI can assist with mapping and explanations, but final tax calculations must be deterministic, versioned, and testable.

\---

## 18.2 Recommended Architecture Pattern

Use a layered architecture:

1. **Frontend/UI layer** — upload, preview, mapping, validation, report view.
2. **Parsing layer** — CSV/XLSX parsing, broker template detection, column mapping.
3. **Canonical ledger layer** — normalised transactions, holdings, FX, dividends, validation issues.
4. **Calculation engine** — FDR, CV, threshold, quick-sale adjustment.
5. **Reporting layer** — PDF, CSV export pack, audit manifest.
6. **Storage layer** — optional accounts, files, source rows, reports, calculation runs.

This separation matters because broker formats will change, but the calculation engine must remain stable and testable.

\---

## 18.3 Web vs Native App Feasibility

## 18.3.1 Can Users Upload Broker CSV/XLSX Files from Mobile?

Yes, technically. Both major mobile platforms allow a user to select files through system file pickers:

* iOS can import or open documents through the document picker / Files app model.
* Android can open user-selected files through the Storage Access Framework.
* Cross-platform app frameworks such as Expo, Capacitor, and Flutter have document/file picker support.

The practical constraint is not whether the app can import a file. The practical constraint is whether the user can easily obtain the broker CSV/XLSX file on the phone in the first place.

## 18.3.2 Mobile Download Reality

Broker CSV/XLSX download workflows vary:

* Some brokers expose reports clearly in the mobile app.
* Some require desktop web to access full reports.
* Some send CSV/XLSX reports by email.
* Some export files into Downloads, iCloud Drive, Google Drive, OneDrive, or Files.
* Some only provide PDFs for certain reports.
* Some reports are easier to generate on desktop because date range, tax year, and report options are complex.

Therefore, the product should not assume mobile-only completion for MVP. It should support mobile upload, but the core workflow should remain strong on desktop web.

## 18.3.3 App Store / Play Store Feasibility

A FIF calculator app can be published to App Store and Google Play, but the following requirements and risks must be planned:

### App Store Considerations

* App must have enough native or app-specific functionality; a thin webview wrapper may be rejected or reviewed poorly.
* App must include a privacy policy URL and disclose data practices.
* App must be clear about business model and paid functionality.
* If selling digital app functionality inside iOS, Apple payment rules may apply unless the transaction qualifies as an external professional/tax preparation service. This should be reviewed before implementation.
* App should include clear disclaimers that it is not tax advice.

### Google Play Considerations

* Apps with financial features must complete Google Play’s financial features declaration.
* The app must comply with local regulations and include required disclosures for targeted countries.
* Google Play policy indicates tax preparation/filing assistance should not use Google Play Billing, but this must be confirmed for the exact monetisation model.
* App must complete data safety/privacy disclosures.

## 18.3.4 Feasibility Rating

|Option|Feasibility|Recommendation|
|-|-:|-|
|Desktop/mobile responsive web app|Very high|Build first|
|PWA installable web app|High|Add early if low effort|
|App wrapper using Capacitor|Medium-high|Good after MVP if app-store presence matters|
|React Native / Expo app|Medium-high|Good if native UX becomes important|
|Flutter app|Medium|Good for full native cross-platform build, but heavier if web already exists|
|Fully native Swift + Kotlin|Low for MVP|Too expensive and unnecessary early|

## 18.3.5 Recommended Mobile Strategy

Recommended path:

1. Build the core platform as a mobile-responsive web app.
2. Ensure upload works on mobile browsers using standard file input.
3. Add clear broker-specific instructions: “Download file → Save to Files/Downloads → Upload here”.
4. Add PWA install support so users can save it to home screen.
5. After beta validation, wrap the web app in Capacitor or build a lightweight React Native shell.
6. Add native document picker and share-sheet import.
7. Submit to App Store / Google Play only after the app has enough native value and stable calculation flow.

## 18.3.6 Mobile UX Requirements

Mobile UI should support:

* upload from Files/Downloads/Cloud Drive;
* camera-free file workflow first;
* progress indicator for uploads;
* simple file checklist by broker;
* “email me upload link” option for users who downloaded files on desktop;
* “continue on desktop” option;
* PDF download and share;
* report email/export;
* small-screen validation summary, with detailed row review better on desktop/tablet.

## 18.3.7 Native App Features Worth Building Later

Native app should only be built if it adds real value beyond the web app. Useful native features:

* document picker with CSV/XLSX filters;
* share-sheet import from Files, Gmail, Drive, OneDrive, iCloud;
* secure local report storage;
* biometric unlock;
* push reminders before tax deadlines;
* offline viewing of generated reports;
* mobile scan/upload for supporting PDFs later;
* app-store trust and discoverability.

Native app should not be only a webview wrapper with no extra function.

\---

## 18.4 Stack Option A — Fastest Solo MVP

**Best for:** Proving the idea quickly with one broker and one calculation flow.

|Layer|Recommended choice|
|-|-|
|Frontend|Next.js + React + Tailwind|
|File parsing|PapaParse for CSV, SheetJS for XLSX|
|Backend|Next.js API routes / server actions|
|Database|Supabase Postgres|
|Auth|Supabase Auth|
|File storage|Supabase Storage|
|PDF generation|Playwright PDF or React PDF|
|Hosting|Vercel|
|Payments|Stripe|

### Pros

* Fastest path to a polished web app.
* Single JavaScript/TypeScript codebase.
* Easy deployment.
* Supabase provides Postgres, auth, and storage in one platform.
* Good for founder-led MVP and quick iteration.

### Cons

* Heavy tax/calculation logic in TypeScript may be less natural than Python for data processing.
* Large CSV/XLSX processing may hit serverless/runtime limits if not designed carefully.
* Less ideal for heavy batch processing unless background jobs are added.
* Complex report generation can become messy inside a full-stack frontend app.

### Recommendation

Good for a prototype or first private beta, especially if the first broker file is simple and data volume is modest.

\---

## 18.5 Stack Option B — Python Calculation Engine MVP

**Best for:** Accurate data processing, testable calculations, and future accountant-grade reliability.

|Layer|Recommended choice|
|-|-|
|Frontend|Next.js + React + Tailwind|
|File parsing preview|Browser-side PapaParse / SheetJS|
|Backend API|Python FastAPI|
|Data processing|Pandas or Polars|
|Calculation engine|Python package/module with unit tests|
|Database|PostgreSQL|
|File storage|S3-compatible object storage|
|Background jobs|Celery/RQ/Dramatiq + Redis, or cloud task queue|
|PDF generation|WeasyPrint, ReportLab, or Playwright|
|Hosting|Render/Fly.io/Railway/AWS/GCP/Azure|
|Payments|Stripe|

### Pros

* Python is stronger for CSV/XLSX processing, financial calculations, and test suites.
* Easier to build deterministic calculation modules with golden test cases.
* Better fit for accountant-reviewed calculation logic.
* Can scale from MVP to production with background workers.
* Clean separation between UI and tax engine.

### Cons

* More moving parts than an all-in-one Next.js app.
* Requires API design between frontend and backend.
* Deployment is slightly more complex.
* Two-language stack: TypeScript frontend + Python backend.

### Recommendation

Best overall choice for this product if accuracy and auditability matter more than absolute speed of MVP delivery.

\---

## 18.6 Stack Option C — Privacy-First Browser-Heavy MVP

**Best for:** Users who are reluctant to upload financial data to a server.

|Layer|Recommended choice|
|-|-|
|Frontend|React / Next.js static app|
|File parsing|Browser-side PapaParse and SheetJS|
|Calculation engine|TypeScript running in browser, optionally Web Worker|
|Storage|Local browser storage or no storage|
|PDF generation|Browser-side jsPDF / React PDF|
|Hosting|Static hosting: Vercel, Netlify, Cloudflare Pages|
|Backend|Minimal or none for free calculator|

### Pros

* Strong privacy story: files can stay in the browser.
* Lower hosting and compliance burden.
* Simple free calculator can be cheap to operate.
* Good marketing message for financial data privacy.

### Cons

* Harder to support paid report control unless server-side report generation is added.
* Browser memory/performance limits for large files.
* Harder to save audit trails or multi-year history.
* Harder to guarantee consistent PDF output across devices.
* Calculation code is exposed client-side.

### Recommendation

Good for a free threshold checker or lightweight proof of concept. Less ideal for paid accountant-grade reports unless combined with server-side finalisation.

\---

## 18.7 Stack Option D — Low-Code / No-Code Prototype

**Best for:** Validating workflow and demand before custom engineering.

|Layer|Possible choice|
|-|-|
|UI|Retool, Bubble, Glide, Softr, Appsmith|
|Data|Airtable, Supabase, Google Sheets, PostgreSQL|
|Parsing|Make/Zapier scripts, Python scripts, cloud functions|
|Reports|Google Docs templates, PDFMonkey, DocRaptor|
|Payments|Stripe links|

### Pros

* Very fast to create clickable demos.
* Useful for accountant/user interviews.
* Can test pricing and report layouts before building full app.
* Lower initial engineering cost.

### Cons

* Not ideal for complex file parsing.
* Hard to implement robust FIF calculations and audit trail.
* Scalability and security limitations.
* Risk of rebuilding from scratch later.
* Less suitable for sensitive financial data.

### Recommendation

Useful for demoing the user journey and report output, but not recommended for the real calculation product.

\---

## 18.8 Stack Option E — Enterprise / Accountant-Grade Production Stack

**Best for:** Later-stage product with accountants, client workspaces, multi-year storage, and higher compliance expectations.

|Layer|Recommended choice|
|-|-|
|Frontend|Next.js / React|
|Backend|Python FastAPI or Django|
|Data processing|Polars/Pandas + dedicated worker services|
|Database|Managed PostgreSQL|
|Object storage|AWS S3 / Azure Blob / Google Cloud Storage|
|Queue|AWS SQS / Celery / Cloud Tasks|
|Auth|Auth0, Clerk, Supabase Auth, or custom enterprise SSO later|
|Logging/monitoring|Sentry, OpenTelemetry, Datadog/Grafana|
|Hosting|AWS / Azure / GCP, with NZ/AU data-region review|
|PDF|Server-side deterministic PDF generation|
|Security|Encryption, audit logs, role-based access, retention controls|

### Pros

* Strongest long-term architecture.
* Good fit for accountants and sensitive financial data.
* Better control over data retention, audit logs, and background jobs.
* Easier to add role-based access and client workspaces.

### Cons

* Higher cost and complexity.
* Slower to build.
* Requires stronger DevOps capability.
* Overkill for first MVP.

### Recommendation

Not required for initial MVP, but useful as the direction once paid usage or accountant workflows are proven.

\---

## 18.9 Frontend Options

|Option|Pros|Cons|Fit|
|-|-|-|-|
|Next.js + React|Full-stack capable, strong ecosystem, good deployment options, SEO-friendly landing pages|Can become complex if backend logic grows too much|Best default|
|Vite + React|Simpler frontend, fast dev experience, good for browser-heavy app|Needs separate backend/API setup|Good for privacy-first/browser-heavy version|
|Vue / Nuxt|Clean developer experience, good full-stack framework|Smaller hiring/community pool than React in many markets|Good if developer prefers Vue|
|SvelteKit|Very fast and elegant, less boilerplate|Smaller ecosystem and hiring pool|Good for small expert team|
|Plain HTML + Tailwind|Very simple landing/demo|Not enough for complex app workflow|Only for static marketing/demo|

\---

## 18.10 Backend Options

|Option|Pros|Cons|Fit|
|-|-|-|-|
|Python FastAPI|Fast to build APIs, excellent for typed endpoints, strong with Pandas/Polars, good testability|Requires separate frontend/backend deployment|Best for calculation-heavy MVP|
|Django|Batteries-included admin/auth/ORM, mature, good for account management|Heavier than FastAPI, less lightweight for pure APIs|Good if accountant portal/admin is early|
|Node.js / NestJS|TypeScript end-to-end, structured backend, good for teams already in JS|Python still better for data-heavy parsing/calculation|Good if team is TypeScript-heavy|
|Next.js API only|Simple single-stack MVP|Can become awkward for long jobs and data-heavy processing|Good for prototype, not ideal long term|
|Serverless functions|Low ops, scales automatically|Runtime/file-size/time limits can hurt large CSV processing|Good for small tasks, not core parser|

\---

## 18.11 Data Processing Options

|Option|Pros|Cons|Fit|
|-|-|-|-|
|Pandas|Mature, familiar, huge ecosystem|Can be memory-heavy for large files|Good MVP/default|
|Polars|Fast, memory-efficient, strong for large data|Smaller ecosystem than Pandas|Strong choice for large broker files|
|DuckDB|Excellent for local analytical processing and large CSVs|Less conventional as app processing layer|Useful for heavy imports/reconciliation|
|TypeScript arrays/objects|Simple for small files|Weak for large files and complex data transformations|Only for browser MVP/simple parser|
|SQL transformations|Auditable and persistent|Less flexible for messy file parsing|Good after normalisation|

\---

## 18.12 Database and Storage Options

|Option|Pros|Cons|Fit|
|-|-|-|-|
|Supabase Postgres|Fast setup, managed Postgres, auth, storage, row-level security|Platform coupling, may need migration later for enterprise setup|Best for MVP speed|
|Neon Postgres|Serverless Postgres, developer-friendly branching|Need separate auth/storage|Good if using Clerk/Auth0|
|Managed PostgreSQL on AWS/Azure/GCP|Production-grade, flexible|More setup and operations|Best long-term|
|SQLite|Very simple, local/dev friendly|Not suitable for multi-user production|Local prototype only|
|Firebase/Firestore|Fast app development, realtime|Less natural for relational financial ledger|Not recommended for core ledger|

For this product, a relational model is important because calculations need traceability across users, files, source rows, investments, transactions, holdings, FX rates, validation issues, and calculation runs. PostgreSQL is the best default.

\---

## 18.13 File Parsing and Upload Options

|Option|Pros|Cons|Fit|
|-|-|-|-|
|Browser parsing with PapaParse/SheetJS|Fast preview, privacy-friendly, reduces backend load|Browser memory limits, inconsistent handling for very large files|Good for preview/mapping|
|Backend parsing with Python|Reliable, testable, better for large files|Requires upload to server|Best for final import/calculation|
|Hybrid parsing|Preview in browser, final processing in backend|More engineering effort|Recommended|
|Direct broker API|Smooth UX once available|Hard to support across brokers, API access may be limited|Later phase|
|PDF extraction|Supports hard-to-export brokers|Error-prone and expensive to validate|Later, only for selected formats|

Recommended approach:

> Browser preview + backend final parse and calculation.

\---

## 18.14 PDF and Report Generation Options

|Option|Pros|Cons|Fit|
|-|-|-|-|
|Playwright PDF from HTML|High visual fidelity, same layout as web report|Requires browser runtime/server resources|Strong option|
|WeasyPrint|Good HTML/CSS to PDF, Python-friendly|CSS support differences vs browser|Good Python backend option|
|ReportLab|Very deterministic, powerful for structured PDFs|More manual layout work|Good for accountant-grade reports|
|jsPDF / React PDF|Can run client-side or Node-side|Complex tables can be painful|Good for simple MVP reports|
|DocRaptor/PDFMonkey|Outsourced PDF rendering|External dependency and ongoing cost|Good if report polish matters early|

Recommendation:

* MVP: Playwright PDF or WeasyPrint.
* Accountant-grade later: ReportLab or carefully controlled HTML-to-PDF pipeline.

\---

## 18.15 Hosting Options

|Option|Pros|Cons|Fit|
|-|-|-|-|
|Vercel|Excellent for Next.js, fast deployment, strong DX|Serverless constraints for heavy jobs|Best frontend host|
|Render|Easy full-stack hosting, supports backend workers|Less enterprise-grade than major clouds|Good MVP backend|
|Fly.io|Good app hosting close to users, supports containers|More DevOps knowledge needed|Good for FastAPI backend|
|Railway|Very fast MVP deployment|Cost/control considerations as usage grows|Good early prototype|
|AWS|Most flexible and scalable|More complex|Best long-term production|
|Azure|Enterprise-friendly, good if using Microsoft ecosystem|More setup|Good long-term/B2B|
|GCP|Strong data/cloud services|More setup|Good long-term|
|Cloudflare Pages/Workers|Fast global edge, low cost|Workers not ideal for Python/data-heavy jobs|Good static/privacy-first frontend|

\---

## 18.16 Authentication and Payments Options

|Area|Option|Pros|Cons|
|-|-|-|-|
|Auth|Supabase Auth|Integrated with Postgres, quick setup|Less flexible than dedicated auth vendors|
|Auth|Clerk|Excellent developer experience, polished UI|Extra vendor and cost|
|Auth|Auth0|Enterprise-ready, SSO support|More complex/costly|
|Auth|NextAuth/Auth.js|Flexible, self-managed|More engineering responsibility|
|Payments|Stripe|Best default for subscriptions and one-off payments|Requires setup, tax/GST handling decisions|
|Payments|Paddle / Lemon Squeezy|Merchant-of-record style options|Less flexible in some regions/use cases|

Recommendation:

* MVP: Supabase Auth or Clerk + Stripe.
* Accountant/B2B later: Auth0 or Clerk with organisation/workspace support.

\---

## 18.17 AI Usage Options

|Use case|Should use AI?|Notes|
|-|-|-|
|Column mapping suggestions|Yes|Good for messy broker exports. User must confirm.|
|Transaction classification|Yes, cautiously|Useful for descriptions, but unknown/low-confidence rows need review.|
|Explaining warnings|Yes|Good UX improvement.|
|Tax calculation|No|Must be deterministic code.|
|Method eligibility decision|No|Should be rules + warnings + accountant review.|
|Report wording|Yes|Can help generate plain-English explanations, but calculations remain fixed.|

\---

## 18.18 Recommended Stack by Stage

## Stage 0 — Prototype / Demo

|Layer|Recommendation|
|-|-|
|Frontend|Next.js or Vite React|
|Parsing|Browser PapaParse/SheetJS|
|Calculation|TypeScript or Python notebook prototype|
|Storage|None or local files|
|Report|Simple HTML/PDF|

Use this to validate workflow and sample files.

## Stage 1 — Real MVP

|Layer|Recommendation|
|-|-|
|Frontend|Next.js + React + Tailwind|
|Backend|Python FastAPI|
|Processing|Pandas first, Polars if large files become important|
|Database|Supabase Postgres or managed PostgreSQL|
|Storage|Supabase Storage or S3-compatible storage|
|Background jobs|RQ/Celery/Dramatiq + Redis, or managed task queue|
|PDF|Playwright PDF or WeasyPrint|
|Hosting|Vercel frontend + Render/Fly.io backend, or all-in-one cloud deployment|
|Payments|Stripe|

This is the recommended stack for the first serious beta.

## Stage 2 — Paid Production

|Layer|Recommendation|
|-|-|
|Frontend|Next.js|
|Backend|FastAPI services or Django if admin/accountant portal becomes central|
|Processing|Polars/Pandas workers|
|Database|Managed PostgreSQL|
|Storage|S3/Azure Blob/GCS with lifecycle policies|
|Queue|Managed queue or Celery with Redis|
|Monitoring|Sentry + structured logs|
|Security|Audit logs, retention controls, role-based access|
|PDF|Server-side deterministic PDF pipeline|

## Stage 3 — Accountant / B2B Platform

|Layer|Recommendation|
|-|-|
|Auth|Organisation/workspace-aware auth: Clerk/Auth0/custom|
|Backend|FastAPI or Django modular services|
|Database|Managed PostgreSQL with strong backup strategy|
|Storage|Cloud object storage with encryption and retention controls|
|Reporting|Versioned report templates and accountant review workflow|
|Compliance|Data retention settings, audit logs, access logs, export/delete tools|

\---

## 18.19 Mobile App Tech Options

|Option|Pros|Cons|Recommendation|
|-|-|-|-|
|PWA|One codebase, fast to ship, installable to home screen, no app review|Weaker App Store discovery, limited native integration|Add early|
|Capacitor wrapper|Reuses web app, can publish to stores, supports native plugins|Risk of being too webview-like unless native value is added|Best first app-store path|
|React Native / Expo|Better native UX, document picker support, strong ecosystem|More work than web/PWA, may duplicate UI|Good if mobile usage is high|
|Flutter|Strong cross-platform UI, file picker support, good performance|Separate Dart stack, more rewrite if web exists|Consider only if mobile-first team prefers Flutter|
|Native Swift + Kotlin|Best platform-native UX|Highest cost, duplicate development|Not recommended for MVP|

Recommended app-store path:

> Build responsive web → add PWA → validate mobile usage → add Capacitor/React Native shell with native document picker and share-sheet import → submit to stores.

## 18.20 App Store / Play Store Scope Requirements

If publishing mobile apps, the product must include:

* privacy policy URL;
* data collection and data safety disclosures;
* clear tax disclaimer;
* support/contact URL;
* test account for app review if login is required;
* explanation of financial/tax functionality in review notes;
* Google Play financial features declaration;
* data deletion flow;
* clear payment model and platform-compliant checkout;
* document picker permission handling;
* secure file handling and upload progress.

App Store / Play Store app should include at least one or more native-value features:

* native document picker;
* share-sheet import;
* secure local report viewer;
* biometric lock;
* push reminder;
* offline report access.

## 18.21 Final Tech Recommendation

Best balanced choice for core platform:

> \\\*\\\*Next.js frontend + Python FastAPI backend + PostgreSQL + Python calculation engine + server-side PDF generation.\\\*\\\*

Best channel strategy:

> \\\*\\\*Responsive web first, PWA second, app-store mobile app third.\\\*\\\*

Why:

* Next.js gives a polished web app and good deployment path.
* Python is better for messy CSV/XLSX processing and deterministic tax calculations.
* PostgreSQL fits the relational audit trail.
* FastAPI keeps the backend lightweight and testable.
* Server-side report generation gives consistent accountant-friendly PDFs.

Avoid for MVP:

* Full no-code build for real calculations.
* Pure serverless-only backend for large files.
* Firebase/Firestore as the core ledger database.
* AI-driven tax calculations.
* Native-only mobile build before web workflow is validated.
* Thin app-store webview wrapper with no native value.
* Building Australia support into the initial architecture beyond keeping the tax engine modular.

\---

# 19\. Non-Functional Requirements

## 19.1 Performance

* Upload and preview a 10,000-row CSV within acceptable user-facing time.
* Process 100,000 transaction rows through background job if needed.
* Show progress for long imports.
* Avoid freezing the browser during large-file parsing.

## 19.2 Reliability

* Same inputs and settings must produce the same result.
* Calculation engine must be versioned.
* Failed imports must not create partial final calculations.
* Raw source data must be preserved until user deletion or session expiry.

## 19.3 Security

* HTTPS only.
* Encrypt files at rest where stored.
* Encrypt data in transit.
* Restrict access by user account.
* Log access to sensitive files in account mode.
* Support data deletion requests.

## 19.4 Maintainability

* Broker parsers should be modular.
* Canonical ledger should be broker-neutral.
* Tax rules should be versioned.
* Unit tests should cover known examples and edge cases.
* Golden test cases should be accountant-reviewed.

## 19.5 Explainability

* Every calculated number must trace back to source rows, manual inputs, or assumptions.
* User should be able to drill from summary total to investment line to source row.
* AI suggestions must not be used directly in final calculations without confirmation.

\---

# 20\. MVP Acceptance Criteria

The MVP is successful when:

1. User can upload CSV/XLSX files from at least one supported broker.
2. App maps core transaction and holding fields with user review.
3. App normalises buy, sell, dividend, fee, tax, FX, and holding rows.
4. App reconstructs holdings or accepts manual holdings.
5. App calculates NZD opening and closing values.
6. App calculates FDR income.
7. App calculates CV income.
8. App calculates quick-sale adjustments for common cases.
9. App produces a threshold working.
10. App flags ASX holdings for exemption review.
11. App generates PDF and CSV working papers.
12. App stores calculation assumptions and manual edits.
13. Same data and settings produce the same result.
14. Beta users can complete a real calculation without spreadsheet work outside the app except for missing data entry.
15. Accountant-reviewed benchmark cases reconcile within agreed tolerance.
16. Web app works on desktop, tablet, and mobile browsers.
17. Mobile users can upload CSV/XLSX files from Files/Downloads/Cloud Drive where the mobile browser supports file selection.
18. Users can choose “continue on desktop” or email themselves an upload/report link when the mobile workflow is inconvenient.

Native iOS/Android app acceptance criteria are future-phase only.

\---

# 21\. Development Roadmap

## Phase 0 — Research and Sample Files

**Goal:** Build confidence before coding too much.

* Collect real sample CSV/XLSX files from 10–20 users.
* Include Sharesies, Hatch, IBKR, Stake if possible.
* Create anonymisation process.
* Confirm formulas with accountant.
* Define canonical data model.
* Build golden test cases.

## Phase 1 — Core Calculator Prototype

**Goal:** Validate calculation engine.

* Manual input FDR calculator.
* Manual input CV calculator.
* Quick-sale worksheet prototype.
* Threshold checker prototype.
* Basic PDF output.

## Phase 2 — One-Broker MVP

**Goal:** Prove CSV-to-report workflow.

Recommended first broker: Sharesies or Hatch.

* Upload parser.
* Broker template.
* Column mapping.
* Holdings import.
* Transaction import.
* FDR/CV report.
* User validation dashboard.

## Phase 3 — Two-Broker Beta

**Goal:** Prove differentiation from broker-native reports.

* Add second broker.
* Consolidate across brokers.
* Handle duplicate/transfer warnings.
* Improve accountant export.
* Add paid report export.

## Phase 4 — Advanced Broker Support

**Goal:** Reach higher-value users.

* Add IBKR Flex Query template.
* Add Stake XLSX support.
* Add Tiger/Moomoo generic imports.
* Add better FX and price automation.

## Phase 4.5 — Mobile Web / PWA Readiness

**Goal:** Make the web app usable on mobile before investing in app-store publishing.

* Mobile-responsive upload workflow.
* Mobile file picker testing on iOS Safari and Android Chrome.
* Broker-specific mobile download instructions.
* PWA manifest and home-screen install support.
* Mobile PDF download/share testing.
* “Continue on desktop” email link.

## Phase 5 — Paid Launch

**Goal:** Commercialise.

* Free threshold check.
* Paid PDF/CSV report export.
* Saved portfolio option.
* Support workflow.
* Feedback loop with accountant reviewers.

## Phase 5.5 — App Store / Google Play Feasibility Build

Only start this after web/PWA usage shows meaningful mobile demand.

* Decide between Capacitor wrapper and React Native/Expo shell.
* Add native document picker.
* Add share-sheet import.
* Add secure local report viewer.
* Add privacy/data safety disclosures.
* Prepare App Store and Google Play metadata.
* Complete Google Play financial features declaration.
* Run TestFlight/internal testing.

## Phase 6 — Advanced NZ Features

* Cost method support.
* Revenue Account Method screening/support.
* Better corporate actions.
* Historical price API.
* IRD disclosure helper.
* Accountant portal.

## Phase 7 — Australia Discovery

Only start after NZ traction.

* Research AU foreign income, CGT, FX, FITO workflows.
* Validate market demand.
* Reuse CSV parser and ledger engine.
* Build separate AU tax engine.

\---

# 22\. Success Metrics

## 22.1 Product Metrics

* Upload-to-calculation completion rate.
* Percentage of rows auto-classified correctly.
* Number of manual corrections per file.
* Percentage of users who resolve validation issues.
* Average time from upload to report preview.
* PDF/CSV export conversion rate.

## 22.2 Accuracy Metrics

* Match accountant-reviewed benchmark cases.
* Match IRD calculator for simple manual test cases.
* No unexplained difference in FDR/CV totals.
* 100% source traceability for each calculation line.

## 22.3 Business Metrics

* Free threshold checker usage.
* Paid report conversion.
* Repeat users next tax year.
* Accountant referrals.
* Support tickets per completed calculation.

## 22.4 Community Metrics

* Feedback from PersonalFinanceNZ / investing communities.
* Number of sample broker files contributed.
* Number of broker templates validated by users.

\---

# 23\. Monetisation

## 23.1 Recommended Starting Model

> Free threshold check + paid FIF report export.

## 23.2 Pricing Options

|Tier|Features|
|-|-|
|Free|Threshold check, upload preview, limited calculation preview|
|One-off report|One income year PDF/CSV export|
|Individual annual|Multiple brokers, saved portfolio, multi-year carry forward|
|Accountant|Client workspace, bulk upload, branded reports, review workflow|

\---

# 24\. Risks and Mitigations

|Risk|Impact|Mitigation|
|-|-:|-|
|Incorrect tax output|Very high|Accountant validation, unit tests, calculation versioning, disclaimers|
|Oversimplified FIF rules|High|Clear scope, warnings, advanced/out-of-scope paths|
|Broker CSV formats vary|High|Broker templates + mapping wizard + sample library|
|Incomplete uploads|High|Screening questions and outside-holdings warnings|
|Missing market prices|High|Manual value entry, price upload, future API lookup|
|Quick-sale complexity|High|Transparent worksheet and test cases|
|Corporate actions|Medium|Detect and flag; manual adjustment in MVP|
|Privacy concerns|High|Session mode, encryption, data deletion|
|Existing competitors|Medium|Focus on simple year-end CSV-to-report workflow, not portfolio tracking|
|User assumes tax advice|High|Strong disclaimer and accountant-review prompts|
|Multi-broker transfer duplication|Medium|Transfer detection and reconciliation workflow|
|FX policy disputes|Medium|Store FX source/method and allow accountant override|
|Mobile users cannot find downloaded broker files|Medium|Broker-specific mobile instructions, Files/Downloads upload help, continue-on-desktop option|
|App Store rejection for thin wrapper|Medium|Add native document picker/share-sheet/report viewer; avoid pure webview app|
|Play Store financial policy issue|Medium|Complete financial features declaration and include local disclosures|
|Mobile payment policy complexity|Medium|Prefer web-first checkout initially; review Apple/Google payment rules before in-app purchases|

\---

# 25\. Open Questions

1. Which broker should be first: Sharesies or Hatch?
2. Can enough real CSV/XLSX examples be collected for parser testing?
3. Should the app use broker FX rates by default or an IRD/RBNZ rate policy by default?
4. How should market prices be sourced in MVP?
5. Should users be allowed to finalise with manual values?
6. What warning severity should prevent report export?
7. How much accountant validation is needed before paid launch?
8. Should the app include Revenue Account Method education from day one but block calculation?
9. Should the app support joint ownership threshold logic in MVP?
10. How should the app deal with partial broker transfers?
11. What is the right legal disclaimer wording?
12. Should original source files be stored or processed ephemerally by default?
13. Should the app provide a sample broker export guide for each supported broker?
14. Should the app reconcile against broker-provided FIF reports where available?
15. What percentage of target users will complete the flow on mobile versus desktop?
16. Which brokers allow report download easily from mobile apps or mobile browsers?
17. Should native mobile app be a companion app or full calculation app?
18. Should paid report export be purchased on web only, in-app only, or both?
19. What native app features are enough to justify App Store / Play Store release?
20. Should the native app support offline report viewing or offline calculation?

\---

# 27\. Final Recommendation

Start narrow and practical:

> Build the best NZ year-end CSV/XLSX-to-FIF working-paper generator for one or two brokers first.

Recommended MVP wedge:

1. Sharesies or Hatch first.
2. FDR + CV + quick-sale adjustment.
3. Threshold checker.
4. PDF/CSV export pack.
5. Manual correction and audit trail.
6. Accountant validation before paid launch.
7. Mobile-responsive web support from day one.
8. PWA/app-store mobile app only after the CSV workflow is proven.

Do not start with Australia, every broker, direct IRD filing, every FIF method, full portfolio tracking, or native-only mobile development. The best first product is a reliable web-first workflow that removes the most painful manual work from NZ FIF preparation, while keeping the door open for App Store and Google Play distribution later.



