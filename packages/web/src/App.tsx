import type { FifCalculationResult } from '@fif-calculator/engine';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, setLanguage, type LanguageCode } from './i18n';
import { detectBestAdapter, isConfidentMatch } from './adapters/registry';
import type { ParsedFile } from './adapters/types';
import { DrillDownPanel, DrillDownProvider } from './components/DrillDown';
import { parseUploadedFile } from './lib/parseFile';
import { PricesScreen } from './screens/PricesScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { SetupScreen } from './screens/SetupScreen';
import { parseSessionFile } from './export/sessionFile';
import { clearAllData, isOptedIn, loadWorkspace, saveWorkspace, setOptedIn } from './state/persistence';
import { runCalculation } from './state/runCalculation';
import {
  activeSession,
  addTaxpayer,
  copyFxRatesFrom,
  emptyWorkspace,
  patchActiveSession,
  removeTaxpayer,
  switchTaxpayer,
  type SessionState,
  type Step,
  type Workspace,
} from './state/session';
import { TaxpayerBar } from './components/TaxpayerBar';
import { ColumnMappingWizard } from './wizard/ColumnMappingWizard';

export function App() {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState<Step>('landing');
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const session = activeSession(workspace);
  const [pendingFile, setPendingFile] = useState<ParsedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Spec §12: the disclaimer must be seen, not merely present. The gate is a deliberate
  // stop rather than a footnote, because every figure this app produces is an estimate.
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [persistEnabled, setPersistEnabled] = useState(isOptedIn);
  const [notice, setNotice] = useState<string | null>(null);

  // Restore a previously saved session, but only if the user opted in.
  useEffect(() => {
    if (!isOptedIn()) return;
    void loadWorkspace().then((saved) => {
      // Restore every taxpayer, not just the active one — losing a second person's
      // hand-entered holdings on reload would be silent data loss.
      if (saved && saved.taxpayers.length > 0) setWorkspace(saved);
    });
  }, []);

  // Persist on change. A no-op while opted out — saveWorkspace gates on consent itself,
  // so there is no path where data is written without being asked for.
  useEffect(() => {
    void saveWorkspace(workspace);
  }, [workspace, persistEnabled]);

  function handleImportSession(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setNotice(null);
    file
      .text()
      .then((text) => {
        const imported = parseSessionFile(text);
        patch({
          taxpayerName: imported.taxpayerName,
          // The file records the year it came FROM; its holdings open the NEXT year.
          incomeYear: imported.incomeYear + 1,
          fxPolicy: imported.fxPolicy,
          costBasisMethod: imported.costBasisMethod,
          openingHoldings: imported.proposedOpeningHoldings,
        });
        setNotice(
          `Imported ${imported.proposedOpeningHoldings.length} proposed opening holding(s) from the ` +
            `${imported.incomeYear} year. Confirm each one — they are proposed, not final.`,
        );
      })
      .catch((err: unknown) => {
        setNotice(err instanceof Error ? `Could not import: ${err.message}` : 'Could not import that file.');
      });
  }

  async function handleClearAll() {
    const outcome = await clearAllData();
    // In-memory state is reset either way — the user asked for their data gone, and
    // whatever we still hold in this tab goes regardless of what the browser allowed.
    setWorkspace(emptyWorkspace());
    setPersistEnabled(false);
    setDisclaimerAccepted(false);
    setStep('landing');
    setNotice(
      outcome.deleted
        ? 'All local data cleared.'
        : `Cleared what we could, but the stored database could NOT be deleted. ${outcome.reason ?? ''}`.trim(),
    );
  }

  // Every mutation goes through the active taxpayer only — there is no code path that
  // writes one person's data into another's session (spec §6 hard isolation).
  const patch = (p: Partial<SessionState>) => setWorkspace((prev) => patchActiveSession(prev, p));

  const result = useMemo<FifCalculationResult | { error: string } | null>(() => {
    if (step !== 'results') return null;
    try {
      return runCalculation(session);
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Calculation failed' };
    }
  }, [step, session]);

  async function handleFileSelected(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setError(null);
    try {
      const parsed = await parseUploadedFile(file, `acct_${session.accounts.length + 1}`);
      const detection = detectBestAdapter(parsed.headers, parsed.rows.slice(0, 20));
      if (isConfidentMatch(detection)) {
        const { txns, warnings } = detection.adapter.parse(parsed);
        patch({
          accounts: [
            ...session.accounts,
            {
              fileName: parsed.fileName,
              brokerLabel: detection.adapter.displayName,
              verified: detection.adapter.verified,
              txns,
              warnings,
            },
          ],
        });
      } else {
        setPendingFile(parsed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.');
    }
  }

  // Spec §2 hard rule 3: the opt-in and the "Clear all my data" control live in the
  // header and are visible on EVERY screen, including the landing page — someone
  // returning to erase their data should not have to walk back into the flow to do it.
  const appHeader = (
    <header className="border-b bg-gray-50">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-2 text-sm">
        <span className="font-medium">{t('app.title')}</span>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2" title="Stored in your browser only, never uploaded">
            <input
              type="checkbox"
              aria-label="Remember my data on this device"
              checked={persistEnabled}
              onChange={(e) => {
                setOptedIn(e.target.checked);
                setPersistEnabled(e.target.checked);
              }}
            />
            Remember my data on this device
          </label>
          <button
            type="button"
            onClick={() => void handleClearAll()}
            className="rounded border border-red-300 px-3 py-1 text-red-700 hover:bg-red-50"
            data-testid="clear-all-data"
          >
            Clear all my data
          </button>
        </div>
      </div>
      {notice && (
        <div className="mx-auto max-w-5xl px-6 pb-2 text-sm text-blue-900" data-testid="app-notice">
          {notice}
        </div>
      )}
    </header>
  );

  if (step === 'landing') {
    return (
      <>
      {appHeader}
      <main className="mx-auto max-w-2xl px-6 py-16" data-testid="landing">
        <div className="mb-6 flex justify-end">
          <label className="text-sm text-gray-600">
            {t('app.language')}{' '}
            <select
              aria-label={t('app.language')}
              value={i18n.language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              className="rounded border border-gray-300 px-2 py-1"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <h1 className="text-2xl font-bold">{t('app.title')}</h1>
        <p className="mt-4 text-gray-700">{t('app.tagline')}</p>
        <p className="mt-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          {t('app.privacy')}
        </p>

        <section className="mt-6 rounded border border-amber-300 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-900">{t('disclaimer.heading')}</h2>
          <p className="mt-2 text-sm text-amber-900">{t('disclaimer.text')}</p>
          <p className="mt-2 text-sm text-amber-900">{t('disclaimer.notVerified')}</p>
          <label className="mt-3 flex items-start gap-2 text-sm text-amber-900">
            <input
              type="checkbox"
              checked={disclaimerAccepted}
              onChange={(e) => setDisclaimerAccepted(e.target.checked)}
              className="mt-1"
            />
            <span>{t('disclaimer.accept')}</span>
          </label>
        </section>

        <button
          type="button"
          disabled={!disclaimerAccepted}
          onClick={() => setStep('setup')}
          className="mt-6 rounded bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {t('app.getStarted')}
        </button>
      </main>
      </>
    );
  }

  return (
    <DrillDownProvider>
      {appHeader}
      <TaxpayerBar
        workspace={workspace}
        onSwitch={(id) => {
          // Drop any half-finished upload: a file picked for one person must never be
          // completed into another's account set.
          setPendingFile(null);
          setStep('setup');
          setWorkspace((prev) => switchTaxpayer(prev, id));
        }}
        onAdd={() => {
          setPendingFile(null);
          setStep('setup');
          setWorkspace((prev) => addTaxpayer(prev));
        }}
        onRemove={(id) => {
          setPendingFile(null);
          setStep('setup');
          setWorkspace((prev) => removeTaxpayer(prev, id));
        }}
        onCopyFxRates={(sourceId) => {
          setWorkspace((prev) => copyFxRatesFrom(prev, sourceId));
          setNotice('FX rates copied. Holdings and prices were not — those stay separate per person.');
        }}
      />
      <main className="mx-auto max-w-5xl px-6 py-10">
        {step === 'setup' && (
          <>
            <section className="mb-6 rounded border border-gray-200 p-4">
              <h2 className="font-semibold">Continuing from last year?</h2>
              <p className="text-sm text-gray-600">
                Import the <span className="font-mono">.fifsession.json</span> you exported last year and its
                closing position becomes this year&apos;s proposed opening holdings.
              </p>
              <input
                type="file"
                accept="application/json,.json"
                aria-label="Import last year's session file"
                onChange={(e) => handleImportSession(e.target.files)}
                className="mt-2 block text-sm"
              />
            </section>
            <SetupScreen session={session} onChange={patch} onNext={() => setStep('upload')} />
          </>
        )}

        {step === 'upload' &&
          (pendingFile ? (
            <ColumnMappingWizard
              file={pendingFile}
              sourceAccountId={`acct_${session.accounts.length + 1}`}
              onComplete={(r) => {
                patch({
                  accounts: [
                    ...session.accounts,
                    {
                      fileName: pendingFile.fileName,
                      brokerLabel: 'Custom mapping',
                      verified: false,
                      txns: r.txns,
                      warnings: r.warnings,
                    },
                  ],
                });
                setPendingFile(null);
              }}
            />
          ) : (
            <div className="space-y-6" data-testid="upload-screen">
              <header className="flex items-start justify-between">
                <h1 className="text-xl font-bold">Upload broker exports</h1>
                <button type="button" onClick={() => setStep('setup')} className="rounded border px-3 py-1 text-sm">
                  Back
                </button>
              </header>

              <label className="block text-sm font-medium">
                Add a broker export (.csv, .xlsx)
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => void handleFileSelected(e.target.files)}
                  className="mt-2 block"
                />
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}

              {session.accounts.map((account, i) => (
                <div key={i} className="rounded border p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-medium">{account.fileName}</h2>
                    <span className="text-sm text-gray-500">{account.brokerLabel}</span>
                  </div>
                  {!account.verified && (
                    <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                      beta — please check the parsed preview
                    </p>
                  )}
                  <p className="mt-2 text-sm">{account.txns.length} transactions parsed.</p>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setStep('review')}
                disabled={session.accounts.length === 0}
                className="rounded bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                Continue to review
              </button>
            </div>
          ))}

        {step === 'review' && (
          <ReviewScreen
            session={session}
            onChange={patch}
            onNext={() => setStep('prices')}
            onBack={() => setStep('upload')}
          />
        )}

        {step === 'prices' && (
          <PricesScreen
            session={session}
            onChange={patch}
            onNext={() => setStep('results')}
            onBack={() => setStep('review')}
          />
        )}

        {step === 'results' &&
          result &&
          ('error' in result ? (
            <div className="rounded border border-red-300 bg-red-50 p-4">
              <h1 className="font-semibold text-red-900">Could not calculate</h1>
              <p className="mt-1 text-sm text-red-900">{result.error}</p>
              <button type="button" onClick={() => setStep('prices')} className="mt-3 rounded border px-3 py-1 text-sm">
                Back
              </button>
            </div>
          ) : (
            <ResultsScreen result={result} session={session} onBack={() => setStep('prices')} />
          ))}
      </main>
      <DrillDownPanel />
    </DrillDownProvider>
  );
}
