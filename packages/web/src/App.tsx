import type { FifCalculationResult } from '@fif-calculator/engine';
import { useMemo, useState } from 'react';
import { detectBestAdapter, isConfidentMatch } from './adapters/registry';
import type { ParsedFile } from './adapters/types';
import { DrillDownPanel, DrillDownProvider } from './components/DrillDown';
import { parseUploadedFile } from './lib/parseFile';
import { PricesScreen } from './screens/PricesScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { SetupScreen } from './screens/SetupScreen';
import { runCalculation } from './state/runCalculation';
import { emptySession, type SessionState, type Step } from './state/session';
import { ColumnMappingWizard } from './wizard/ColumnMappingWizard';

const DISCLAIMER =
  'This tool provides an estimate only and is not tax advice. FIF calculations depend on facts and ' +
  'elections specific to you. Verify all figures against IRD guide IR461 and confirm with a chartered ' +
  'accountant before filing. The authors accept no liability.';

export function App() {
  const [step, setStep] = useState<Step>('landing');
  const [session, setSession] = useState<SessionState>(emptySession);
  const [pendingFile, setPendingFile] = useState<ParsedFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const patch = (p: Partial<SessionState>) => setSession((prev) => ({ ...prev, ...p }));

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

  if (step === 'landing') {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-bold">NZ FIF Tax Calculator</h1>
        <p className="mt-4 text-gray-700">
          Upload your broker exports and get a consolidated Foreign Investment Fund (FIF) income figure for the
          NZ tax year, calculated under both FDR and Comparative Value, with a full audit trail.
        </p>
        <p className="mt-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <strong>No transaction data ever leaves your browser.</strong> This is a static, client-side-only app —
          there is no backend and no database.
        </p>
        <p className="mt-4 text-xs text-gray-500">{DISCLAIMER}</p>
        <button
          type="button"
          onClick={() => setStep('setup')}
          className="mt-6 rounded bg-blue-600 px-4 py-2 text-white"
        >
          Get started
        </button>
      </main>
    );
  }

  return (
    <DrillDownProvider>
      <main className="mx-auto max-w-5xl px-6 py-10">
        {step === 'setup' && (
          <SetupScreen session={session} onChange={patch} onNext={() => setStep('upload')} />
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
