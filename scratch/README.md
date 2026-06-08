# scratch/ — retired / reference-only files

These files are **not part of the test suite** and are not compiled or run.
They are kept here for reference and can be deleted once no longer needed.

| File | Why it was retired |
|------|--------------------|
| `auth.ts` | Old manual D365 login bootstrap. Wrote to `auth.json` — **conflicted** with `authardia.ts` (both used the same file). Replaced by `tests/auth.setup.ts`, which saves separate `.auth/d365.json` / `.auth/ardia.json` sessions. |
| `authardia.ts` | Old manual Ardia login bootstrap. Same `auth.json` conflict as above. Replaced by `tests/auth.setup.ts`. |
| `test-case-1-login.ts` | Original TC1 proof-of-concept. Superseded by `tests/tc1.ts`, which generates unique batch IDs and exports a reusable `run(browser)`. |
| `tc3-ardia.ts` | Ardia-only filter-panel debugging script (no D365). Useful for isolating Ardia dropdown issues, but not a graded test case. |
| `tc11.ts` | **Exact duplicate of `tc10.ts`** (same `Test Case 10` header, same `testData.TC10`, never had a spec wrapper). Parked to avoid running the Pick flow twice. Restore + give it distinct test data if it was meant to be a separate case. |

Authentication for the live suite now lives in `tests/helpers/auth-flows.ts` and is
bootstrapped once by `tests/auth.setup.ts`.
