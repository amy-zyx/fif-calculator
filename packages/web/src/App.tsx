import type { CanonicalTxn } from '@fif-calculator/engine';
import { useState } from 'react';
import { detectBestAdapter, isConfidentMatch } from './adapters/registry';
import type { ParsedFile, ParseWarning } from './adapters/types';
import { parseUploadedFile } from './lib/parseFile';
import { ColumnMappingWizard } from './wizard/ColumnMappingWizard';

const DISCLAIMER =
  'This tool provides an estimate only and is not tax advice. FIF calculations depend on facts and ' +
  'elections specific to you. Verify all figures against IRD guide IR461 and confirm with a chartered ' +
  'accountant before filing. The authors accept no liability.';

interface ParseResult {
  file: ParsedFile;
  txns: CanonicalTxn[];
  warnings: ParseWarning[];
  brokerLabel: string;
  verified: boolean;
}

type Screen = 'landing' | 'upload';

export function App() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [pendingFile, setPendingFile] = useState<ParsedFile | null>(null);
  const [needsWizard, setNeedsWizard] = useState(false);
  const [results, setResults] = useState<ParseResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelected(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setError(null);
    try {
      const parsed = await parseUploadedFile(file, `acct_${results.length + 1}`);
      const detection = detectBestAdapter(parsed.headers, parsed.rows.slice(0, 20));
      if (isConfidentMatch(detection)) {
        const { txns, warnings } = detection.adapter.parse(parsed);
        setResults((prev) => [
          ...prev,
          {
            file: parsed,
            txns,
            warnings,
            brokerLabel: detection.adapter.displayName,
            verified: detection.adapter.verified,
          },
        ]);
      } else {
        setPendingFile(parsed);
        setNeedsWizard(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.');
    }
  }

  function handleWizardComplete(result: { txns: CanonicalTxn[]; warnings: ParseWarning[] }) {
    if (!pendingFile) return;
    setResults((prev) => [
      ...prev,
      {
        file: pendingFile,
        txns: result.txns,
        warnings: result.warnings,
        brokerLabel: 'Custom mapping',
        verified: false,
      },
    ]);
    setPendingFile(null);
    setNeedsWizard(false);
  }

  if (screen === 'landing') {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-bold">NZ FIF Tax Calculator</h1>
        <p className="mt-4 text-gray-700">
          Upload your broker exports and get a consolidated Foreign Investment Fund (FIF) income figure for the
          NZ tax year, calculated under both FDR and Comparative Value, with a full audit trail.
        </p>
        <p className="mt-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <strong>No transaction data ever leaves your browser.</strong> This is a static, client-side-only app —
          there is no backend and no database. See PRIVACY.md in the repo for details.
        </p>
        <p className="mt-4 text-xs text-gray-500">{DISCLAIMER}</p>
        <button
          type="button"
          onClick={() => setScreen('upload')}
          className="mt-6 rounded bg-blue-600 px-4 py-2 text-white"
        >
          Get started
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-xl font-bold">Upload broker exports</h1>
        <p className="text-sm text-gray-600">
          The calculation engine (de minimis, FDR, Comparative Value) is not built yet — this milestone covers
          getting your transactions in, correctly mapped, with nothing silently guessed.
        </p>
      </header>

      {needsWizard && pendingFile ? (
        <ColumnMappingWizard file={pendingFile} sourceAccountId="acct_pending" onComplete={handleWizardComplete} />
      ) : (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium">
              Add a broker export (.csv, .xlsx)
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => void handleFileSelected(e.target.files)}
                className="mt-2 block"
              />
            </label>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>

          {results.map((result, i) => (
            <div key={i} className="rounded border p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">{result.file.fileName}</h2>
                <span className="text-sm text-gray-500">{result.brokerLabel}</span>
              </div>
              {!result.verified && (
                <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                  beta — please check the parsed preview below
                </p>
              )}
              <p className="mt-2 text-sm">{result.txns.length} transactions parsed.</p>
              {result.warnings.length > 0 && (
                <ul className="mt-2 text-xs text-amber-700">
                  {result.warnings.map((w, wi) => (
                    <li key={wi}>{w.message}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
