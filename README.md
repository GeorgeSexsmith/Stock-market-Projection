# Stock Scenario Calculator MVP

Plain HTML, CSS, and JavaScript. No dependencies or build step.

## Use immediately

Open `projections.html` in a browser. The fictional DEMO company, manual financial entry, three independent scenarios, calculation tables, local saving, and CSV export work without a server or API key.

All financial amounts and diluted shares are entered in **millions**; entry price is per share. Revenue growth, gross margin, operating expense percentage, other net costs percentage, share-count change, and low/high P/E can be edited separately for each of four years. Net income and net margin are calculated from these assumptions. Positive share-count change means dilution; negative means buybacks.

## Run with ticker lookup

Requires Node.js 20 or later. From this folder:

### Easiest option on macOS

Double-click `Start Stock Calculator.command`. On the first launch it asks for your Financial Modeling Prep API key and saves it in the project's private `.env` file. The input stays invisible while you paste. On later launches, double-click the same file and the calculator starts without asking for the key again.

Keep the Terminal window opened by the launcher running while using the website. Press Control-C in that window to stop the calculator. To replace the saved API key, delete `.env` and run the launcher again.

The `.env` file is excluded from Git and given owner-only file permissions. Do not share or commit it.

### Terminal option

From this folder:

```sh
npm start
```

Visit http://localhost:3000. No package installation is needed.

Live lookup requires your own Financial Modeling Prep API key with access to the annual income-statement and quote endpoints. Set `FMP_API_KEY` in the server's environment before starting. For example in zsh, enter the key privately without putting it in shell history:

```sh
read -rs 'FMP_API_KEY?FMP API key: '
export FMP_API_KEY
npm start
```

`.env.example` documents the variables; `.env` files are not automatically loaded. Never put an API key in browser JavaScript. Provider access and licensing depend on your plan.

This Codex workspace also has a bundled Node executable:

```sh
/Users/georgesexsmith/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node server.js
```

## Files

- `projections.html`: page and controls
- `styles.css`: basic responsive styling
- `model.js`: pure financial calculation and validation
- `app.js`: editing, rendering, saving, loading, CSV export
- `server.js`: local server, protected API key, five-minute response cache
- `model.test.js`: calculation, normalization, and server tests

## Verify

```sh
npm test
```

Or use the bundled Node path above followed by `--test`.

## Data and modeling boundaries

- Live lookup accepts exact tickers and currently supports USD statements with recognized US-exchange quotes. No company-name autocomplete yet.
- Financials are the latest annual statement, not TTM. Forecasts are annual run-rate scenarios one to four years from today, not forecasts tied to future fiscal reporting dates.
- Other net costs, including taxes, are inferred from gross profit minus operating expenses minus net income. They are projected as a revenue percentage; this is not a detailed tax or financing schedule.
- Imported net income is used as an approximation for income available to common shareholders. Companies with preferred dividends or complex capital structures need manual adjustments.
- Forecast diluted weighted-average shares start from the reported annual share figure. No point-in-time share-count substitution is made.
- Negative earnings have no P/E target or price CAGR. Dividends are excluded. Presets are illustrative, not recommendations.
- Editing a baseline preserves scenario assumptions; use Reset selected case to recalibrate expense and margin assumptions to the new baseline. Loading a ticker or demo resets all scenarios. Saving is explicit and stores one model in the current browser.
- Quote/source timestamps are displayed. A restored model is not refreshed automatically.
- The local server binds to your own machine. Public hosting would additionally need rate limiting, request controls, and a provider license appropriate for public data display.
- Real provider access must be verified with a valid API key; tests use representative data and do not claim a successful live import.

Provider references: [Income statements](https://site.financialmodelingprep.com/developer/docs/stable/income-statement), [API documentation](https://site.financialmodelingprep.com/developer/docs/stable).
# Stock-market-Projection
