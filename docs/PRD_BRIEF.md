# FIF Calculator App – Product Requirements Document

**Version:** 1.2  
**Date:** 20 May 2026  
**Owner:** Amy  
**Market:** New Zealand first  
**Product type:** Mobile-responsive web app first; optional App Store / Google Play mobile app later  
**Primary goal:** Help NZ investors upload broker files and generate reviewable FIF taxable income working papers for IR3/accountant review.  
**Future expansion:** App Store / Google Play app after web workflow is validated; Australia only after NZ product proves demand, accuracy, and commercial viability.

\---

# Part A — Brief PRD

## A1. Product Summary

Build a free / freemium web app that helps New Zealand investors calculate Foreign Investment Fund income from overseas shares, ETFs, and foreign funds by uploading broker CSV/XLSX files instead of manually entering every transaction into IRD’s calculator or building spreadsheets manually.

The app should:

1. Accept broker files in different formats.
2. Detect broker, file type, and relevant columns.
3. Convert raw broker rows into a normalised transaction and holdings ledger.
4. Calculate FIF income using supported methods.
5. Generate a transparent, accountant-friendly FIF working paper.

The app should not provide tax advice or lodge directly with IRD. It should produce a reviewable working paper based on uploaded data, user confirmations, and clearly stated assumptions.

\---

## A2. Product Positioning

### Short Positioning

> Upload your broker files. Review the detected data. Generate your NZ FIF working paper.

### Longer Positioning

A simple year-end tax tool for NZ investors who hold overseas shares, ETFs, or foreign funds and need to calculate FIF taxable income without manually entering every position and transaction.

### Main Differentiator

The product is not trying to be a full portfolio tracker. It is a focused tax-preparation workflow:

> Broker exports → data mapping → validation → FIF calculation → accountant-ready output.

\---

## A3. Problem Statement

NZ investors can usually download trading and holdings data from their broker platforms, but the files are inconsistent. They may be CSV, XLSX, multi-tab Excel, activity statements, portfolio exports, tax reports, transaction reports, holdings reports, or dividend reports.

Current options have gaps:

|Current option|Strength|Gap|
|-|-|-|
|IRD FIF calculator|Official and trusted|Requires manual input; does not bulk import broker files|
|Hatch FIF report|Convenient for Hatch-only investors|Limited to Hatch data; not useful for multi-broker consolidation|
|Sharesies FIF report|Convenient for Sharesies users|Paid report; Sharesies-only; not a multi-broker tax workflow|
|Sharesight|Powerful portfolio/tax platform|Broader than a simple year-end FIF tool; paid tiers; requires portfolio setup/import|
|FIFtax.nz|Focused FIF education/calculator|Opportunity remains for stronger broker coverage, audit pack, and commercial UX|
|Manual spreadsheet|Flexible|Slow, error-prone, hard to audit|

\---

## A4. Target Users

|User|Description|Main need|
|-|-|-|
|DIY NZ retail investor|Holds US/global shares and ETFs through Sharesies, Hatch, Stake, IBKR, Tiger, Moomoo, etc.|Upload files and get FIF working paper|
|Near-threshold investor|Has invested around NZD 40k–70k offshore|Check whether the NZD 50k cost threshold has been exceeded|
|Multi-broker investor|Uses two or more platforms|Consolidated FIF result across all brokers|
|Accountant / tax agent|Receives messy client files|Standardised output and audit pack|
|Advanced investor|Uses IBKR or multi-currency brokers|Transparent validation, FX handling, and detailed exports|

\---

## A5. FIF Rules Summary for Product Design

This is a product-design summary, not tax advice.

|Rule area|Product interpretation|
|-|-|
|Tax residency|MVP assumes NZ tax resident individual or eligible trustee. Other entities are advanced/out-of-scope.|
|Tax year|Standard NZ income year: 1 April to 31 March.|
|FIF scope|MVP supports listed foreign shares and ETFs/funds. Foreign superannuation, life insurance, and complex interests are out-of-scope or accountant-review only.|
|Threshold|Natural persons and eligible trustees generally do not need FIF calculations if total cost of attributing FIF interests does not exceed NZD 50,000 at any time in the year. If it exceeds the threshold on any day, the first NZD 50,000 is not separately exempt.|
|Main MVP methods|Fair Dividend Rate (FDR) and Comparative Value (CV).|
|Other methods|Cost Method, Deemed Rate of Return, Revenue Account Method, and Attributable FIF Income Method should be future/advanced features.|
|FDR|Generally 5% of opening market value, plus quick-sale adjustment where required.|
|CV|Generally closing value + sales + dividends minus opening value + purchases.|
|Quick sale|Adjustment for shares bought and sold within the same income year. The adjustment is the lesser of peak holding method amount and quick-sale gain amount.|
|Australian listed shares|Some Australian listed companies may be exempt. App should flag them for review, not automatically conclude.|
|Method choice|App may show FDR and CV side by side and identify the lower calculated amount, but must warn that method eligibility and consistency need confirmation.|

\---

## A6. Broker Priority Matrix

|Priority|Platform|Main files to support|Native FIF/tax support|MVP notes|
|-:|-|-|-|-|
|1|Sharesies|Transaction CSV, holdings summary/report, FIF cost columns, dividend/tax data|Yes, paid FIF income report available after tax year end|High NZ retail usage. Compete on multi-broker, lower-friction, and audit workflow.|
|2|Hatch|Transactions CSV, holdings export, dividends/tax reports, Hatch FIF report|Yes|Strong US-share investor base. Need handle money-market rows and opening holdings.|
|3|Interactive Brokers|Activity Statement, Custom Statement, Flex Query CSV/XML/Text|No NZ-specific FIF report|Best advanced-user segment. Provide recommended Flex Query template.|
|4|Stake|Financial year investment activity XLSX, separate ASX/US tabs|No native NZ FIF; Sharesight integration/import available|XLSX and multi-tab support important.|
|5|Tiger Brokers|Statements/tax reports, Sharesight connection, trade confirmation emails|Sharesight route; broker statements vary|Multi-market and complex product risk. MVP support shares/ETFs only.|
|6|Moomoo|CSV trade export via tax documents / Sharesight manual import|Sharesight route; API mainly AU-specific|Support after core brokers; transferred holdings may need manual entry.|
|7|Generic broker|User-mapped CSV/XLSX|Varies|Needed for long-tail market but not first parser priority.|

\---

## A7. MVP Inputs

The app should accept these input sources:

|Input source|Purpose|MVP priority|
|-|-|-|
|Transaction history|Buys, sells, fees, transfers, corporate action clues|Must have|
|Holdings report|Opening and closing position quantities/values|Strongly recommended|
|Dividend/distribution report|CV method and withholding tax summary|Must have if dividends occurred|
|FX/cash report|NZD conversions and cash movements|Recommended|
|Broker FIF/tax report|Reconciliation/reference only|Optional|
|Manual entry / paste table|Fill missing prices, FX rates, or holdings|Must have|
|Historical price API|Opening/closing value lookup|Later|
|Broker API connection|Direct broker import|Later|

Supported file types for MVP:

* CSV
* XLSX
* Multi-tab XLSX where needed
* Manual table entry / copy-paste

Later file types:

* ZIP bundles
* PDF extraction for selected broker reports
* API connections

\---

## A8. MVP Outputs

The app should generate these output sources:

|Output|Purpose|
|-|-|
|On-screen dashboard|Summary of threshold, FDR, CV, warnings, and data quality|
|PDF report|Accountant-friendly working paper|
|CSV export pack|Detailed audit and reconciliation files|
|FIF threshold working|Shows whether the NZD 50k cost threshold appears exceeded|
|FDR calculation lines|Investment-level FDR working|
|CV calculation lines|Investment-level CV working|
|Quick-sale worksheet|Full adjustment detail|
|Foreign withholding tax summary|Tax paid summary for accountant review|
|Validation issue list|Blocking errors, warnings, and user resolutions|
|Source file manifest|Uploaded files, checksums, broker/file type, row counts|
|Manual adjustment log|All user/accountant overrides with reason|

\---

## A9. MVP Features

### Must Have

* NZ tax year selection.
* CSV/XLSX upload.
* Broker and file type detection.
* Column mapping wizard.
* Transaction normalisation.
* Holdings reconstruction.
* Manual missing-data entry.
* NZD FX conversion support.
* FIF threshold checker.
* ASX exemption flagging.
* FDR calculation.
* CV calculation.
* Quick-sale adjustment.
* Validation dashboard.
* PDF report export.
* CSV export pack.
* Audit trail.
* Strong disclaimer.
* Mobile-responsive web UI.
* Mobile file upload from Files/Downloads/Cloud Drive where supported.

### Should Have

* Broker templates for Sharesies and Hatch first.
* IBKR Flex Query template.
* Data quality score.
* Save mapping templates.
* Session-only privacy mode.
* Accountant-friendly report layout.
* PWA install support for mobile home screen.
* Mobile-friendly “download broker file instructions”.

### Could Have Later

* App Store iOS app.
* Google Play Android app.
* Native document picker and share-sheet import.
* Historical price API.
* IRD/RBNZ FX rate automation.
* Cost Method support.
* Revenue Account Method screening/support.
* Corporate action automation.
* Accountant portal.
* Australia module.

\---

## A10. Web vs Mobile App Feasibility Summary

### Key Feasibility Finding

A native mobile app is feasible because both iOS and Android support user-selected document access through system file pickers. Users can download broker CSV/XLSX files from a browser or broker app, save them to Files/Downloads/iCloud Drive/Google Drive/OneDrive, then import them into the FIF app.

However, the first release should still be mobile-responsive web, not native app first.

### Why Web First

* Users often download broker CSV/XLSX files more easily on desktop.
* CSV/XLSX preview, column mapping, and validation grids are easier on larger screens.
* Web can launch faster and avoid App Store / Play Store review delays.
* Stripe/web checkout is simpler for paid report export.
* The same web app can support desktop, tablet, and mobile.

### Why Add App Later

* App icon increases trust and repeat use during tax season.
* Mobile users can import files from Files/Downloads using native document picker.
* Native app can support share-sheet import: “Open CSV in FIF Calculator”.
* Push/email reminders can help users complete tax workflow.
* Mobile app may improve brand legitimacy.

### Recommended Channel Strategy

|Stage|Channel|Recommendation|
|-|-|-|
|MVP|Responsive web app|Build first|
|Early beta|PWA installable web app|Add if low effort|
|Paid beta|Optional mobile wrapper|Consider using Capacitor or React Native shell|
|Scale|Native iOS/Android app|Add only if mobile demand is proven|

### Product Decision

Do not choose “web or app” as either/or. Build the core product as a web-first calculation platform, then expose it through:

1. desktop/mobile web;
2. PWA;
3. app-store wrapper/native app later.

\---

## A11. Recommended MVP Strategy

Start narrow and practical:

1. Build manual FDR/CV calculator first.
2. Add one broker parser, preferably Sharesies or Hatch.
3. Add PDF/CSV export pack.
4. Validate with accountant-reviewed test cases.
5. Add a second broker.
6. Charge for final report export.
7. Add IBKR and generic CSV support after core flow is reliable.

Recommended monetisation:

> Free threshold check + paid FIF report export.



