import { openDB, type IDBPDatabase } from 'idb';
import type { SessionState } from './session';

const DB_NAME = 'fif-calculator';
const STORE = 'session';
const KEY = 'current';
const CONSENT_KEY = 'fif.persistenceOptIn';

/**
 * Local persistence (spec §2 hard rule 3): OPT-IN, local only, with a visible way to
 * erase everything.
 *
 * Transaction data is the most sensitive thing this app touches, so it is never written
 * anywhere until the user asks for it. `isOptedIn()` gates every write, and
 * `clearAllData()` deletes the whole database rather than emptying a store, so nothing
 * lingers in a stale key.
 *
 * Decimal values do not survive structured cloning as Decimals, so only the raw
 * hand-entered strings and parsed transaction inputs are persisted — the session is
 * re-derived from those. Anything that cannot round-trip faithfully is deliberately
 * not stored.
 */
export function isOptedIn(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'yes';
  } catch {
    return false;
  }
}

export function setOptedIn(value: boolean): void {
  try {
    if (value) localStorage.setItem(CONSENT_KEY, 'yes');
    else localStorage.removeItem(CONSENT_KEY);
  } catch {
    // Blocked site data: persistence simply stays off. Never a hard failure.
  }
}

/**
 * A single cached connection, deliberately.
 *
 * Opening a fresh connection per call leaves every previous one open, and an open
 * connection makes `deleteDatabase` fire `onblocked` instead of deleting — so
 * "Clear all my data" would report success while the data was still there. For a
 * privacy control that is the worst possible failure, so the connection is owned here
 * and closed before any delete.
 */
let connection: Promise<IDBPDatabase> | null = null;

async function db(): Promise<IDBPDatabase> {
  if (!connection) {
    connection = openDB(DB_NAME, 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE);
      },
    });
  }
  return connection;
}

async function closeConnection(): Promise<void> {
  if (!connection) return;
  try {
    (await connection).close();
  } catch {
    // already closed
  }
  connection = null;
}

/** What actually gets persisted — no Decimals, no derived results. */
export interface PersistedSession {
  taxpayerName: string;
  incomeYear: number;
  fxPolicy: SessionState['fxPolicy'];
  costBasisMethod: SessionState['costBasisMethod'];
  openingHoldings: SessionState['openingHoldings'];
  closingPrices: SessionState['closingPrices'];
  fxRates: SessionState['fxRates'];
  confirmedTransferTxnIds: string[];
  accountBaseCurrencies: Record<string, string>;
}

export function toPersisted(session: SessionState): PersistedSession {
  return {
    taxpayerName: session.taxpayerName,
    incomeYear: session.incomeYear,
    fxPolicy: session.fxPolicy,
    costBasisMethod: session.costBasisMethod,
    openingHoldings: session.openingHoldings,
    closingPrices: session.closingPrices,
    fxRates: session.fxRates,
    confirmedTransferTxnIds: session.confirmedTransferTxnIds,
    accountBaseCurrencies: session.accountBaseCurrencies,
  };
}

export async function saveSession(session: SessionState): Promise<void> {
  if (!isOptedIn()) return;
  try {
    const database = await db();
    await database.put(STORE, toPersisted(session), KEY);
  } catch {
    // Persistence is a convenience; a failure must never interrupt the calculation.
  }
}

export async function loadSession(): Promise<PersistedSession | null> {
  if (!isOptedIn()) return null;
  try {
    const database = await db();
    return (await database.get(STORE, KEY)) ?? null;
  } catch {
    return null;
  }
}

/**
 * Erases everything this app has stored — the IndexedDB database entirely, plus the
 * localStorage keys (consent, language, any API key). Deliberately thorough: a user
 * clicking this is asking for their data gone, not tidied.
 */
export async function clearAllData(): Promise<{ deleted: boolean; reason?: string }> {
  // Consent is revoked FIRST, so that even if the delete fails nothing further is
  // written, and a concurrent save cannot re-create what we are about to remove.
  setOptedIn(false);

  let deleted = false;
  let reason: string | undefined;

  try {
    await closeConnection();
    deleted = await new Promise<boolean>((resolve) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve(true);
      request.onerror = () => {
        reason = 'The browser refused to delete the local database.';
        resolve(false);
      };
      // Another tab still holds a connection. Reported rather than swallowed — telling
      // the user their data is gone when it is not would be a serious lie.
      request.onblocked = () => {
        reason = 'Another open tab of this app is holding the database. Close it and try again.';
        resolve(false);
      };
    });
  } catch (err) {
    reason = err instanceof Error ? err.message : 'Could not delete the local database.';
  }

  try {
    for (const key of ['fif.persistenceOptIn', 'fif.language', 'fif.alphaVantageKey']) {
      localStorage.removeItem(key);
    }
  } catch {
    // nothing more we can do
  }

  return reason === undefined ? { deleted } : { deleted, reason };
}
