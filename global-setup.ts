// ============================================================
//  global-setup.ts
//  Runs once per `npx playwright test` invocation, before any test or
//  worker starts. Creates this run's timestamped output folder (see
//  utils/run-folder.ts) so every test in the run writes its screenshots
//  and the client-facing HTML report into the same place.
// ============================================================

import { createRunFolder } from './utils/run-folder';

export default async function globalSetup(): Promise<void> {
  const dir = createRunFolder();
  console.log(`\n📁 This run's screenshots + client report will be saved to:\n   ${dir}\n`);
}
