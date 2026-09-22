// ============================================================
//  utils/shared-state.ts
//  Lightweight JSON file used to pass data between test cases
//  that run in separate Node processes / Playwright test runs.
//
//  Each producing test case writes its own batch order under its
//  own TC id (e.g. "TC01"), and downstream consumers read the
//  SPECIFIC producer's entry they depend on. Previously this was
//  a single flat object that every producer overwrote, so a
//  consumer got whichever producer happened to run last — not
//  necessarily the one it actually needed (e.g. TC8 silently read
//  TC3's batch order instead of TC2's whenever TC3 ran in between).
// ============================================================

import * as fs   from 'fs';
import * as path from 'path';

const STATE_FILE = path.resolve(__dirname, '../shared-state.json');

export interface SharedState {
  batchOrderId: string;
  generatedAt:  string;   // ISO timestamp
  licensePlateId?: string;   // written by TC8/TC9 after their own LP is retrieved
}

type SharedStateFile = Record<string, SharedState>;

function readStateFile(): SharedStateFile {
  if (!fs.existsSync(STATE_FILE)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    // Back-compat: an older run may have left the file in the previous flat
    // { batchOrderId, generatedAt } shape instead of { TCxx: {...} }.
    // Treat that as empty rather than crashing or misreading it as an entry.
    if (parsed && typeof parsed === 'object' && !('batchOrderId' in parsed)) {
      return parsed as SharedStateFile;
    }
    return {};
  } catch {
    return {};
  }
}

/** Persist a test case's own state under its TC id (e.g. "TC01"),
 *  merging with — never overwriting — other test cases' entries. */
export function writeSharedState(tcId: string, state: SharedState): void {
  const all = readStateFile();
  all[tcId] = state;
  fs.writeFileSync(STATE_FILE, JSON.stringify(all, null, 2), 'utf-8');
  console.log(`   [shared-state] Written → ${STATE_FILE} [${tcId}]`);
  console.log(`   [shared-state] ${tcId}.batchOrderId = ${state.batchOrderId}`);
}

/** Read the state written by a specific producing test case (by TC id).
 *  Throws a clear error naming that TC id if it's missing or malformed. */
export function readSharedState(tcId: string): SharedState {
  const all   = readStateFile();
  const state = all[tcId];
  if (!state) {
    throw new Error(
      `shared-state.json has no entry for "${tcId}" at ${STATE_FILE}.\n` +
      `Make sure ${tcId} ran successfully before this test case.`
    );
  }
  if (!state.batchOrderId) {
    throw new Error(
      `shared-state.json has a "${tcId}" entry but batchOrderId is empty — ${tcId} may have failed.`
    );
  }
  console.log(`   [shared-state] Read ← ${STATE_FILE} [${tcId}]`);
  console.log(`   [shared-state] ${tcId}.batchOrderId = ${state.batchOrderId}`);
  return state;
}
