# Reusable Prompt — Generate an Architecture Diagram for the SF Test Automation Suite

Copy everything inside the code block below and paste it into any AI tool
(ChatGPT, Gemini, Claude, Eraser.io, Excalidraw AI, Mermaid Chart AI, FigJam AI, etc.).

---

```text
You are a software architecture diagramming assistant. Generate a clear, presentation-ready
architecture diagram for the test automation project described below. I am presenting this for a
Lead QA Engineer case, so emphasize engineering structure, separation of concerns, and end-to-end
workflow. Output the diagram as Mermaid (flowchart, left-to-right) by default; if this tool renders
visuals natively, produce a clean visual instead.

=== PROJECT OVERVIEW ===
Name: SF Test Automation Suite
Purpose: End-to-end UI + API automation that validates manufacturing/production workflows across two
integrated systems: Microsoft Dynamics 365 Finance & Operations (cloud ERP) and "Ardia", an on-prem
shop-floor production application.

=== TECH STACK ===
- Language: TypeScript
- Automation framework: Playwright (used as a LIBRARY, not the Playwright Test Runner)
- Execution: standalone async Node scripts run via "npx ts-node tests/<tcN>.ts"
- Browser: Chromium, launched headed with slowMo, ignoreHTTPSErrors enabled (Ardia uses self-signed TLS)
- Assertions: manual checks (throw new Error on failure) plus network/API response interception
- No external CI shown; runs locally and produces screenshot/video evidence

=== PROJECT STRUCTURE (layers) ===
1. Execution Layer
   - ts-node CLI invokes individual test scripts
   - Playwright Chromium drives real browser sessions
2. Configuration & Test Data
   - config.ts  -> URLs, credentials, and timeouts for D365 and Ardia
   - test-data.ts -> per-test-case batch-order data (item, site, warehouse, location, quantity, printer, etc.)
3. Shared Utilities (enable cross-process coordination)
   - generate-id.ts -> generates unique incrementing batch IDs like AT-001, persisted in at-counter.json
   - shared-state.ts -> reads/writes shared-state.json to hand off data between separate test processes
4. Auth Bootstrap
   - auth.ts (D365 login + MFA) and authardia.ts (Ardia login + MFA)
   - Persist Playwright storageState to auth.json for session reuse
5. Test Suite (TC1..TC9), each a standalone script:
   - TC1 / TC2 / TC3: D365 login -> create batch order -> Ardia login -> Produce -> verify RAF journal API
   - TC4: RAF staging barcode -> Ardia conversions (DEPENDS ON TC1's batch order id via shared-state.json)
   - TC5: Ardia Produce -> Reprint / Reversal label, verify barcodereprint API
   - TC6 / TC7: D365 Catch-Weight Tag deletion workflow
   - TC8 / TC9: D365 License Plate / Hangbacks deletion workflow
6. Isolated Browser Contexts (per run)
   - Separate Playwright contexts for D365 and Ardia within one browser
   - Ardia always authenticates fresh (no shared cookies/session with D365)
7. Systems Under Test
   - Dynamics 365 F&O: cloud ERP, behind Azure AD + MFA
   - Ardia: on-prem app at a private IP, self-signed TLS
8. Verification & Evidence
   - API-level checks via Playwright waitForResponse: POST /raf/v2/rafjournal -> 200, barcodereprint -> 200
   - Per-step screenshots (.png), run video (.mp4), and test-results/.last-run.json

=== KEY WORKFLOW / DATA FLOW ===
- A test script reads config + test data, launches Chromium, then opens two isolated contexts (D365 and Ardia).
- Typical happy path: log into D365 -> create a uniquely-numbered batch order -> log into Ardia ->
  select process/printer/site/warehouse/location -> Produce -> intercept and assert the backend API call ->
  capture screenshots throughout.
- Dependent tests communicate across separate Node processes by writing/reading shared-state.json
  (e.g., TC1 writes batchOrderId, TC4 reads it; license-plate/tag IDs are handed off the same way for TC8/TC9).
- Every meaningful step captures a screenshot; failures save an error screenshot and log the last known state.

=== KEY ENGINEERING PATTERNS TO HIGHLIGHT IN THE DIAGRAM ===
- Separation of concerns: environment config, test data, and test logic are decoupled.
- Cross-process state machine: ordered, dependent E2E chains via a JSON state file.
- Context isolation: independent D365 and Ardia sessions in a single browser.
- API-level verification: confirm UI actions at the network layer, not just visually.
- Deterministic identifiers: incrementing AT-NNN IDs prevent collisions across runs.
- Evidence-first: screenshots + video for full traceability.

=== DIAGRAM REQUIREMENTS ===
- Group components into clear layers/subgraphs matching the structure above.
- Show the flow: Execution -> Framework (Config/Data/Utils/Tests) -> Isolated Contexts -> Systems Under Test -> Verification & Evidence.
- Show the shared-state.json handoff between dependent test cases as dotted lines.
- Visually distinguish: Systems Under Test, data/state stores (json files), and verification/evidence outputs.
- Keep labels concise. Use left-to-right layout. Do not invent components that are not listed above.
```

---

## Tips for using this prompt

- For a **simpler** diagram, add to the end: *"Keep it high-level: only show Test Runner, Framework,
  Systems Under Test, and Results — one box each."*
- For a **specific tool format**, swap the output line, e.g.:
  *"Output as PlantUML"* / *"Output as Graphviz DOT"* / *"Output as an Excalidraw scene"*.
- To regenerate the **detailed** version, ask for: *"include all TC1..TC9 groupings and the
  RAF/barcodereprint API nodes."*
