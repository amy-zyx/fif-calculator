import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The single most important invariant in this codebase (spec §2 Hard rules, §9):
 * no module under packages/engine/src may call `fetch`. The engine only ever
 * receives data the caller (packages/web) already fetched and handed it as plain
 * arguments — it must never be able to reach the network with user transaction data.
 *
 * This is a filesystem scan, not just an eslint rule, so it holds even if lint is
 * skipped or misconfigured locally.
 */
function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (/\.tsx?$/.test(entry) && !entry.endsWith('.test.ts') && !entry.endsWith('.test.tsx')) {
      files.push(full);
    }
  }
  return files;
}

describe('privacy guarantee: no fetch in the engine', () => {
  it('no module in src/ contains a fetch( call', () => {
    const srcDir = join(__dirname);
    const files = collectSourceFiles(srcDir);
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of files) {
      const contents = readFileSync(file, 'utf-8');
      if (/\bfetch\s*\(/.test(contents)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
