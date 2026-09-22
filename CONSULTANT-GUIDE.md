# Ardia / D365 Test Suite — Setup & Run Guide for Functional Consultants

This guide is written for functional consultants who need to **set up and run this automated test suite themselves**, without a QA engineer's help. It assumes no prior experience with test automation. If a term is unfamiliar, it's explained the first time it's used.

**What this suite does:** it drives a real, headless browser through Superior Farms' actual D365 (Dynamics 365 Finance & Operations) and Ardia (the on-prem shop-floor app) systems — creating real batch orders, producing real weight/label transactions, and deleting real records — exactly like a person would, but automatically. There is no "practice" mode: every run touches live data in whatever environment your `.env` file points at.

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [One-time setup](#2-one-time-setup)
3. [Authenticating (MFA)](#3-authenticating-mfa)
4. [Running the tests](#4-running-the-tests)
5. [Where to find results](#5-where-to-find-results)
6. [Configuring test data](#6-configuring-test-data)
7. [Fallback methods — what happens when live data doesn't match](#7-fallback-methods--what-happens-when-live-data-doesnt-match)
8. [Test case reference](#8-test-case-reference)
9. [Troubleshooting](#9-troubleshooting)
10. [When to ask for help](#10-when-to-ask-for-help)

---

## 1. Prerequisites

- **Node.js** installed (version 18 or newer). Check by running `node --version` in a terminal.
- **[Visual Studio Code](https://code.visualstudio.com/)** (recommended) — a free code editor. You don't need to write any code to use this suite, but it makes opening the folder, editing test data, and running tests much easier than a bare terminal.
- **[Playwright Test for VSCode](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright)** (recommended extension, installed from inside VS Code's Extensions panel) — adds a "Testing" panel where you can see every test case and run or debug any of them with a click, instead of typing terminal commands.
- **Git** (or [GitHub Desktop](https://desktop.github.com/) for a visual tool) — to download (clone) this repository.
- **Access to the D365 test environment and the Ardia app** with a valid Azure AD account.
- **An authenticator app** (e.g. Microsoft Authenticator) set up for your account, since login requires approving an MFA (multi-factor authentication) push notification on your phone — **this suite cannot approve MFA for you**. Someone needs to be at their phone when a run starts.
- A copy of this repository (folder) on your machine.

## 2. One-time setup

Open a terminal in this project folder and run:

```powershell
npm install                 # installs all the tools this suite needs
npx playwright install      # downloads the headless browser (Chromium) — first time only
copy .env.example .env      # creates your personal config file
```

Now open the new `.env` file in a text editor and fill in the real values:

```
D365_URL=<the D365 environment URL you're testing against>
D365_USERNAME=<your D365 login email>
D365_PASSWORD=<your D365 password>

ARDIA_URL=<the Ardia app URL>
ARDIA_USERNAME=<your Ardia login email>
ARDIA_PASSWORD=<your Ardia password>
ARDIA_RAF_API_URL=<the Ardia RAF journal API URL>
```

> ⚠️ **Never share your `.env` file or commit it to git.** It's already excluded from version control (listed in `.gitignore`), so `git status` should never show it as a file to be added. If you ever see `.env` show up as a new/changed file in git, stop and ask before committing anything.
>
> ⚠️ **Double-check `D365_URL` points at the correct environment.** This has caused confusing failures before — pointing at the wrong D365 environment (e.g. a UAT sandbox instead of the intended test environment) makes tests fail in ways that look like bugs but are really just "wrong address." If in doubt, ask whoever gave you the environment details to confirm the URL.

## 3. Authenticating (MFA)

Before running any tests, refresh your login sessions:

```powershell
npm run test:auth
```

This will:
1. Open D365 and log in with your `.env` credentials.
2. **Send an MFA approval push to your authenticator app for D365 — approve it within about 60–90 seconds.**
3. Do the same for Ardia — **a second, separate MFA approval.**
4. Save both sessions so the actual tests can reuse them without logging in again.

You should see:
```
✓ D365 session saved → .auth\d365.json
✓ Ardia session saved → .auth\ardia.json
```

If either login "hangs" waiting for MFA and eventually times out, it just means the push wasn't approved in time — run `npm run test:auth` again and be ready for the notification.

**You need to re-run this** whenever a saved session has expired (sessions from the same day are usually still valid; sessions from a previous day may need refreshing). If you run the full suite and it fails immediately with a login-related error, refreshing auth first is the right move.

## 4. Running the tests

**Run the whole suite** (all 13 test cases, one after another — takes roughly 60–90 minutes):

```powershell
npx playwright test
```

**Run headless** (no visible browser window — faster, and what you'll normally want):

```powershell
$env:HEADLESS='true'; npx playwright test
```

(On the first run of the day, run `npm run test:auth` first as in step 3 — the full suite also re-authenticates automatically via its "setup" step, so this is only strictly required if you want to control exactly when the MFA prompts happen.)

**Run a single test case** (useful for re-checking one thing without waiting for everything):

```powershell
$env:HEADLESS='true'; npx playwright test tests/tc01.spec.ts --project=e2e --no-deps
```

Swap `tc01` for whichever test you want (see the [test case reference](#8-test-case-reference) table below for the full list). `--no-deps` skips re-authenticating, reusing whatever session is already saved.

## 5. Where to find results

**Every run gets its own timestamped folder.** Screenshots and the client-facing report never overwrite a previous run — look in:

```
reports/runs/<date-and-time-of-the-run>/
    Client_Execution_Report.html      ← open this in a browser
    screenshot-....png                 ← every screenshot taken during this run
```

For example, `reports/runs/2026-09-22T12-31-08-539Z/`. The console output also prints the exact folder path at the start of every run, right after you launch it.

**`Client_Execution_Report.html`** is the report meant for sharing — it's a single, self-contained, branded page with a pass/fail badge, step-by-step detail, and embedded screenshots for every test case in that run. Open it in a browser, or print it to PDF (Chrome → Print → Save as PDF, with "Background graphics" turned on) if you need a static file to email.

**Other places results also land** (not moved into the per-run folder — these stay where they've always been):
- `reports/Test_Case_N_<timestamp>.xlsx` — a per-test-case Excel report (test data, steps, pass/fail), one file per test case per run.
- `playwright-report/` — Playwright's own built-in HTML report, more technical, with video/trace files for debugging a failure in depth. Open it with `npm run report`.
- `test-results/results.json` — a machine-readable summary, not meant for humans.

## 6. Configuring test data

All the test data — which item, site, warehouse, batch, weight, etc. each test case uses — lives in **one file: `test-data.ts`** (in the project root). You do not need to touch any `.ts` file under `tests/` to change what data a test uses.

Each test case has its own entry, keyed by its ID (e.g. `TC01`, `TC02`, `TC10`). For example:

```ts
TC01: {
  description: 'AT-013',
  itemNumber: 'P20',
  configuration: '10043',
  site: '12',
  warehouse: '12001',
  location: '12140',
  quantity: '10',
  printer: 'ZPL virtual printer (new)',
  ...
},
```

To change what TC01 produces, edit the values in its block — e.g. change `itemNumber` to a different item, or `quantity` to a different amount — save the file, and the next run will use the new values. No other file needs to change.

**A few fields are more specialized** (used by specific test cases only):

| Field | Used by | What it means |
|---|---|---|
| `batchNumber` | TC10 | The D365 inventory batch to search for pickable stock |
| `pickBatchTile` | TC10 | Which batch-order tile to open in Ardia's Pick screen |
| `manualLicensePlate` | TC10 | A fallback License Plate to use if live inventory search finds nothing — see [Fallback methods](#7-fallback-methods--what-happens-when-live-data-doesnt-match) |
| `customerLabelText` | TC12, TC13 | Which customer label option to select during Produce |
| `boxCount` | TC01 (used by TC14) | How many boxes TC14's Multi-Box test produces |

**Test cases that depend on each other** don't need any test-data.ts configuration for that link — they read it automatically from a small file called `shared-state.json` (created and updated as tests run). You don't need to edit this file; it's explained in the [test case reference](#8-test-case-reference) table below so you know which tests need which others to have run first.

## 7. Fallback methods — what happens when live data doesn't match

This suite is built to degrade gracefully rather than fail outright whenever the exact data it's looking for isn't available — because D365/Ardia data changes constantly (previous test runs consume it, business processes move it along, etc.). Here's what each fallback does, so you can recognize it in the logs and understand it's expected behavior, not a bug:

- **License Plate fallback (TC10):** the test first tries to find a real, currently-available License Plate with positive inventory in D365's On-hand list. If it can't find one (e.g. inventory is temporarily zero everywhere it looked), it falls back to whatever value is set in `test-data.ts`'s `manualLicensePlate` field. You'll see `"No LP extracted — falling back to manualLicensePlate from test-data.ts"` in the console when this happens.
- **Pick tile fallback (TC10):** if the specific batch-order tile named in `pickBatchTile` isn't visible in Ardia's Pick screen (e.g. it's aged out of the list), the test automatically selects whichever tile *is* available instead, rather than failing.
- **Warehouse/Site dropdown scrolling:** Ardia's dropdown lists can be long, and the option you need might not be visible without scrolling. The test scrolls incrementally and matches by the visible text, rather than assuming a fixed position — so it keeps working even if the list's order or length changes.
- **Session reuse vs. fresh login:** every test tries to reuse the saved login session first (fast, no MFA needed); if that session has expired, it automatically falls back to a full interactive login (which *will* need a fresh MFA approval).
- **Catch-Weight Tag search (TC6/TC7):** these two tests scope their search for a "Registered" catch-weight tag to a specific, recently-produced batch (from TC14) — if that batch information isn't available (e.g. TC14 hasn't run yet in this session), they fall back to just using whatever tag is first in the unfiltered list.

If a fallback is being used and you're not sure whether that's fine or a sign of a real problem, check the [test case reference](#8-test-case-reference) notes below, or see [When to ask for help](#10-when-to-ask-for-help).

## 8. Test case reference

| File | Title | What it does | Depends on | Approx. time |
|---|---|---|---|---|
| `tc01.spec.ts` | TC001 | D365 batch order → Ardia Produce → RAF posting | — (standalone) | ~5 min |
| `tc02.spec.ts` | TC002 | Produce via CR Transfer | — (standalone) | ~5 min |
| `tc03.spec.ts` | TC003/TC004 | Produce via Hangback | — (standalone) | ~5 min |
| `tc04.spec.ts` | TC004 | RAF staging barcode → Ardia Fresh-to-Frozen conversion | **TC1's batch** | ~1 min |
| `tc05.spec.ts` | TC006 | Ardia Produce → Reprint/Reversal label | — (standalone) | ~1 min |
| `tc06.spec.ts` | TC007 | Catch-Weight Tag deletion → RAF reversal | **TC14's batch** (see note below) | ~2 min |
| `tc07.spec.ts` | TC007b | Catch-Weight Tag deletion, refined version | **TC14's batch** (see note below) | ~2 min |
| `tc08.spec.ts` | TC008 | CR Transfer License Plate deletion | **TC2's batch** | ~2 min |
| `tc09.spec.ts` | TC009 | Hangback License Plate deletion | **TC3's batch** | ~2 min |
| `tc10.spec.ts` | TC010 | Pick process from Ardia (On-hand → Pick → Cold Scale sync) | — (standalone, has fallbacks) | ~7–10 min |
| `tc12.spec.ts` | TC012 | D365 batch order + Ardia Produce (HEB customer label) | — (standalone) | ~5 min |
| `tc13.spec.ts` | TC013 | D365 batch order + Ardia Produce | — (standalone) | ~5 min |
| `tc14.spec.ts` | TC001 (Multi-Box) | Produces 10 boxes via plain Produce | — (standalone) | ~3 min |

> **Note on file names vs. titles:** the file number (`tc05`) and the title shown in the report (`TC006`) don't always match — this is a known, longstanding quirk in how this suite was originally numbered. Use the table above, or the title shown in the report, rather than assuming the file number tells you the TC number.

> **Important operational note on TC6/TC7 and TC14:** TC6 and TC7 need a recently-produced batch from TC14 to reliably find a "Registered" tag to work with. But in a normal full-suite run, files execute in the order shown above — **TC14 runs *after* TC6 and TC7**, not before. This means on a single full-suite run, TC6/TC7 may only have an *older* TC14 batch (from a previous run) to work with, or none at all on a brand-new checkout. If TC6/TC7 fail or fall back to "unfiltered" search, the most reliable fix is to **run TC14 first, then re-run TC6 and TC7** on their own:
> ```powershell
> $env:HEADLESS='true'; npx playwright test tests/tc14.spec.ts --project=e2e --no-deps
> $env:HEADLESS='true'; npx playwright test tests/tc06.spec.ts tests/tc07.spec.ts --project=e2e --no-deps
> ```

## 9. Troubleshooting

**"Waiting for MFA... " and then a timeout error.** The push notification wasn't approved in time. Just run `npm run test:auth` again and approve promptly.

**A test fails immediately with a login/navigation error.** Check `.env`'s `D365_URL` is the correct environment (see the warning in [section 2](#2-one-time-setup)). Also try refreshing auth (`npm run test:auth`).

**`net::ERR_CONNECTION_RESET` when opening D365.** This has happened before after a lot of automated test runs in a short window — it appears to be the D365 environment temporarily rate-limiting automated traffic, not a bug in the suite. It has always resolved itself after waiting 10–20 minutes. If it persists longer than that, check with IT whether there's a known block or outage.

**A test that used to pass suddenly fails with "0 rows found" or "nothing found here."** This is almost always a **data availability** issue, not a code bug — the specific record the test was looking for (a Registered tag, an available License Plate, a specific batch) may have already been consumed by an earlier test run, converted by a different process, or simply doesn't exist yet. Check the [Fallback methods](#7-fallback-methods--what-happens-when-live-data-doesnt-match) section, and consider whether running a "producer" test case first (see the dependency column in the [reference table](#8-test-case-reference)) would give it fresh data to work with.

**A screenshot or the client report is missing something.** Check you're looking in the *correct* run folder under `reports/runs/` — every run creates a new one, so an old screenshot won't be in today's folder.

## 10. When to ask for help

You don't need to be a developer to run this suite, but a few situations genuinely need someone with deeper access or automation knowledge:

- A test fails with an error message that clearly describes a **UI element not found** or a **selector timeout** that isn't explained by anything in this guide — the D365 or Ardia interface may have changed since the test was written, and the underlying script needs updating.
- You suspect real production/business data was affected in a way that shouldn't have happened.
- Authentication keeps failing even after refreshing sessions and confirming credentials/environment are correct.
- You want to add a brand-new test case, or change what a test *does* (not just what data it uses).

For anything else — changing data, running tests, reading reports — this guide should be everything you need.
