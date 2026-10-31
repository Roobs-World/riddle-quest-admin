# Complementary browser route verification

Eight focused groups passed. `results-confirmed.json` records each result and its exact immutable artifact path.

- All 16 supported locales were selected through Settings. Each retained its translated heading after closing and reopening Settings, with the correct document language and Arabic right-to-left direction.
- Disconnecting and reconnecting on the game, Settings, and multiplayer intro preserved the `PI` draft. Offline keyboard input sent no guess, coin-spend, skip, completion, or purchase command. Input resumed as `PIA` after reconnecting and returning to play.
- Settings → About → Third-Party Licenses loaded the bundled notice file with HTTP 200 and its dependency/license text.
- An unavailable Daily retained its error rather than silently starting Classic. Settings and Help remained reachable after disconnecting and reconnecting.
- The final rebuilt artifact hides unavailable account deletion for a Jest guest while retaining Register or Log In. No delete command or confirmation is offered.
- The final rebuilt artifact permits a registered mock player to cancel deletion without sending a command, then explicitly confirm mock deletion and reach the Account deleted terminal screen.

The last two cases ran against `artifacts/jest-route-verification-2026-10-22/jest-final-artifact` after the guest-deletion correction. The locale, offline, license, and unavailable-Daily cases used the preceding immutable active-build snapshot; their runtime behavior was unchanged by that correction. The two profile regression cases were rerun on the final artifact rather than repeating the entire unchanged matrix.

All browser traffic was served from a suite-owned loopback server. The Jest SDK script was stubbed, and every other external request was blocked. No real provider account, subscription, charge, invitation, or notification was modified.

Initial runs are retained for diagnosis. Their onboarding label, initial draft-readiness timing, and multiplayer close-label failures were fixture errors corrected to match the existing UI. Expected `ERR_INTERNET_DISCONNECTED` resource errors were recorded separately during deliberate offline checks; uncaught errors and other console errors remained failures.

One initial route failure was a real UI issue. A default Jest guest could confirm Delete Account even though the target adapter withheld the account-deletion capability, resulting in `host-account-capability-unavailable`. Profile now hides both its deletion trigger and any open deletion confirmation when `platformRegistered` is false. Registered and unspecified target behavior remain unchanged. The focused component suite passed all nine cases, portal typechecking passed, and the final artifact passed both guest and registered deletion browser cases.

Relevant evidence:

- `deletion-current-results.json` and `run-deletion-current.log` record the final rebuilt artifact checks.
- `guest-profile-deletion-unavailable.png` and `mock-account-deleted.png` show the final profile outcomes.
- `settings-ar-390.png`, `settings-ja-390.png`, `settings-hi-390.png`, and `settings-en-390.png` show locale presentation.
- `offline-game-390.png`, `offline-settings-390.png`, and `offline-multiplayer-390.png` show the disconnected surfaces.
- `third-party-licenses.png` and `daily-unavailable-recovery.png` show the loaded license document and recovery route.
- `mock-account-deletion-diagnostic.json` and `mock-account-deletion-failure.png` retain the original guest capability mismatch.

The reusable artifact-only harness is `verify-complementary.mjs`. `FOCUSED_JEST_ARTIFACT` selects an immutable artifact, `FOCUSED_CASE_FILTER` limits the run to matching group names, and `FOCUSED_RESULT_FILE` keeps rerun reports separate.
