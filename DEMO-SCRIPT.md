# Demo Script — Ardia × D365 Automated Integration Testing

**Audience:** Higher management
**Presenter:** Qaisar Imtiaz (QA)
**Duration:** ~15–20 minutes (10 min talk + 5–8 min live demo + Q&A)
**Date:** June 2026

---

## 0. One-line summary (say this first)

> "Every time D365 is upgraded, our integrations have to be re-verified. I've automated the most
> critical one — the Ardia production flow — so that what used to be hours of manual, error-prone
> checking now runs as a single repeatable test that proves a batch order flows from D365, through
> production in Ardia, and syncs back correctly."

---

## 1. The Problem (Why we're here) — ~2 min

- **D365 does periodic version upgrades** (platform + application releases).
- After every upgrade, **all integrations must be re-validated** before we trust production — the
  Ardia shop-floor app is one of the most important.
- Today that validation is **manual**: create batch orders by hand, produce in Ardia, then dig
  through D365 staging tables to confirm the data synced. This is:
  - **Slow** — many steps across two systems, repeated per site/process.
  - **Error-prone** — easy to miss a failed sync or mis-read a staging row.
  - **Hard to repeat** — every upgrade, every environment, from scratch.
- **Risk:** a broken integration after an upgrade can silently stop production data from posting —
  caught late, it impacts the plant floor.

**The ask this solves:** make post-upgrade integration validation *fast, repeatable, and provable.*

---

## 2. Agenda — ~1 min

1. The problem: upgrades → integration re-validation (above)
2. What we built: automated end-to-end test of the D365 ↔ Ardia produce flow
3. **Live demo:** batch order → production → sync verification
4. Outcomes & value
5. Coverage today + roadmap
6. Q&A

---

## 3. What We Built — ~3 min

An **automated end-to-end test suite** (Playwright + TypeScript) that drives the *real* applications
exactly as a user would — across both systems in one run:

```
   D365 (Cloud ERP)            Ardia App (Shop floor)            D365 (Cloud ERP)
 ┌───────────────────┐      ┌────────────────────────┐      ┌──────────────────────┐
 │ Create batch order │ ───▶ │ Produce: weight, label │ ───▶ │ Verify staging data:  │
 │ (Production order) │      │ + Customer Label (HEB) │      │ row present, IsSync ✓ │
 └───────────────────┘      └────────────────────────┘      └──────────────────────┘
```

Key points to land with management:
- **Tests the integration, not just a screen** — it confirms data actually flows D365 → Ardia → D365.
- **Verification at two levels:** the system's own API call returns success (HTTP 200), *and* the
  D365 staging table shows the produced tag with **IsSync = true**.
- **Repeatable & evidence-based:** every run produces screenshots, a video, and an HTML report —
  proof we can attach to each upgrade sign-off.
- **Covers the full produce family** today: standard Produce, CR Transfer, Hangbacks, conversions,
  reprints, reversals, pick, and customer-specific labels (HEB / Platte Valley).

---

## 4. Live Demo — ~5–8 min

> **Setup before the meeting:** test environment reachable, MFA device handy, run headed so they can
> watch the browser. Have the HTML report from a previous green run open in a second tab as backup.

**What I'll run:** the D365 → Ardia produce-with-HEB-label test (TC12). Narrate each phase:

| On screen | Say this |
|-----------|----------|
| D365 logs in, opens All Production Orders | "The test signs into D365 just like a user — including MFA." |
| New batch order created (auto ID, e.g. AT-0xx) | "It creates a brand-new batch order with a unique ID — no manual data setup." |
| Ardia logs in, selects Process/Printer/Site/WH/Location | "Now it switches to the Ardia shop-floor app and sets up the produce run." |
| Finds the batch tile, Customer Label → HEB → Save | "It picks the order we just created and applies the HEB customer label." |
| Start Producing → weight → **Enter** | "On Enter, Ardia posts to the RAF journal API — the test asserts that call returns 200." |
| Stop Producing | "Production complete." |
| Wait ~2 min, open Report as finished staging data | "We give the integration time to sync, then go back into D365 to verify." |
| Filter Production = AT-0xx, row shows **IsSync ✓** | "There's our tag, and IsSync is true — the produced data synced back into D365 correctly." |
| Console / HTML report shows ✅ PASSED | "One green result = the integration works on this build." |

> **If anything is slow/flaky live:** switch to the backup HTML report + screenshots from the last
> green run. The story is identical: "this is the proof artifact every run generates."

---

## 5. Outcome & Value — ~2 min

**What a single green run proves:**
- A batch order can be created in D365 ✔
- It is producible in Ardia, incl. customer-specific labeling ✔
- The production post succeeds at the API level (200) ✔
- The result syncs back into D365 staging with **IsSync = true** ✔

**Business value:**
- **Faster upgrade sign-off** — minutes of automated checking vs. hours of manual steps.
- **Higher confidence** — verified at API *and* data level, not just "the screen looked fine."
- **Repeatable across upgrades & environments** — same test, every release, every site.
- **Audit-ready evidence** — screenshots, video, and an HTML report per run.
- **Earlier defect detection** — integration breaks surface in test, not on the plant floor.

---

## 6. Coverage Today & Roadmap — ~1 min

**Automated now:** Produce → RAF, CR Transfer, Hangbacks, Fresh→Frozen conversion, label reprint,
tag/LP reversals, Pick, and HEB customer-label produce — across sites 12/14/15/17.

**Roadmap:**
- Fold the suite into the **post-upgrade checklist** as a required gate.
- Add the remaining customer-specific label cases (e.g., Platte Valley).
- Run automatically on a schedule / in CI and publish the report to the team.
- Extend the same pattern to other D365 integrations beyond Ardia.

---

## 7. Closing line

> "The goal is simple: when D365 upgrades, we click run, and within minutes we have signed,
> repeatable proof that production through Ardia still works end to end — before it ever reaches
> the floor."

---

## 8. Likely questions (prep)

- **"How long does it take?"** — A full produce-to-sync run is a few minutes (the 2-minute wait is
  the integration's own sync time, not the test). Far faster and more reliable than manual.
- **"Is it testing the real system?"** — Yes. It drives the actual D365 and Ardia apps in a browser,
  real logins, real API calls — no mocks.
- **"What happens when it fails?"** — The run stops, marks failure, and saves an error screenshot +
  video pinpointing the step, so we know exactly where the integration broke.
- **"Can anyone run it?"** — Yes: one command produces the HTML report. We can also schedule it.
- **"How much maintenance?"** — Low; tests are data-driven and reuse shared building blocks. UI
  changes after big upgrades may need small selector updates.
- **"Why now?"** — Upgrade frequency + the cost of a late-caught integration break justify making
  this validation automatic and standard.
```
