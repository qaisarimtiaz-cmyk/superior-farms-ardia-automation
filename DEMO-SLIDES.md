# Slide Deck Outline — Ardia × D365 Automated Integration Testing

PowerPoint-ready. Each "Slide" = one slide. Speaker notes are in italics under each.

---

## Slide 1 — Title

# Automated Integration Testing
## D365 ↔ Ardia — Post-Upgrade Validation

Qaisar Imtiaz · QA · June 2026

*Speaker note: "When D365 upgrades, we click run and get repeatable proof that production through Ardia still works — end to end."*

---

## Slide 2 — The Problem

**Why this matters**

- D365 ships periodic **version upgrades** (platform + application)
- After each upgrade, **every integration must be re-validated** — Ardia is one of the most critical
- Today that check is **manual**: slow, error-prone, hard to repeat per site/environment
- **Risk:** a broken integration can silently stop production data from posting — caught late, it hits the plant floor

*Speaker note: Land the risk — late detection impacts the floor.*

---

## Slide 3 — What We Built

**End-to-end automation (Playwright + TypeScript)**

- Drives the **real** D365 and Ardia apps — real logins, real API calls, no mocks
- Tests the **integration, not just a screen**: data flows D365 → Ardia → D365
- Verifies at **two levels**: production API returns 200 **and** D365 staging shows **IsSync = true**
- Every run produces **evidence**: screenshots, video, HTML report

`Create Batch Order (D365) → Produce + Label (Ardia) → Verify Sync (D365)`

*Speaker note: Read the flow line left to right.*

---

## Slide 4 — Live Demo

**Watch one batch order go end to end**

- D365: log in (with MFA) → create a new batch order (auto-generated ID)
- Ardia: select Process / Printer / Site / Warehouse / Location
- Apply **HEB Customer Label** → Start Producing → weight → **Enter** *(API returns 200)*
- D365: open *Report as finished staging data* → filter the order → **IsSync ✓**

*Speaker note: Narrate each phase. Backup = HTML report + screenshots from the last green run.*

---

## Slide 5 — Outcome & Value

**One green run proves the integration works**

- ✅ Batch order created → produced → posted (API 200) → synced (IsSync = true)
- **Faster** upgrade sign-off — minutes vs. hours of manual checking
- **Higher confidence** — verified at API *and* data level
- **Repeatable** across every upgrade, environment, and site
- **Audit-ready** evidence + **earlier** defect detection (in test, not on the floor)

*Speaker note: This is the "so what" slide — pause here.*

---

## Slide 6 — Coverage & Roadmap

**Automated today**

- Produce, CR Transfer, Hangbacks, Fresh→Frozen, Reprint, Reversals, Pick, HEB label — sites 12/14/15/17

**Next**

- Make it a **required gate** in the post-upgrade checklist
- Add remaining customer-label cases (e.g., Platte Valley)
- **Schedule / CI** runs with auto-published reports
- Extend the pattern to **other D365 integrations**

*Speaker note: Close with the title line — "upgrade → click run → signed proof in minutes."*
```
