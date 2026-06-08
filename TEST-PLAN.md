# Test Plan — Superior Farms / Ardia & D365 Production Automation

| Field | Value |
|-------|-------|
| **Project** | Superior Farms — Ardia App & Dynamics 365 F&O Integration |
| **Document** | Test Plan (Automation + Functional) |
| **Author** | Qaisar Imtiaz (QA) |
| **Version** | 1.0 (draft) |
| **Date** | 2026-05-31 |
| **UAT Build Under Test** | D365 10.0.46 |
| **Status** | For review |

---

## 1. Introduction

This test plan covers end-to-end validation of the production workflows shared between
**Microsoft Dynamics 365 Finance & Operations (D365 F&O)** — the cloud ERP — and the **Ardia App**,
an on-premise shop-floor production application. The two systems exchange data through staging tables
and backend APIs (RAF journal, barcode reprint, conversion, and reversal staging tables).

The plan documents the test objectives, scope, approach, environment, test inventory, and the
automation coverage delivered through a Playwright + TypeScript automation suite.

## 2. Objectives

- Validate the complete **Produce** workflow from D365 batch-order creation through Ardia label
  printing and RAF posting back into D365.
- Validate alternate production processes: **CR Transfer (CRT)**, **Hangbacks**, and **Pick**.
- Validate **Fresh-to-Frozen (F2F) conversion** and **label reprint** features.
- Validate **transaction reversal** (Tag / License Plate deletion) across Produce, CR Transfer, and
  Hangback flows, confirming reversal staging tables and journals.
- Validate **customer-specific label logic** (HEB production-date labels, Platte Valley Food Group).
- Confirm that each UI action produces the correct backend result (staging-table sync, journal
  creation/posting, batch-order status update).
- Automate regression-critical workflows to enable fast, repeatable verification per UAT build.

## 3. Scope

### 3.1 In Scope
- D365 batch-order creation under Production Control > All Production Orders.
- Ardia App login via Azure AD (MFA), filter selection (Process / Site / Warehouse / Location / Printer),
  and the Produce / CRT / Hangback / Pick / Conversion / Reprint flows.
- Backend verification: RAF Staging, CRT Staging, Hangbacks Staging, Rework/F2F Staging, and the
  corresponding Reversal Staging tables; journal creation and posting; batch-order status.
- API-level verification of `POST /raf/v2/rafjournal` and the barcode-reprint endpoint.
- Customer-specific label content (HEB, Platte Valley Food Group).

### 3.2 Out of Scope
- Physical printer hardware validation (label print output is verified visually, not via hardware).
- D365 platform/infrastructure, Azure AD identity provisioning, and network/VPN configuration.
- Performance, load, and security testing.
- Non-production modules of D365 not involved in the Ardia integration.

## 4. Systems Under Test

| System | Type | Notes |
|--------|------|-------|
| Dynamics 365 F&O | Cloud ERP | Access via Azure AD + MFA |
| Ardia App | On-premise web app | Private network host, self-signed TLS certificate |
| Integration layer | Staging tables + REST APIs | RAF / CRT / Hangbacks / F2F / Reversal staging; RAF journal & barcode-reprint APIs |

## 5. Test Approach & Strategy

### 5.1 Levels & Types
- **Functional / E2E testing** across D365 and Ardia for each production process.
- **Integration testing** at the staging-table and API layer (data sync, journal posting).
- **Regression testing** via the automation suite on each UAT build.

### 5.2 Automation Framework
- **Language:** TypeScript
- **Automation library:** Playwright (used as a library; tests run as standalone scripts via `ts-node`)
- **Browser:** Chromium (headed, slowMo, TLS errors ignored for the on-prem Ardia host)
- **Execution:** `npx ts-node tests/<tc>.ts`
- **Design patterns:**
  - Decoupled **configuration** (`config.ts` — URLs, credentials, timeouts) and **test data**
    (`test-data.ts` — per-test batch-order data).
  - **Isolated browser contexts** for D365 and Ardia within a single browser run (Ardia always
    authenticates fresh; no session bleed).
  - **Cross-process state handoff** via `shared-state.json` for dependent test chains (e.g., a created
    batch order or license-plate ID is passed from a producing test to a reversal/deletion test).
  - **Deterministic identifiers** — auto-incrementing `AT-NNN` batch IDs (`at-counter.json`) avoid
    collisions across runs.
  - **API-level assertions** — `waitForResponse` confirms backend calls return HTTP 200, not just UI state.
  - **Evidence capture** — per-step screenshots (`.png`), run video (`.mp4`), and run summary
    (`test-results/.last-run.json`).

### 5.3 Verification Methods
For each test, results are confirmed at three layers:
1. **UI** — expected screens, tiles, buttons, and confirmation states in D365 and Ardia.
2. **API / network** — interception of backend calls and assertion of HTTP 200 responses.
3. **Data** — staging-table records synced, journals created/posted, batch-order status updated in D365.

## 6. Test Environment

| Item | Detail |
|------|--------|
| D365 F&O | UAT build **10.0.46** (cloud), Azure AD + MFA |
| Ardia App | On-prem host (self-signed TLS); RAF journal + reprint APIs |
| Test workstation | Windows, Node.js + Playwright/Chromium |
| Sites under test | 12, 14, 15, 17 (per test case) |
| Credentials | Managed in `config.ts` (see Risk R-1 — move to secrets) |

## 7. Test Data

- Batch orders are created per test case using item/variant/site/warehouse/location combinations
  defined in `test-data.ts`.
- Representative data (from the status sheet):
  - **Produce (Site 12):** Item FG Item 20, Variant 10043, Location 12140
  - **CR Transfer (Site 15):** Batch `15-60205-CRT12026RCL`
  - **Hangback (Site 17):** Batch `V46-HB-15-1`
  - **F2F Conversion:** barcode `(01)90717497100436(3202)006222(11)260210(21)0800411418`
  - **Reversal (CW Tag / LP):** barcodes such as `0401755750`, `2650018671`, `2280001131`
  - **HEB label variants:** 14573, 14575, 14577, 14579, 14000, 12932, 10354, 10201, 10051, 11385
  - **Platte Valley variants (Site 15):** 14516–14570 series, plus 14665, 14680
- Auto-generated batch IDs use the `AT-NNN` scheme for automated Produce runs.

## 8. Test Case Inventory

> Source of truth: organizational status sheet (Superior Test Automation Status — Ardia).
> Automation status reflects the sheet's "Is Automated?" column.

| TC ID | Title | Site | Process / Area | Automated | Status |
|-------|-------|------|----------------|-----------|--------|
| TC001 | Full Produce workflow: D365 batch → Ardia label print → RAF posting | 12 | Produce | Yes | Done / Passed |
| TC002 | Full Produce workflow: D365 batch → Ardia label print → RAF posting | 14 | Produce | Yes | Done / Passed |
| TC003 | Production via **CR Transfer** process | 15 | CRT | Yes | Passed (2/12/2026) |
| TC004 | Production via **Hangback** process | 17 | Hangbacks | Yes | Passed (2/11/2026) |
| TC005 | Convert a box **Fresh → Frozen** (F2F conversion) | 17 | Conversion | Yes | Passed (2/11/2026) |
| TC006 | **Reprint** a label successfully | 12 | Reprint | Yes | Passed (2/12/2026) |
| TC007 | Transaction **reversal** — Produce option (CW Tag deletion) | 15 | Reversal | Yes | Passed (2/11/2026) |
| TC008 | Transaction **reversal** — CR Transfer (License Plate deletion) | 12 | Reversal | Yes | Passed (2/11/2026) |
| TC009 | Transaction **reversal** — Hangback (License Plate deletion) | 17 | Reversal | Yes | Passed (2/11/2026) |
| TC010 | **Pick** process from Ardia App | 12 | Pick | In Progress | Passed (2/12/2026) |
| TC011 | HEB custom label logic: Production Date vs. Use/Freeze By | 12 | Label logic | To Do | To Do |
| TC012 | Customer-specific label: Platte Valley Food Group (Denver only) | 15 | Label logic | To Do | To Do |

### 8.1 Detailed Steps (per test case)

**TC001 / TC002 — Full Produce Workflow**
1. Create a new batch order in Production Control > All Production Orders.
2. Open Ardia App, log in via Azure AD; verify Process / Site / Printer dropdowns are populated.
3. Select **Produce**, choose Site / Warehouse / Location and a Printer.
4. Select the newly created batch-order tile; click **Start Producing**, input weights, press Enter.
5. Verify the printed label output.
6. Click **Stop Producing**; navigate to D365 System Admin > RAF Staging Table.
7. Verify RAF Journals are posted and batch-order status is updated in D365.

**TC003 — CR Transfer**
1. Create a new batch order in D365. 2. In Ardia, select process **CR Transfer**, Site/WH/Location, Proceed.
3. Select the tile, Start Producing. 4. Enter weights, press Enter. 5. Stop Producing.
6. In D365 System Administration, open the **CRT Staging Table** and verify transactions are synced.
7. Verify batch order started and RAF journals posted.

**TC004 — Hangback**
Same as TC003 but process = **Hangbacks**; verify the **Hangbacks Staging Table** sync, batch start, and RAF journals.

**TC005 — Fresh → Frozen Conversion**
1. Take a tag generated in Ardia as a fresh item. 2. Copy the box barcode. 3. Scan/enter the barcode in
Ardia > Conversion screen. 4. Verify transaction status in **Rework and F2F Staging Table** and that the
inventory journal is posted.

**TC006 — Reprint Label**
1. Ardia App > Process = Produce. 2. From the Produce screen, click **Reprint**. 3. Select a tag generated
today and click Reprint. (If the list is empty, generate a box first, then reprint that tag.)

**TC007 / TC008 / TC009 — Transaction Reversal (Tag / License Plate deletion)**
1. D365 > Production Control > Periodic Tasks > **Tag or License Plate deletion** form.
2. Enter the box barcode (Produce CW Tag / CR Transfer LP / Hangback LP) and click **Delete All**.
3. Verify the corresponding **Reversal Staging Table** (RAF / CRT / Hangback) shows the transaction
reversed and the journal created and posted.

**TC010 — Pick (Ardia)** *(In Progress)*
1. Ardia App > Process = **Pick**. 2. Select Batch order from the left menu. 3. Enter Barcode/LP.
4. Enter Weight. 5. Click Post. 6. Verify the CW Gain/Loss transaction.

**TC011 — HEB Custom Label Logic** *(To Do)*
1. Create a batch order using a target Variant (e.g., 14573). 2. Log in; select Produce, Site, WH,
Location, Printer. 3. Ensure **HEB** is the selected Customer. 4. Process the batch (Start Producing →
Weight → Enter). 5. Verify the printed label replaces "Use or Freeze by" with "Production Date:
[xx/xx/xxxx]". 6. Repeat with a non-listed variant and confirm it still prints "Use or Freeze by".

**TC012 — Platte Valley Food Group Label (Denver / Site 15)** *(To Do)*
1. Create a batch order in Site 15 using a listed variant (e.g., 14516). 2. Log in; select Site 15 and
Produce. 3. Select batch, customer, enter weights, trigger label print. 4. Confirm Company Name =
"Platte Valley Food Group" and "Use By Date" = Production Date + Shelf Life. 5. Verify other label
fields unchanged. 6. Confirm a different site/customer still prints "Superior Farms".

## 9. Automation Coverage Mapping

| Workflow | Org TC IDs | Automated | Implemented in (Playwright suite) | Backend verification |
|----------|-----------|-----------|-----------------------------------|----------------------|
| Produce → RAF | TC001, TC002 | Yes | `tests/tc1.ts`, `tc2.ts` | `POST /raf/v2/rafjournal` → 200; RAF staging |
| CR Transfer | TC003 | Yes | `tests/tc3.ts` (+ `tc3-ardia.ts`) | CRT staging sync; RAF journals |
| Hangback | TC004 | Yes | `tests/` Produce-flow variant | Hangbacks staging sync; RAF journals |
| Fresh→Frozen conversion | TC005 | Yes | `tests/tc4.ts` (barcode → conversion) | Rework/F2F staging; inventory journal |
| Reprint label | TC006 | Yes | `tests/tc5.ts` | barcode-reprint API → 200 |
| Reversal (CW Tag) | TC007 | Yes | `tests/tc6.ts` / `tc7.ts` | RAF Reversal staging |
| Reversal (LP — CRT / Hangback) | TC008, TC009 | Yes | `tests/tc8.ts` / `tc9.ts` | CRT / Hangback Reversal staging |
| Pick | TC010 | In Progress | — | CW Gain/Loss transaction |
| HEB / Platte Valley label logic | TC011, TC012 | To Do | — | Label content assertions |

> Note: the code filenames (`tc1.ts…tc9.ts`) and the status-sheet IDs (TC001…TC012) were authored
> independently and do not map 1:1 (sites/variants differ in places). The mapping above is at the
> **workflow** level; confirm exact file-to-TC links before publishing in the org template.

## 10. Entry & Exit Criteria

**Entry**
- UAT build deployed and accessible (D365 10.0.46 + Ardia).
- Test accounts provisioned with Azure AD/MFA; required sites/variants configured.
- Test data and printers available; automation environment set up (Node, Playwright).

**Exit**
- All in-scope automated test cases (TC001–TC009) executed and passing on the build.
- TC010 completed and added to the automated suite.
- TC011–TC012 designed, executed, and (if approved) automated.
- All defects triaged; no open Critical/High defects in covered workflows.
- Evidence (screenshots/video/run results) captured and archived per case.

## 11. Risks & Mitigations

| ID | Risk | Impact | Mitigation |
|----|------|--------|------------|
| R-1 | Credentials stored in plaintext in `config.ts` | Security exposure | Move to environment variables / a secrets store; scrub before sharing repo/screenshots |
| R-2 | Azure AD MFA prompts require manual approval | Run interruption | Pre-seeded `storageState` (`auth.json`); allow generous MFA timeouts |
| R-3 | Ardia self-signed TLS / private-network host | Connectivity/cert failures | `ignoreHTTPSErrors` enabled; VPN/network access verified before runs |
| R-4 | Tests run as standalone scripts (no test runner) | No built-in parallelism/retries/reporting | Roadmap: migrate to `@playwright/test` for fixtures, retries, HTML reports |
| R-5 | Dependent test ordering via `shared-state.json` | Order-sensitive failures | Document run order; validate state file presence before dependent tests |
| R-6 | UI selector drift between Ardia builds | Flaky tests | Prefer role/text selectors; review after each UAT build |

## 12. Deliverables
- This Test Plan.
- Automation suite (Playwright/TypeScript) with per-case scripts.
- Execution evidence: screenshots, run video, `test-results/.last-run.json`.
- Test status sheet (org format) updated per build.
- Defect reports (as applicable).

## 13. Roadmap / Recommendations
- Complete TC010 automation; design and automate TC011–TC012 label-logic checks.
- Migrate to the Playwright Test Runner for parallel execution, retries, and HTML reporting.
- Externalize secrets and parameterize environments (UAT/SIT/PROD).
- Add CI execution per UAT build with archived artifacts.
