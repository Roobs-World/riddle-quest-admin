# Native Settings and relaunch — Testing version 14

Riddle Quest Testing version **14**, bundle `30477676368485685`, was uploaded once from clean source `61fc18b0a3df0d6efd69b2b28eb1eeb3abb8e24f` on `facebook`. Meta finished processing and the candidate was explicitly assigned to Testing with SDK **8.0 [Network Enabled Zero Permissions]**. The independently downloaded archive matched SHA-256 `d44c2e9b59b9eea398d8bdd0382149898161a2726bad8ec2d8289a1bb0cae03d` and **2,865,660 bytes**. Exact-artifact acceptance was recorded. Production remained version 9, bundle `29168977262783270`.

See the [machine-readable acceptance record](facebook-testing-version-14-2026-11-27.json) and [local Settings and checkout corrections](facebook-native-action-lifetimes-2026-11-27.md).

## Observed desktop journey

1. Launched the exact Testing row. Initial startup was slow, progressing through Loading and Preparing your game before restoring the Classic coconut puzzle with **920 coins**. This establishes eventual startup, not a latency target.
2. Opened **Settings**, then **Privacy Policy**. Meta displayed **You're leaving Facebook**, identified **Riddle Quest**, and showed `https://roobsworld.com/riddle-quest/privacy`. Settings native-action buttons were disabled while the confirmation was active.
3. Selected **Go back**. Privacy and Terms became enabled again. Selected **Terms of Use**; the next native confirmation identified Riddle Quest and `https://roobsworld.com/riddle-quest/terms`.
4. Selected **Go back** again. Privacy, Terms and **Quit game** were enabled. No external link was followed or terms accepted.
5. Selected **Quit game**. The game iframe disappeared and Facebook returned to its Gaming surface.
6. Relaunched the exact version-14 Play destination. The same coconut puzzle and **920 coins** returned, with **Settings** and **Multiplayer** enabled. The browser title identified **Riddle Quest**.

No SDK replacement, request fixture, runtime state injection or live account replacement was used. No message, invitation, purchase, account deletion, notification opt-in, Production promotion, publication or review submission occurred. The game used its existing ordinary save/exit services; no Firebase source, configuration or deployment was changed.

## Scope and limits

These observations establish native Settings confirmation cancellation, sequential action recovery and quit/relaunch on the exact desktop candidate. They do not reproduce a never-settling Meta eligibility probe or an account change during live checkout. Those defects have separate local tests at the real adapter and mounted-entry boundaries. Commerce remains disabled on the live host; no purchase acceptance is claimed.

The canonical upload preflight passed with 420 runtime files, 422 ZIP entries, 4.51 MB total and 0.71 MB initial resources. Its boundary audit found no Jest gaming-platform SDK, foreign native modules or credential leakage; a separate archive scan found no Qwordly text. The Settings suite passed 39 tests across two suites, and the full injected-SDK browser journey passed in 33.233 seconds after a corrected old-entry failure.

The [version-13 rewarded continuation](facebook-native-subscription-version-13-2026-11-27.md) remains historical evidence. It was not repeated or silently attributed to version 14. Supported mobile hosts, two-account co-play, conditional integrations, live subscriber behavior and provider/backend acceptance still require the work recorded in the [submission checklist](../facebook-api-submission-checklist-2026-11-27.md).
