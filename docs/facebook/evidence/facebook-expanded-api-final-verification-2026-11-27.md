# Expanded Facebook candidate verification — 27 November 2026

The second candidate unit adds optional private tournaments, Messenger bot permission and all four generic profile-overlay factory alternatives to the [first expanded unit](facebook-expanded-api-build-2026-11-27.md). It extends the owner-requested `facebook` branch. This records local verification; the new candidate has not been uploaded or accepted by Meta.

## Verification results

The owner explicitly authorized focused automated tests and browser verification on 27 November.

| Check | Result |
| --- | --- |
| Combined focused Jest regression run | **398 tests, 27 suites passed** |
| Integrated Facebook browser journey | **1 test, 1 suite passed**, 26.936 seconds |
| Production `pnpm build:facebook` | **420 files, 4.50 MB total, 0.70 MB initial resources** |
| `pnpm preflight:facebook-backend` | Passed environment/secret bindings, 25 Facebook exports, directory layout, type checks, lint, build, dependency-cycle/deployment-artifact and function-capacity audits |
| `pnpm check:facebook-profile-boundary` | Passed; raw profile values remain inside provider overlays |
| Profile-boundary audit regression checks | **3 tests passed** |
| `git diff --check` | Passed |

The production build also passed TypeScript, platform layout, target isolation, commerce activation, all 16 locale keys/placeholders, third-party notices and the Facebook artifact audit. It includes both canonical XML files under `facebook-overlays/`. The existing ineffective-dynamic-import warning does not prevent the build. No Jest browser client, native module or private-credential leakage was found. The backend preflight builds locally; it does not establish a deployed revision or deploy anything.

Logs are local verification outputs: `/tmp/riddle-quest-facebook-focused-tests.log`, `/tmp/riddle-quest-facebook-browser-second-unit.log`, `/tmp/riddle-quest-facebook-api-final-build.log`, and `/tmp/riddle-quest-facebook-backend-preflight.log`.

## Behavior covered

The focused run covers bootstrap, commerce and purchase recovery, authoritative receipt scoring, context/tournament parsing and reconciliation, native social actions, banner retirement, haptic preferences, settings cancellation, protected saves, ad lifecycle, sharing, generic overlays and Messenger consent. Private tournaments include 37 new cases in addition to the 13 session-score cases. They cover current-context binding, compatible higher-is-better score data, explicit group choice, ambiguous creation recovery and account retirement. Bot consent adds 13 regressions. Profile overlays cover 32 existing/new cases.

The full browser harness builds an isolated fixture artifact with an injected SDK and fake backend. Existing startup, gameplay, saves, reload/pause, sharing, third-win interstitial, rewarded continuation, account cleanup and tournament journeys still pass. Additional checks establish:

- Opening Settings reads Messenger status without prompting. Two explicit clicks admit one subscribe action; success hides it without changing the manager's notification preference or issuing preference writes.
- The generic asynchronous file factory loads the actual bundled XML into sandboxed fixture frames. Frames have the translated title, `tabIndex=-1` and reserved 64px layout. Raw profile getters are trapped rather than used.
- Foreign photo events are ignored. An owned photo error switches to a name-only view once; both views are destroyed and removed on retirement, and stale events do nothing.

The mobile [Messenger Settings](expanded-api-2026-11-27/settings-messenger-eligible-mobile.png), [generic profile](expanded-api-2026-11-27/generic-profile-mobile.png) and [name fallback](expanded-api-2026-11-27/generic-profile-name-fallback-mobile.png) screenshots were inspected. These show fixture rendering, not actual Meta-owned XML rendering or native dialogs.

## Deployment state and remaining work

Production defaults leave banner ads, private tournaments and Messenger bot permission disabled. Their independent placement, scoring/allowlist and review prerequisites remain unresolved. The fixture enables Messenger consent solely for local coverage; it does not change production configuration or subscribe a real player.

The [79-entry API matrix](../facebook-api-submission-checklist-2026-11-27.md) retains six integration gaps: cross-game switching, four legacy/associated-app identity APIs, and manager-owned NEZP stored notification content. These require actual destinations/associations and an authoritative linking/content workflow. Dormant declarations are not counted as integrations.

Meta still serves the historical version 9 recorded in the [dashboard evidence](facebook-dashboard-api-prerequisites-2026-11-27.md). Final native journeys, real device/accessibility checks, partner approvals and exact uploaded-artifact acceptance remain open. No upload, Testing/Production assignment, backend deployment, permission change, real bot subscription, message, group invitation, purchase or review submission was performed for this candidate.

The upload CLI currently requires `main`; this candidate is on the owner-requested `facebook` branch. Packaging is local, but an upload needs an explicit owner request and resolution of that branch requirement. No branch gate has been bypassed.
