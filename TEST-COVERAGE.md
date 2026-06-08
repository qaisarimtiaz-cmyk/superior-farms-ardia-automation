# Test Coverage Sheet — Ardia & D365 Production Automation

| Field | Value |
|-------|-------|
| **Project** | Superior Farms — Ardia App & Dynamics 365 F&O Integration |
| **Prepared by** | Qaisar Imtiaz (QA) |
| **UAT Build** | D365 10.0.46 |
| **Date** | 2026-05-31 |
| **Framework** | Playwright + TypeScript |

---

## 1. Coverage Summary

| Metric | Value |
|--------|-------|
| Total catalogued test cases | 12 |
| Automated | 9 (75%) |
| In progress (automation) | 1 (TC010) |
| Not yet automated | 2 (TC011, TC012) |
| Production processes covered | Produce, CR Transfer, Hangbacks, Conversion (F2F), Reprint, Reversal |
| Processes pending | Pick (in progress), Customer-specific label logic |
| Sites covered | 12, 14, 15, 17 |
| Verification layers | UI · API/network · D365 staging-table data |

### Coverage by process area

| Process / Feature | Test cases | Automated | Coverage |
|-------------------|-----------|-----------|----------|
| Produce → RAF posting | TC001, TC002 | 2 / 2 | ✅ Full |
| CR Transfer (CRT) | TC003 | 1 / 1 | ✅ Full |
| Hangbacks | TC004 | 1 / 1 | ✅ Full |
| Fresh → Frozen conversion | TC005 | 1 / 1 | ✅ Full |
| Label reprint | TC006 | 1 / 1 | ✅ Full |
| Transaction reversal (Tag/LP) | TC007, TC008, TC009 | 3 / 3 | ✅ Full |
| Pick | TC010 | 0 / 1 | 🟡 In progress |
| Customer-specific label logic | TC011, TC012 | 0 / 2 | 🔴 Not automated |

## 2. Requirement / Feature → Test Coverage Matrix

| Feature / Requirement | TC ID(s) | Sites | Automated | Backend / API verification | Status |
|-----------------------|----------|-------|-----------|----------------------------|--------|
| Create batch order in D365 (All Production Orders) | TC001–TC004 | 12,14,15,17 | Yes | Batch order created & started | Passed |
| Ardia Azure AD login + dropdown population | TC001–TC010 | all | Yes | Process/Site/Printer populated | Passed |
| Produce: weights, label print, Stop Producing | TC001, TC002 | 12,14 | Yes | `POST /raf/v2/rafjournal` → 200; RAF staging | Passed |
| CR Transfer production & sync | TC003 | 15 | Yes | CRT Staging Table synced; RAF journals | Passed |
| Hangback production & sync | TC004 | 17 | Yes | Hangbacks Staging Table synced; RAF journals | Passed |
| Fresh→Frozen box conversion | TC005 | 17 | Yes | Rework/F2F Staging; inventory journal posted | Passed |
| Label reprint of today's tag | TC006 | 12 | Yes | barcode-reprint API → 200 | Passed |
| Reversal — Produce CW Tag deletion | TC007 | 15 | Yes | RAF Reversal Staging; journal posted | Passed |
| Reversal — CR Transfer LP deletion | TC008 | 12 | Yes | CRT Reversal Staging; journal posted | Passed |
| Reversal — Hangback LP deletion | TC009 | 17 | Yes | Hangback Reversal Staging; journal posted | Passed |
| Pick: barcode/LP + weight + Post | TC010 | 12 | In Progress | CW Gain/Loss transaction | In progress |
| HEB label: Production Date vs Use/Freeze By | TC011 | 12 | No | Label content (10 HEB variants) | To Do |
| Platte Valley label (Denver / Site 15) | TC012 | 15 | No | Company name + Use By = Prod Date + Shelf Life | To Do |

## 3. Automation Implementation Mapping

> Workflow-level mapping between the org test IDs and the Playwright suite. Code filenames and sheet
> IDs were authored independently — verify exact file links before publishing.

| Org TC | Workflow | Playwright script(s) | Key assertion in code |
|--------|----------|----------------------|-----------------------|
| TC001 | Produce (Site 12) | `tests/tc1.ts` | RAF journal POST → 200 |
| TC002 | Produce | `tests/tc2.ts` | RAF journal POST → 200; writes shared state |
| TC003 | CR Transfer | `tests/tc3.ts`, `tc3-ardia.ts` | RAF journal POST → 200; CRT staging |
| TC004 | Hangback | Produce-flow variant | Hangbacks staging |
| TC005 | F2F Conversion | `tests/tc4.ts` | Barcode entry → conversion; reads shared state |
| TC006 | Reprint | `tests/tc5.ts` | barcode-reprint API → 200 |
| TC007 | Reversal (CW Tag) | `tests/tc6.ts` / `tc7.ts` | Tag deletion; reversal staging |
| TC008 | Reversal (CRT LP) | `tests/tc8.ts` | LP deletion; reads/writes shared state |
| TC009 | Reversal (Hangback LP) | `tests/tc9.ts` | LP deletion; reads/writes shared state |
| TC010 | Pick | — (in progress) | — |
| TC011 | HEB label logic | — (to do) | — |
| TC012 | Platte Valley label | — (to do) | — |

## 4. Coverage Gaps & Risks

| Gap | TC | Risk | Action |
|-----|----|------|--------|
| Pick workflow not yet automated | TC010 | Manual regression effort each build | Complete automation; add API/data assertion for CW Gain/Loss |
| HEB label logic not automated | TC011 | Label-content regressions on 10 HEB variants could ship | Design label-content assertions; automate |
| Platte Valley label not automated | TC012 | Denver-only label rule may regress | Automate Site-15 customer-label verification |
| Label *print output* verified visually only | TC001–TC006, TC011–TC012 | Hardware/print-render issues not auto-detected | Consider label-payload/API or PDF-content checks |
| Exact code↔TC mapping unconfirmed | All | Traceability ambiguity | Pin 1:1 file-to-TC links in this sheet |

## 5. Legend

- ✅ Full — workflow automated and passing.
- 🟡 In progress — automation under development.
- 🔴 Not automated — manual / pending design.
