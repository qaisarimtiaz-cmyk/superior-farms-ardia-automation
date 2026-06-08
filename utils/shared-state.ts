// ============================================================
//  utils/shared-state.ts
//  Lightweight JSON file used to pass data between test cases
//  that run in separate Node processes (TC1 → TC4).
//
//  TC1 writes the batch order ID here after it is generated.
//  TC4 reads it at startup.
// ============================================================

import * as fs   from 'fs';
import * as path from 'path';

const STATE_FILE = path.resolve(__dirname, '../shared-state.json');

export interface SharedState {
  batchOrderId: string;
  generatedAt:  string;   // ISO timestamp
  licensePlateId?: string;   // written by TC8 after LP is retrieved
}

/** Persist batchOrderId to disk so the next test case can read it. */
export function writeSharedState(state: SharedState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  console.log(`   [shared-state] Written → ${STATE_FILE}`);
  console.log(`   [shared-state] batchOrderId = ${state.batchOrderId}`);
}

/** Read the state written by a previous test case.
 *  Throws a clear error if the file is missing or malformed. */
export function readSharedState(): SharedState {
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error(
      `shared-state.json not found at ${STATE_FILE}.\n` +
      `Make sure TC1 ran successfully before TC4.`
    );
  }
  const raw   = fs.readFileSync(STATE_FILE, 'utf-8');
  const state = JSON.parse(raw) as SharedState;
  if (!state.batchOrderId) {
    throw new Error(
      `shared-state.json exists but batchOrderId is empty — TC1 may have failed.`
    );
  }
  console.log(`   [shared-state] Read ← ${STATE_FILE}`);
  console.log(`   [shared-state] batchOrderId = ${state.batchOrderId}`);
  return state;
}