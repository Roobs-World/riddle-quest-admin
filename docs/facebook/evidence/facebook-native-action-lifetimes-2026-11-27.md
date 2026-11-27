# Native action lifetime corrections — 27 November 2026

The remaining-API audit found a reproducible client preparation stall in Settings. Closing Settings while a Meta eligibility probe never settled left its action pending and prevented another native dialog from being admitted, even though the first native prompt had not opened. The original public-interface regression failed with a pending action and an unavailable second operation; 17 existing cases still passed.

## Settings correction

`FacebookPlayerSettingsActions` now bounds only eligibility preparation to eight seconds and settles it immediately when the panel aborts or the adapter retires. An absolute deadline also rejects late results when browser timer delivery is delayed. Late success or rejection cannot invoke a prompt. A later refresh can recover eligibility.

The shared native-dialog gate is unchanged. An already invoked provider prompt retains ownership until Meta settles its promise. A persistent-surface cleanup guard must likewise finish before another dialog is admitted. The new deadline does not pretend either surface has closed. Shortcut attempts are consumed only when the actual native prompt is invoked.

The narrow failing test exercised the real Settings adapter and shared gate with a deferred external SDK response, isolating the preparation wait without production instrumentation. Test-first abort and deadline cases went red before their respective fixes. The final focused run passed **39 tests across two suites**: 26 Settings cases and 13 Messenger-consent cases.

```sh
pnpm exec jest --config jest.config.cjs --runInBand --runTestsByPath platforms/web/facebook/src/engagement/__tests__/FacebookPlayerSettingsActions.test.ts platforms/web/facebook/src/notifications/__tests__/FacebookMessengerBotConsent.test.ts
```

Coverage includes immediate abort, retirement, deadline and refresh recovery, late rejection, throttled timers, independent healthy actions, and held native prompts or surface cleanup remaining exclusive after 60 seconds of simulated time. Independent read-only review found no blocker. Logs: `/tmp/facebook-settings-eligibility-red.log`, `/tmp/facebook-settings-eligibility-deadline-red.log`, and `/tmp/facebook-settings-eligibility-final.log`.

This evidence establishes local behavior. It does not claim a live Meta eligibility timeout, page follow, group join, notification subscription or native dialog was canceled by a timer. Firebase backend source, configuration and provider server modules remain preserved.

## Checkout owner correction

The mounted Facebook entry passed commerce a deletion-only lifetime even though the ad adapter already checked the captured Auth owner. Replacing that account while receipt discovery was pending could therefore open a new native checkout for the retired session. The entry now shares the captured-owner predicate across commerce and the existing native adapters, and guards commerce publication and late startup results with that same owner. Purchase recovery, signed-receipt validation and native-dialog ownership are unchanged.

The integrated browser regression uses the real built entry, commerce session and capability. Only external SDK, HTTP and browser persistence boundaries are fixtures. A control click opens and cancels one fake purchase. A second click holds the external receipt response while the real Auth SDK adopts another isolated fixture account. After releasing the response, the old entry opens a second purchase (expected one, received two); the corrected entry keeps the total at one, with no grant requests.

The first reproduction attempts used an async `waitForFunction` predicate that the installed browser runner treated as truthy before its result settled. Those attempts do not establish account adoption. The final test uses awaited `expect.poll`, checks replacement identity and normalized persistence before release, and uses the real UI's inert state to observe checkout settlement. With this corrected test, the old entry failed in **33.403 seconds** and the exact reviewed correction passed the full integrated journey in **33.233 seconds** (one suite, one test). Logs: `/tmp/facebook-commerce-owner-confirmed-red.log` and `/tmp/facebook-commerce-owner-confirmed-green.log`.

```sh
PORTAL_BROWSER_TESTS=1 pnpm exec jest --config jest.config.cjs --runInBand --runTestsByPath platforms/web/facebook/src/__tests__/facebookBrowser.jest-playwright.test.ts
```

Independent review found no blocker. This proves the stale checkout admission correction locally, not live purchase acceptance or a complete account-switch flow. An owner replacement during initial startup can still leave the existing loader until remount; this work does not add a restart flow or claim that shared presence, storage or outer analytics consent are fully account-bound. Commerce remains disabled on the live Testing host. No real purchase or live account replacement occurred.

## Identity and backend boundary

An independent read-only audit confirmed the Riddle Quest title and upload target `1748953042991569`. The current source and previously accepted version-13 artifact contained no Qwordly branding or Jest gaming-platform integration; Jest test tooling is separate. A new artifact must be built and checked for these corrections.

All 644 tracked files in the protected Firebase Functions, shared Firebase browser client, root Firebase configuration/rules/indexes and platform server paths matched baseline `2834dc910a39aa9add734440ddfb8dfd533d30dc`, with no untracked additions. The existing staging tree contained 994 baseline-identical source files and its generated package stub. No previous hash manifest exists for the ignored compiled output, so compiled-byte equality cannot be independently established. This work did not generate, edit, configure or deploy that backend. Earlier non-Firebase notification-manager cleanup is outside this equality claim.
