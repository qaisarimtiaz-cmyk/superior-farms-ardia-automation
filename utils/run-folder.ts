// ============================================================
//  utils/run-folder.ts
//  Per-execution output folder: every `npx playwright test` run gets
//  its own timestamped folder under reports/runs/, holding that run's
//  screenshots and its client-facing HTML report side by side — so
//  results from different runs never overwrite or mix with each other.
//
//  How it's wired:
//    1. global-setup.ts calls createRunFolder() ONCE, before any test
//       starts, and records the folder path in a small marker file
//       (.current-run-folder) so every worker/test file in this run
//       can find it.
//    2. Individual tests call screenshotPath('screenshot-x.png') in
//       place of the old literal string — same filename, but resolved
//       into this run's folder instead of the repo root.
//    3. tests/reporters/client-report.ts writes the client report into
//       the same folder via getRunFolder().
//
//  Standalone `npx ts-node tests/tcN.ts` runs skip global setup (that
//  only runs under the Playwright test runner), so getRunFolder() falls
//  back to the repo root — standalone runs keep the old flat-file
//  behavior, unaffected by this.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';

const MARKER_FILE = path.resolve(__dirname, '../.current-run-folder');
const REPO_ROOT    = path.resolve(__dirname, '..');

/** Create a fresh timestamped run folder and record it as "current" for
 *  every worker/test file in this run to read. Call once, from
 *  global-setup.ts, before any test runs. Returns the folder's path. */
export function createRunFolder(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-'); // e.g. 2026-09-22T14-30-00-000Z
  const dir = path.join(REPO_ROOT, 'reports', 'runs', stamp);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(MARKER_FILE, dir, 'utf-8');
  return dir;
}

/** The current run's output folder. Falls back to the repo root if no
 *  run has been initialized yet (e.g. a standalone ts-node run, which
 *  skips Playwright's global setup). */
export function getRunFolder(): string {
  try {
    const dir = fs.readFileSync(MARKER_FILE, 'utf-8').trim();
    if (dir) return dir;
  } catch {
    // no marker file yet — fall through to the repo root
  }
  return REPO_ROOT;
}

/** Absolute path for a screenshot file inside the current run folder.
 *  Drop-in replacement for the old literal filename string:
 *    await page.screenshot({ path: screenshotPath('screenshot-tc1-x.png') });
 *    report.addScreenshot('label', screenshotPath('screenshot-tc1-x.png'));
 *  (safe to call twice with the same filename — deterministic, and
 *  ensures the folder exists before anything writes into it). */
export function screenshotPath(filename: string): string {
  const dir = getRunFolder();
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, filename);
}
