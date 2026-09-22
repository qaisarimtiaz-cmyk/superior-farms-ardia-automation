# Superior Farms — Ardia Automation Suite

Automated testing for Superior Farms' integration between **D365 Finance & Operations** and **Ardia** (the on-prem shop-floor app). It drives real browser sessions through both systems — creating batch orders, producing and labeling product, picking, and reversing transactions — exactly the way a person would, but automatically and repeatably.

**✅ All 13 test cases pass end-to-end.**

## Why this exists

Microsoft releases D365 upgrades every few months. Re-checking that the Ardia integration still works correctly after each upgrade — by hand, every time — takes real time from real people. This suite automates those checks so they can be run in minutes instead of hours, by anyone on the team, not just a QA engineer.

## Prerequisites

Before you start, make sure you have:

- **[Node.js](https://nodejs.org/)** (version 18 or newer) — the runtime this suite runs on.
- **[Visual Studio Code](https://code.visualstudio.com/)** (recommended) — a free code editor. You don't need to write any code to use this suite, but VS Code makes it easy to open the folder, edit test data, and run tests with a few clicks.
- **[Playwright Test for VSCode](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright)** (recommended extension) — once installed, it adds a "Testing" panel to VS Code where you can see every test case and run or debug any of them with a click, instead of typing terminal commands.
- **[Git](https://git-scm.com/downloads)** — to download (clone) this repository, or [GitHub Desktop](https://desktop.github.com/) if you prefer a visual tool.
- **Access to the D365 test environment and the Ardia app**, with a valid Azure AD account.
- **An authenticator app** (e.g. Microsoft Authenticator) set up for that account — logging in requires approving an MFA push notification on your phone.

## New here? Start with the guide

📘 **[CONSULTANT-GUIDE.md](./CONSULTANT-GUIDE.md)** is a complete, no-jargon walkthrough for setting this up and running it yourself — installing the tools, logging in, running a test, and reading the results. If you're not sure where to start, start there.

The two-minute version, for reference:
```powershell
npm install                          # one-time: install everything this suite needs
npx playwright install               # one-time: install the browser it drives
copy .env.example .env               # one-time: create your own config file, then fill it in
npm run test:auth                    # log in (you'll approve a push notification on your phone)
npx playwright test                  # run everything
```

## What's covered

| Test | What it checks |
|---|---|
| TC1 | Create a batch order in D365, produce it in Ardia, confirm the record syncs back |
| TC2 | The same, via the CR Transfer process |
| TC3 | The same, via the Hangback process |
| TC4 | Convert a produced item from Fresh to Frozen |
| TC5 | Reprint or reverse a printed label |
| TC6 / TC7 | Delete a Catch-Weight tag and confirm the reversal is recorded |
| TC8 | Delete a CR Transfer License Plate and confirm the reversal is recorded |
| TC9 | Delete a Hangback License Plate and confirm the reversal is recorded |
| TC10 | Pick an item from on-hand inventory and confirm it syncs to the Cold Scale system |
| TC12 / TC13 | Create a batch order, produce it with a customer-specific label |
| TC14 | Produce a batch order across multiple boxes in one run |

Every run produces a **branded, shareable HTML report** (screenshots included) — see the guide's [Where to find results](./CONSULTANT-GUIDE.md#5-where-to-find-results) section.

## Questions or something not working?

Check the [Troubleshooting](./CONSULTANT-GUIDE.md#9-troubleshooting) and [When to ask for help](./CONSULTANT-GUIDE.md#10-when-to-ask-for-help) sections of the guide first — most issues (login timing, environment mix-ups, temporary data availability) are covered there.

## Author

Qaisar Imtiaz — Senior QA Engineer, Folio3
