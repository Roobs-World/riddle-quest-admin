# Frontend verification

The portal unit/component coverage validates 319 suite files and 3,299 distinct cases as of 22 October 2026. The full run passed 319 suites and 3,296 cases. After the final guest-deletion UI correction, the Profile suite passed all nine cases. These replace its six baseline cases and add exactly three new registration-state cases, giving 3,296 − 6 + 9 = 3,299 distinct validated cases. The final nine-case run was targeted; the entire suite was not rerun after that correction.

The full run includes the first-win guidance gate, exhausted-attempt reward behavior, paid sixth-attempt submission, and final receipt reconciliation regressions. The final Profile run verifies that Jest guests cannot open unavailable deletion, while registered and unspecified target states retain deletion.

The full-suite command was:

```sh
pnpm --dir packages/portal exec jest --config jest.config.cjs --runInBand --testPathIgnorePatterns='\.jest-playwright\.' --json --outputFile=/home/craig-beswetherick/Documents/riddle-quest/artifacts/jest-route-verification-2026-10-22/frontend/unit-results-confirmed.json
```

The initial sandboxed run found a stale Jest SDK product fixture and an environment restriction. The fixture returned `{products: []}` although the installed SDK returns a product array. Its correction uses a nonempty coin product and asserts null-description normalization. The 21 Reddit redirect-isolation cases initially could not bind loopback HTTP servers because the sandbox returned `listen EPERM 127.0.0.1`. The approved complete rerun outside the sandbox passed all 3,296 cases. Initial logs remain available.

Eight complementary browser groups also passed, including all 16 locale selections and Arabic RTL, offline return with preserved drafts on three surfaces, actual bundled license loading, and unavailable-Daily recovery navigation. The guest and registered mock deletion cases passed against the final rebuilt immutable artifact. The other complementary groups used the preceding immutable snapshot; the final runtime correction changed only guest deletion visibility. Exact artifact paths and source reports are retained in `focused-browser/results-confirmed.json`.

The browser checks exposed a real UI capability mismatch: the guest Profile offered Delete Account while the actual Jest adapter withheld that operation. `ProfileModalPage.tsx` now hides both its trigger and any open deletion confirmation when `platformRegistered` is false. Registered and unspecified target behavior remain unchanged. Its regression source is `ProfileModalPage.test.tsx`. Portal typechecking, the declaration documentation audit, and whitespace checks passed after this correction.

No real provider account, charge, subscription, invitation, or notification was modified by these checks. Browser traffic used suite-owned loopback servers; external requests were blocked. This owner did not rebuild shared artifacts. The final deletion checks used the immutable rebuilt artifact supplied by the release owner.

Evidence:

- `unit.log` and `unit-results.json` retain the initial unit failure details.
- `unit-confirmed.log` and `unit-results-confirmed.json` record the complete passing unit run.
- `focused-browser/profile-deletion-unit.log` records the final nine-case Profile run.
- `focused-browser/summary.md` and `focused-browser/results-confirmed.json` consolidate the complementary browser coverage and its exact artifact versions.
- `focused-browser/deletion-current-results.json` and `focused-browser/run-deletion-current.log` prove both deletion routes on the final artifact.
