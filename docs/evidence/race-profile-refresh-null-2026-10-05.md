# Race profile refresh ordering — 5 October 2026

A delayed multiplayer profile refresh could erase or rewind a profile that another operation had already updated. The real Reddit adapter returned `null` for a superseded read; the race consumer treated that as a profile replacement. Firebase's explicit profile reads bypassed its existing publication-order check, allowing an older returned profile to overwrite a newer mutation follow-up.

The reduced Reddit reproduction failed 2 of 8 assertions. Skipping the optional null replacement made that same loop pass. A separate Firebase reproduction still failed 2 of 16 assertions: the host had accepted the newer profile, but the earlier race response restored the old one. Routing explicit Firebase reads through its existing account-visit and revision checks fixed that producer-side issue. The final original-source comparison failed 54 of 660 assertions. The fixed development and production matrices passed all 1,320 assertions.

## Change

`useHostRaceCoordination` preserves the current profile when its optional refresh returns null. It retains the existing account ownership result, so a superseded refresh does not cancel an independently completed run's provider follow-up. Retired accounts and host lifetimes still reject that follow-up.

`firebaseServices.loadProfile` now uses the same refresh helper as auth and mutation follow-ups. Only the current account visit and latest requested profile may publish or return a snapshot. Foreign account requests return null without transport. A current explicit read publishes its valid profile to the canonical subscription; superseded reads return null and cannot rewind either that subscription or their caller.

This adds no transport requests or waiting step. It changes client publication and consumption of existing server-authoritative profiles. No visible product text, locales, target capabilities, bridge protocol, purchase grants or deployments changed. Other work in the shared checkout is preserved.

## Reproduction and controls

```sh
pnpm --dir packages/portal test:race-profile-refresh-null:browser
```

The registered command runs development and production fixtures. `RACE_NULL_QUICK=1` selects the smallest viewport. `RACE_NULL_BASELINE_DIR=artifacts/race-profile-refresh-null-2026-10-05` substitutes the captured original coordination and Firebase adapter; `RACE_NULL_REPORT_DIR` selects a separate output directory.

The fixture mounts the actual host-auth and race-coordination hooks in React StrictMode with the real Reddit and Firebase host-service factories. Reddit uses the same-origin gateway envelope and parser. Firebase identity and document transport are injected below the actual adapter. Native provider/backend calls are not made; this is not real SDK or live backend certification.

Both balances 275 and 777 are checked at 390×568, 390×844 and 1280×844. Seven scenarios cover a newer mutation/profile publication, a newer explicit caller, a current read, a newest read still pending, reversed independent race refreshes, a failed newer read and unmount. Tests inspect the actual rendered profile, null replacements, independent follow-up ownership, current valid replacement, errors and external traffic. Unit controls additionally cover account replacement, same-UID sign-out/re-entry, subscription disposal and a foreign requested UID.

The competing explanations were the consumer treating null as a replacement, the provider superseding a current read incorrectly, and subscription ordering. The in-order positive control still updates correctly. The Firebase reproduction further distinguishes a raw explicit read bypassing shared ordering from a race-consumer sequence bug or profile-mapper bug: its newer subscription profile was already correct before the stale return rewound the host.

An initial direct Jest fixture could not import this ESM hook through the repository's CommonJS test transform. Its source and failed logs are retained as fixture development evidence, not a product regression. A first baseline matrix timed out because the old Firebase explicit method returned a profile without subscription publication; the final fixture correctly lets that independent explicit caller consume its return through the real host setter. Original and fixed matrices then use the same final fixture. Earlier incomplete-control outputs are labeled separately.

Native Firefox Start/Refresh buttons confirm the overlapping Reddit and Firebase cases. A current Firebase read applies 777; a later read resolved after unmount keeps the surface removed and returns false ownership. A wrong initial server URL and a tool return error after unmount were fixture/tool observations; the correct server was used and the completed page state was re-read before recording the control.

These checks show profile-state reliability. They do not quantify latency against live providers or certify physical rendering cadence.

## Final verification

| Check | Result |
| --- | --- |
| Profile refresh browser matrix | 1,320 assertions passed |
| Existing race account/refresh ownership | 40 cases passed across both React modes |
| Existing live-result profile return | 6 cases passed |
| Native Firefox | 3 records passed: Reddit overlap, Firebase overlap, current/retired controls |
| Focused Firebase units | 28 passed in 3 suites |
| Full portal units | 2,855 passed in 300 suites; 93 browser-gated tests skipped in 15 suites |
| Types and TSDoc | Passed; 25,519 documented declarations across 1,144 files |
| Six isolated builds and audits | Jest, Facebook, Reddit, YouTube fixture, Netflix and Yahoo passed |
| Built browser checks | 8 tests in 3 suites passed; existing 100 ms buffered-transition check passed |
| Source capture | Same re-enumerated 1,515 selected inputs and SHA-256 hashes before/after verification |
| Preserved builds | 1,300 files; copied hashes match private outputs |

YouTube remains an incomplete-content fixture, not a release certification. The existing ownership harness was copied with only root/output-path adaptation to keep its previous evidence intact.

All owned processes reached terminal status. The private build root, six owned audit-metadata directories, owned fixture caches and temporary related harness were removed after preservation. Owned Firefox pages were closed; the pre-existing blank page remains. No verification process remains running.

Original/final captures, the owned diff, red reproductions, final observations, unit/build logs, artifact hashes, native Firefox records, cleanup ledger and the machine-checked [verification summary](/home/craig-beswetherick/Documents/riddle-quest/artifacts/race-profile-refresh-null-2026-10-05/verification-summary.json) are retained. The broader game-improvement goal remains active.
