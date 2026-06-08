# Superior Farms — Ardia Automation Suite

Playwright + TypeScript automation suite for the Superior Farms 
D365 FinOps / Ardia integration regression testing.

## Why this exists
Microsoft releases D365 FinOps version upgrades every few months.
Running the 12 integration test cases manually on each upgrade 
takes significant time and resources. This suite automates those 
cases so they run unattended after each upgrade.

## What is automated
| TC | Workflow | Status |
|---|---|---|
| TC001 | Produce — Site 12 | ✅ Done |
| TC002 | Produce — Site 14 | ✅ Done |
| TC003 | CR Transfer | ✅ Done |
| TC004 | Hangback | ✅ Done |
| TC005 | F2F Conversion | ✅ Done |
| TC006 | Reprint Label | ✅ Done |
| TC007 | Reversal — CW Tag | ✅ Done |
| TC008 | Reversal — CRT LP | ✅ Done |
| TC009 | Reversal — Hangback LP | ✅ Done |
| TC010 | Pick Process | 🔄 In Progress |
| TC011 | HEB Label Logic | 📋 To Do |
| TC012 | Platte Valley Label | 📋 To Do |

## How to run
```bash
# Install dependencies
npm install

# Run a specific test case (example)
npx ts-node tests/tc1.ts
```

**Prerequisites:** VPN access to Ardia host, live D365 QA environment,
valid `auth.json` (run `npx ts-node auth.ts` first if session expired).

## Methodology
Phase 1 — Manual validation of business workflow  
Phase 2 — Playwright Codegen captures locators → Claude Code generates script → debug  
Phase 3 — Suite runs unattended on each D365 version upgrade  

## Author
Qaisar Imtiaz — Senior QA Engineer, Folio3
