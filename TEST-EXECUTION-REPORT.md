# Test Execution Report — Automated Tests (Ardia & D365)

| Field | Value |
|-------|-------|
| **Project** | Superior Farms — Ardia App & Dynamics 365 F&O Integration |
| **Report type** | Automated Test Execution Summary |
| **Prepared by** | Qaisar Imtiaz (QA) |
| **UAT Build** | D365 10.0.46 |
| **Reporting date** | 2026-05-31 |
| **Execution window** | 2026-02-11 to 2026-02-12 (functional sign-off); automation last run 2026-05-15 |
| **Framework** | Playwright + TypeScript (standalone `ts-node` scripts) |
| **Environment** | D365 F&O (cloud, Azure AD + MFA) · Ardia App (on-prem, self-signed TLS) |

---

## 1. Executive Summary

The automated suite covers the regression-critical production workflows shared between D365 and the
Ardia App: **Produce → RAF posting**, **CR Transfer**, **Hangbacks**, **Fresh-to-Frozen conversion**,
**label reprint**, and **transaction reversal** (Tag / License Plate deletion). All nine automated
test cases (TC001–TC009) executed and **passed** against UAT build 10.0.46. The **Pick** workflow
(TC010) is in progress, and two customer-specific label tests (TC011–TC012) are pending design.

```
Automated cases executed : 9 (TC001–TC009)
Passed                   : 9
Failed                   : 0
Blocked                  : 0
Pass rate (automated)    : 100%
In progress              : 1 (TC010 — Pick)
Not started              : 2 (TC011, TC012 — label logic)
```

### Status distribution (all catalogued cases)

| Status | Count | Test cases |
|--------|-------|------------|
| Passed (automated) | 9 | TC001–TC009 |
| In Progress | 1 | TC010 |
| To Do | 2 | TC011, TC012 |
| **Total** | **12** | |

## 2. Execution Results — Detail

| TC ID | Title | Process | Site | Automated | Result | Exec. date | Verification |
|-------|-------|---------|------|-----------|--------|-----------|--------------|
| TC001 | Full Produce → label → RAF posting | Produce | 12 | Yes | Passed | 2026-02 (sign-off) | RAF journal posted; batch status updated |
| TC002 | Full Produce → label → RAF posting | Produce | 14 | Yes | Passed | 2026-02 (sign-off) | RAF journal posted; batch status updated |
| TC003 | Production via CR Transfer | CRT | 15 | Yes | Passed | 2026-02-12 | CRT staging synced; RAF journals posted |
| TC004 | Production via Hangback | Hangbacks | 17 | Yes | Passed | 2026-02-11 | Hangbacks staging synced; RAF journals posted |
| TC005 | Convert box Fresh → Frozen | Conversion | 17 | Yes | Passed | 2026-02-11 | Rework/F2F staging; inventory journal posted |
| TC006 | Reprint a label | Reprint | 12 | Yes | Passed | 2026-02-12 | barcode-reprint API → 200 |
| TC007 | Reversal — Produce (CW Tag) | Reversal | 15 | Yes | Passed | 2026-02-11 | RAF Reversal staging; journal posted |
| TC008 | Reversal — CR Transfer (LP) | Reversal | 12 | Yes | Passed | 2026-02-11 | CRT Reversal staging; journal posted |
| TC009 | Reversal — Hangback (LP) | Reversal | 17 | Yes | Passed | 2026-02-11 | Hangback Reversal staging; journal posted |
| TC010 | Pick process from Ardia | Pick | 12 | In Progress | Passed (manual) | 2026-02-12 | CW Gain/Loss transaction |
| TC011 | HEB custom label logic | Label | 12 | To Do | Not run | — | Label content assertion |
| TC012 | Platte Valley label (Denver) | Label | 15 | To Do | Not run | — | Label content assertion |

## 3. Automation Run Metadata

| Item | Value |
|------|-------|
| Execution mode | Standalone scripts: `npx ts-node tests/<tc>.ts` |
| Browser | Chromium (headed, slowMo, `ignoreHTTPSErrors`) |
| Last generated batch order | `AT-055` |
| Last license plate (reversal chain) | `2380005697` |
| Last state timestamp | 2026-05-15T18:20:02Z |
| Cross-process state file | `shared-state.json` |
| Batch ID counter | `at-counter.json` (last = 55) |

## 4. Verification Evidence

Each automated case captures step-level evidence. Representative artifacts:

| Workflow | Evidence captured |
|----------|-------------------|
| Produce (TC001/002) | `screenshot-batch-order-created.png`, `screenshot-batch-order-selected.png`, `screenshot-ardia-loggedin.png`, `screenshot-ardia-filters-selected.png`, `screenshot-ardia-batch-orders.png`, `screenshot-ardia-tile-selected.png`, `screenshot-ardia-weight-entered.png`, `screenshot-ardia-after-enter.png`, `screenshot-ardia-stopped.png` |
| CR Transfer / Hangback (TC003/004) | `screenshot-tc2-*`, `screenshot-tc4-*` |
| Conversion (TC005) | `screenshot-tc4-barcode-entered.png`, `screenshot-tc4-ardia-after-proceed.png` |
| Reprint (TC006) | `screenshot-tc5-reprint-page.png`, `screenshot-tc5-after-save.png` |
| Reversal (TC007–009) | `screenshot-tc5-*`, D365 deletion-form captures |
| Run recording | `Ardia Test Automation.mp4` |
| Failure capture | `screenshot-error.png`, `screenshot-login-error.png` (on failure paths) |

> API verification is asserted in-run via Playwright `waitForResponse` (RAF journal `POST
> /raf/v2/rafjournal` → 200; barcode-reprint → 200). Backend data is confirmed in the relevant D365
> staging / reversal tables.

## 5. Defects

| ID | Title | Severity | Status |
|----|-------|----------|--------|
| — | No open defects in automated workflows (TC001–TC009) | — | — |

> All automated regression cases passed on build 10.0.46. No Critical/High defects open in covered areas.

## 6. Observations & Notes

- **100% pass rate** across the nine automated cases on UAT 10.0.46.
- TC001/TC002 are functionally signed off ("Done"); discrete pass dates were not recorded on the
  status sheet — captured here as the February sign-off window.
- TC010 (Pick) passed manually and is being added to the automated suite.
- TC011/TC012 (customer-specific label logic) are pending design/automation.

## 7. Recommendations

- Complete TC010 automation; design and automate TC011–TC012.
- Adopt the Playwright Test Runner to produce a native HTML report with per-test timing, retries, and
  trace files — improving traceability over the current console-log + screenshot evidence.
- Externalize credentials (currently in `config.ts`) and run the suite in CI per UAT build with
  archived artifacts.
