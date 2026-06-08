# Running Tests & Getting the Playwright Execution Report

The suite runs through the **Playwright Test Runner**, which produces a rich
**HTML execution report** (pass/fail, timing, steps, screenshots, video, and traces).

## One-time setup

```powershell
npm install                 # installs Playwright + dotenv
npx playwright install      # installs the Chromium browser (first time only)
copy .env.example .env      # then fill in D365/Ardia URLs + credentials in .env
```

Credentials and URLs are read from `.env` (gitignored) — see `.env.example` for the keys.

## Commands

```powershell
# Run the whole suite  (authenticates once, then runs TC001..TC013, then writes the report)
npx playwright test
#   or:  npm test

# Refresh only the saved login sessions (re-auth, e.g. after they expire)
npm run test:auth          #  playwright test --project=setup

# Run a single test (sessions must already exist — run `npm run test:auth` first if not)
npx playwright test tests/tc01.spec.ts --project=e2e

# Run by title match
npx playwright test -g "TC001"

# Open the HTML report after a run
npx playwright show-report
#   or:  npm run report
```

Artifacts produced:
- `playwright-report/` — the interactive HTML report (self-contained; zip and share, or screenshot for slides)
- `test-results/results.json` — machine-readable run summary
- `test-results/` — per-failure screenshots, videos, and trace files
- `.auth/d365.json`, `.auth/ardia.json` — saved login sessions (gitignored)

## Authentication — log in once, reuse everywhere

Login no longer happens inside each test. Instead:

1. The **`setup` project** (`tests/auth.setup.ts`) logs into D365 and Ardia **once** at the
   start of a run and saves each session to `.auth/`. Approve the two MFA prompts on your
   authenticator app (one for D365, one for Ardia).
2. The **`e2e` project** depends on `setup`, so every test starts from the saved session —
   no per-test login.
3. If a saved session is missing or expired, `tests/helpers/auth-flows.ts` automatically
   falls back to a full interactive login for that app, so a run is never stranded on a
   sign-in page.

This is configured via `projects` + `dependencies` in `playwright.config.ts`.

## How it is wired

- `playwright.config.ts` — runner config: `setup` + `e2e` projects, HTML/list/JSON reporters,
  serial execution (`workers: 1`, because tests share `shared-state.json`), TLS bypass for
  Ardia, long timeouts for D365 login + MFA, and screenshot/video/trace on failure.
- `tests/helpers/auth-flows.ts` — single source of truth for D365/Ardia login and for opening
  authenticated contexts (`openAuthedD365`, `openAuthedArdia`).
- `tests/tcNN.spec.ts` — thin Test Runner entry points (numerically ordered `tc01`..`tc13`).
  Each imports and calls `run(browser)` from the matching `tcN.ts` logic file — no duplicated
  test logic.

## Originals still work standalone

Each `tests/tcN.ts` exports `run(browser)` and keeps a standalone footer. Standalone runs use
the same centralized auth (reusing `.auth/` if present, else logging in fresh):

```powershell
npx ts-node tests/tc1.ts          # runs directly, launches its own browser
npx ts-node tests/tc8.ts AT-055   # TC8/TC9 still accept a batch-order id argument
```

## Notes

- **Test order / dependencies** — TC4/TC8/TC9 read `shared-state.json` written by an earlier
  producing test. The numeric spec filenames (`tc01`..`tc13`) guarantee the producer runs first
  under the serial runner.
- **`scratch/`** — retired/reference files (old `auth.ts`/`authardia.ts`, the TC1 PoC, the
  Ardia-only debug script, and `tc11.ts` which duplicated `tc10.ts`). Not collected by the runner.
- For an even fuller report, set `trace: 'on'` in `playwright.config.ts` to capture a
  step-by-step trace for every run (open with `npx playwright show-trace <trace.zip>`).
