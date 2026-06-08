// ============================================================
//  utils/generate-id.ts
//  Generates unique batch order IDs like AT-001, AT-002 etc.
//  The last used number is saved in at-counter.json so it
//  never repeats across runs.
//
//  Usage:
//  const id = generateBatchOrderId();   // e.g. "AT-003"
// ============================================================

import * as fs   from 'fs';
import * as path from 'path';

const COUNTER_FILE = path.join(__dirname, '..', 'at-counter.json');

function readCounter(): number {
  if (!fs.existsSync(COUNTER_FILE)) return 0;
  const data = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf-8'));
  return data.last ?? 0;
}

function saveCounter(value: number): void {
  fs.writeFileSync(COUNTER_FILE, JSON.stringify({ last: value }, null, 2));
}

export function generateBatchOrderId(): string {
  const next   = readCounter() + 1;
  saveCounter(next);
  const padded = String(next).padStart(3, '0');   // 1 → "001", 12 → "012"
  return `AT-${padded}`;
}

// ── Preview without incrementing ──────────────────────────
// Useful if you want to see what the next ID will be
export function peekNextId(): string {
  const next   = readCounter() + 1;
  const padded = String(next).padStart(3, '0');
  return `AT-${padded}`;
}