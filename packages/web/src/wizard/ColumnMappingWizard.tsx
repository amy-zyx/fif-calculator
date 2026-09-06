import { TXN_TYPES, type CanonicalTxn, type TxnType } from '@fif-calculator/engine';
import { useMemo, useRef, useState } from 'react';
import type { ParsedFile, ParseWarning } from '../adapters/types';
import {
  applyMapping,
  distinctTypeValues,
  isMappingComplete,
  type ColumnMapping,
  type TypeValueMap,
} from './applyMapping';
import { parseAdapterProfile, serializeAdapterProfile, type AdapterProfile } from './AdapterProfile';
import { CANONICAL_FIELDS, type CanonicalFieldKey } from './canonicalFields';

const PREVIEW_ROW_COUNT = 5;

export interface ColumnMappingWizardProps {
  file: ParsedFile;
  sourceAccountId: string;
  onComplete: (result: { txns: CanonicalTxn[]; warnings: ParseWarning[]; profile: AdapterProfile }) => void;
  /** Provided when the wizard was opened by choice, so it can be backed out of. */
  onCancel?: (() => void) | undefined;
  /** Shown when the user opened the wizard over a file an adapter already read. */
  detectedLabel?: string | undefined;
}

function downloadJson(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * The universal fallback UI (spec §4.2 point 2): when no adapter scores above the
 * detection threshold, the user drags their own file's columns onto canonical
 * fields, with a live preview of the first rows so mistakes are caught immediately.
 */
export function ColumnMappingWizard({
  file,
  sourceAccountId,
  onComplete,
  onCancel,
  detectedLabel,
}: ColumnMappingWizardProps) {
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [typeValueMap, setTypeValueMap] = useState<TypeValueMap>({});
  const [fxRateConvertsTo, setFxRateConvertsTo] = useState<AdapterProfile['fxRateConvertsTo']>(null);
  const [profileName, setProfileName] = useState(file.fileName);
  const [importError, setImportError] = useState<string | null>(null);
  const draggedColumn = useRef<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const mappedColumns = new Set(Object.values(mapping).filter((v): v is string => !!v));
  const unmappedHeaders = file.headers.filter((h) => !mappedColumns.has(h));

  const typeValues = useMemo(() => distinctTypeValues(file, mapping), [file, mapping]);

  const previewFile: ParsedFile = useMemo(
    () => ({ ...file, rows: file.rows.slice(0, PREVIEW_ROW_COUNT) }),
    [file],
  );
  const preview = useMemo(
    () => applyMapping(previewFile, mapping, typeValueMap, sourceAccountId),
    [previewFile, mapping, typeValueMap, sourceAccountId],
  );

  const complete = isMappingComplete(mapping);

  function handleDrop(fieldKey: CanonicalFieldKey) {
    const column = draggedColumn.current;
    if (!column) return;
    setMapping((prev) => ({ ...prev, [fieldKey]: column }));
    draggedColumn.current = null;
  }

  function handleUnmap(fieldKey: CanonicalFieldKey) {
    setMapping((prev) => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  }

  function handleSaveProfile() {
    const profile: AdapterProfile = {
      version: 1,
      profileName,
      brokerId: 'USER_DEFINED',
      createdAt: new Date().toISOString(),
      columnMapping: mapping,
      typeValueMap,
      fxRateConvertsTo,
    };
    downloadJson(`${profileName || 'adapter-profile'}.fifsession-profile.json`, serializeAdapterProfile(profile));
  }

  function handleImportProfile(fileList: FileList | null) {
    const importedFile = fileList?.[0];
    if (!importedFile) return;
    setImportError(null);
    importedFile
      .text()
      .then((text) => {
        const profile = parseAdapterProfile(text);
        setMapping(profile.columnMapping);
        setTypeValueMap(profile.typeValueMap);
        setFxRateConvertsTo(profile.fxRateConvertsTo);
        setProfileName(profile.profileName);
      })
      .catch((err: unknown) => {
        setImportError(err instanceof Error ? err.message : 'Could not import profile');
      });
  }

  function handleContinue() {
    const result = applyMapping(file, mapping, typeValueMap, sourceAccountId);
    const profile: AdapterProfile = {
      version: 1,
      profileName,
      brokerId: 'USER_DEFINED',
      createdAt: new Date().toISOString(),
      columnMapping: mapping,
      typeValueMap,
      fxRateConvertsTo,
    };
    onComplete({ ...result, profile });
  }

  return (
    <div className="space-y-6" data-testid="column-mapping-wizard">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Map your file's columns</h2>
          {detectedLabel ? (
            <p className="text-sm text-gray-600">
              <span className="font-mono">{file.fileName}</span> was read as{' '}
              <strong>{detectedLabel}</strong>. Mapping it by hand here replaces that — useful if the automatic
              reading looks wrong. Drag each column onto the matching field below.
            </p>
          ) : (
            <p className="text-sm text-gray-600">
              We didn't recognise <span className="font-mono">{file.fileName}</span> as a known broker export.
              Drag each column from your file onto the matching field below. You can save this mapping and reuse
              it next time.
            </p>
          )}
        </div>
        {onCancel && (
          <button type="button" onClick={onCancel} className="shrink-0 rounded border px-3 py-1 text-sm">
            Cancel
          </button>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Your file's columns</h3>
        <div className="flex flex-wrap gap-2" role="list" aria-label="Source columns">
          {unmappedHeaders.map((header) => (
            <div
              key={header}
              role="listitem"
              draggable
              onDragStart={(e) => {
                draggedColumn.current = header;
                e.dataTransfer.setData('text/plain', header);
                e.dataTransfer.effectAllowed = 'move';
              }}
              className="cursor-move rounded border border-gray-300 bg-gray-50 px-3 py-1 text-sm"
              data-testid={`source-column-${header}`}
            >
              {header}
            </div>
          ))}
          {unmappedHeaders.length === 0 && (
            <p className="text-sm text-gray-400">All columns mapped.</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Canonical fields</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CANONICAL_FIELDS.map((field) => {
            const mappedTo = mapping[field.key];
            return (
              <div
                key={field.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(field.key);
                }}
                data-testid={`dropzone-${field.key}`}
                className={`rounded border-2 border-dashed p-3 ${mappedTo ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {field.label}
                    {field.required && <span className="text-red-600"> *</span>}
                  </span>
                  {mappedTo && (
                    <button
                      type="button"
                      onClick={() => handleUnmap(field.key)}
                      aria-label={`Unmap ${field.label}`}
                      className="text-xs text-gray-500 hover:text-red-600"
                    >
                      ×
                    </button>
                  )}
                </div>
                {field.hint && <p className="text-xs text-gray-500">{field.hint}</p>}
                <p className="mt-1 text-sm" data-testid={`mapped-value-${field.key}`}>
                  {mappedTo ?? <span className="text-gray-400">Drop a column here</span>}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {typeValues.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">What does each transaction type mean?</h3>
          <table className="text-sm">
            <tbody>
              {typeValues.map((raw) => (
                <tr key={raw}>
                  <td className="pr-3 py-1 font-mono">{raw}</td>
                  <td className="py-1">
                    <select
                      aria-label={`Transaction type for "${raw}"`}
                      value={typeValueMap[raw] ?? 'UNKNOWN'}
                      onChange={(e) =>
                        setTypeValueMap((prev) => ({ ...prev, [raw]: e.target.value as TxnType }))
                      }
                      className="rounded border border-gray-300 px-2 py-1"
                    >
                      {TXN_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mapping.fxRateColumn && (
        <div>
          <h3 className="text-sm font-medium mb-2">
            What does the "{mapping.fxRateColumn}" rate convert <em>to</em>?
          </h3>
          <p className="text-xs text-gray-500 mb-2">
            Many exports quote a rate to the account's base currency, not NZD (spec §5.7) — never assume.
          </p>
          <select
            aria-label="FX rate converts to"
            value={fxRateConvertsTo ?? 'UNKNOWN'}
            onChange={(e) => setFxRateConvertsTo(e.target.value as AdapterProfile['fxRateConvertsTo'])}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="NZD">NZD</option>
            <option value="ACCOUNT_BASE_CURRENCY">My account's base currency (not NZD)</option>
            <option value="UNKNOWN">I'm not sure</option>
          </select>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium mb-2">
          Preview — first {Math.min(PREVIEW_ROW_COUNT, file.rows.length)} rows
        </h3>
        {preview.warnings.length > 0 && (
          <ul className="mb-2 text-sm text-amber-700" data-testid="preview-warnings">
            {preview.warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="preview-table">
            <thead>
              <tr className="text-left">
                <th className="pr-3">Date</th>
                <th className="pr-3">Type</th>
                <th className="pr-3">Ticker</th>
                <th className="pr-3">Currency</th>
                <th className="pr-3">Gross</th>
                <th className="pr-3">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {preview.txns.map((t) => (
                <tr key={t.id}>
                  <td className="pr-3">{t.tradeDate}</td>
                  <td className="pr-3">{t.type}</td>
                  <td className="pr-3">{t.instrument?.ticker}</td>
                  <td className="pr-3">{t.currency}</td>
                  <td className="pr-3">{t.grossAmount.toString()}</td>
                  <td className="pr-3">{t.quantity?.toString() ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t pt-4">
        <label className="text-sm">
          Profile name{' '}
          <input
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1"
          />
        </label>
        <button type="button" onClick={handleSaveProfile} className="rounded border px-3 py-1 text-sm">
          Save mapping profile
        </button>
        <button
          type="button"
          onClick={() => importInputRef.current?.click()}
          className="rounded border px-3 py-1 text-sm"
        >
          Import mapping profile
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => handleImportProfile(e.target.files)}
        />
        {importError && <span className="text-sm text-red-600">{importError}</span>}
        <button
          type="button"
          disabled={!complete}
          onClick={handleContinue}
          className="ml-auto rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
