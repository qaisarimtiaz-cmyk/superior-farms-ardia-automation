# SF Test Automation — Technical Architecture

End-to-end UI + API automation suite validating workflows across **Microsoft Dynamics 365 F&O**
(cloud ERP) and the **Ardia** shop-floor production app (on-prem). Built with Playwright + TypeScript,
run through the **Playwright Test Runner** (the `tcN.ts` logic files also run standalone via `ts-node`).
Authentication is centralized: a one-time `setup` project logs into both systems and saves
`storageState`, which every test reuses — no per-test login.

---

## Architecture Diagram (Mermaid)

> Paste into [mermaid.live](https://mermaid.live), VS Code (Mermaid preview), or hand to the
> Figma `generate_diagram` tool once the Figma integration is connected.

```mermaid
%%{ init: { 'flowchart': { 'nodeSpacing': 100, 'rankSpacing': 180, 'subGraphTitleMargin': { 'top': 10, 'bottom': 10 }, 'padding': 18, 'useMaxWidth': false } } }%%
flowchart LR

  subgraph EXEC["Execution Layer"]
    direction TB
    CLI["ts-node CLI<br/>npx ts-node tests/tcN.ts"]
    PW["Playwright<br/>Chromium · headed · slowMo · ignoreHTTPSErrors"]
    CLI --> PW
  end

  subgraph CONFIG["Configuration &amp; Test Data"]
    direction TB
    CFG["config.ts<br/>URLs · Credentials · Timeouts"]
    TD["test-data.ts<br/>BatchOrderData per test case"]
  end

  subgraph UTILS["Shared Utilities (cross-process state)"]
    direction TB
    GID["generate-id.ts<br/>unique batch IDs (AT-001...)"]
    SS["shared-state.ts<br/>read / write handoff"]
    CNT[("at-counter.json")]
    SST[("shared-state.json")]
    GID --- CNT
    SS --- SST
  end

  subgraph AUTHL["Auth Bootstrap (setup project — runs once)"]
    direction TB
    AS["auth.setup.ts<br/>D365 + Ardia login + MFA"]
    AF["helpers/auth-flows.ts<br/>loginToD365 · loginToArdia<br/>openAuthedD365 · openAuthedArdia"]
    AJ1[("​.auth/d365.json<br/>storageState")]
    AJ2[("​.auth/ardia.json<br/>storageState")]
    AS --> AF
    AF --> AJ1
    AF --> AJ2
  end

  subgraph TESTS["Test Suite — TC1..TC9"]
    direction TB
    G1["TC1 / TC2 / TC3<br/>D365 create batch order -> Ardia Produce"]
    G2["TC4<br/>RAF staging barcode -> Ardia conversions (depends on TC1)"]
    G3["TC5<br/>Ardia Produce -> Reprint / Reversal"]
    G4["TC6 / TC7<br/>D365 Catch-Weight Tag deletion"]
    G5["TC8 / TC9<br/>D365 License Plate / Hangbacks deletion"]
  end

  subgraph CTX["Isolated Browser Contexts (per run)"]
    direction TB
    D365CTX["D365 Context<br/>1920x1080"]
    ARDCTX["Ardia Context<br/>fresh session, no shared cookies"]
  end

  subgraph SUT["Systems Under Test"]
    direction TB
    D365["Dynamics 365 F&amp;O<br/>Cloud ERP · Azure AD + MFA"]
    ARDIA["Ardia App<br/>On-prem 10.164.2.92 · self-signed TLS"]
  end

  subgraph VERIFY["Verification &amp; Evidence"]
    direction TB
    RAF["RAF Journal API<br/>POST /raf/v2/rafjournal -> 200"]
    BRP["barcodereprint API<br/>-> 200"]
    SHOTS["Screenshots per step (.png)"]
    VID["Run video (.mp4)"]
    RES[("test-results/.last-run.json")]
  end

  subgraph REPORTS["Client Reporting"]
    direction TB
    RC["helpers/report-collector.ts<br/>records steps + per-step timing"]
    CR["reporters/client-report.ts<br/>custom Playwright reporter"]
    XLSX[("reports/[TC].xlsx<br/>Excel (exceljs)")]
    HTML[("reports/Client_Execution_Report.html<br/>branded · print -> PDF")]
    RC -- writeExcel --> XLSX
    RC -. attaches client-report-data JSON .-> CR
    CR -- onEnd renders --> HTML
  end

  %% wiring
  CFG --> TESTS
  TD --> TESTS
  PW --> TESTS
  AJ1 -.seeds session.-> D365CTX
  AJ2 -.seeds session.-> ARDCTX

  TESTS --> GID
  TESTS --> SS
  G1 -. writes batchOrderId .-> SST
  G2 -. reads batchOrderId .-> SST
  G4 -. LP / tag handoff .-> SST
  G5 -. LP / tag handoff .-> SST

  TESTS --> D365CTX
  TESTS --> ARDCTX
  D365CTX --> D365
  ARDCTX --> ARDIA

  ARDIA -- network intercept --> RAF
  ARDIA -- network intercept --> BRP
  TESTS --> SHOTS
  TESTS --> VID
  PW --> RES

  TESTS -->|"collector.add(step)"| RC
  PW -.->|"reporter registered in playwright.config.ts"| CR

  classDef sut fill:#1f6feb,stroke:#0b3a8c,color:#fff;
  classDef store fill:#fff4ce,stroke:#caa000,color:#3a2f00;
  classDef verify fill:#d3f9d8,stroke:#2f9e44,color:#0b3d16;
  classDef report fill:#e7e0ff,stroke:#6741d9,color:#2a1a66;
  class D365,ARDIA sut;
  class CNT,SST,AJ1,AJ2,RES,XLSX,HTML store;
  class RAF,BRP,SHOTS,VID verify;
  class RC,CR report;
```

---

## Layer Reference

| Layer | Components | Responsibility |
|-------|-----------|----------------|
| **Execution** | `ts-node`, Playwright Chromium | Drives headed browser runs, TLS bypass for on-prem Ardia |
| **Configuration & Data** | `config.ts`, `test-data.ts` | Single source of truth for URLs/creds/timeouts and per-TC batch-order data |
| **Utilities** | `generate-id.ts`, `shared-state.ts` | Unique ID generation (`at-counter.json`) and cross-process data handoff (`shared-state.json`) |
| **Auth Bootstrap** | `tests/auth.setup.ts`, `tests/helpers/auth-flows.ts` | One-time interactive login + MFA per app; persists `storageState` to `.auth/d365.json` and `.auth/ardia.json`; reused by every test (auto re-login fallback if stale) |
| **Test Suite** | `tests/tc01..tc13.spec.ts` → `tests/tcN.ts` | E2E scenarios across D365 and Ardia (thin spec wrappers over `run(browser)` logic) |
| **Isolation** | Separate D365 / Ardia browser contexts | Prevents session bleed; each context is seeded from its own saved `storageState` |
| **Verification** | API interception + UI assertions + screenshots/video | RAF & barcodereprint status assertions, step-level visual evidence |
| **Client Reporting** | `tests/helpers/report-collector.ts`, `tests/reporters/client-report.ts` | `ReportCollector` records each step with timing → writes an Excel workbook (`exceljs`) and attaches a JSON blob; the custom reporter (registered in `playwright.config.ts`) renders one self-contained, branded `Client_Execution_Report.html` (print → PDF) |

## Key Engineering Patterns

- **Separation of concerns** — environment config, secrets (`.env`), test data, auth, and test logic are fully decoupled.
- **Authenticate once** — a `setup` project logs into D365 + Ardia and saves `storageState`; the
  `e2e` project depends on it, so tests reuse the sessions instead of logging in repeatedly.
- **Cross-process state machine** — dependent tests (TC1→TC4, TC2→TC8, TC3→TC9) hand off
  `batchOrderId` / license-plate IDs via a JSON state file, enabling ordered E2E chains.
- **Context isolation** — D365 and Ardia run in independent Playwright contexts within one browser.
- **API-level verification** — UI actions are confirmed at the network layer (`waitForResponse`
  on `POST /raf/v2/rafjournal` and `barcodereprint`), not just by visual state.
- **Deterministic identifiers** — incrementing `AT-NNN` IDs guarantee no collisions across runs.
- **Evidence-first** — every step captures a screenshot; full run recorded to video for traceability.
- **Single source of report truth** — `ReportCollector` holds the step list once, then drives both
  the Excel workbook and the client-facing HTML report, so the two never drift. The HTML report is
  produced only through the Playwright runner (the reporter reads each test's `client-report-data`
  attachment); standalone `ts-node` runs still emit the Excel file.
