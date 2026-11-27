# Jest review feedback — 27 November 2026

This implementation addresses the six items in the supplied Jest review feedback. Work is on `web`, following the user's explicit instruction for this task. This record distinguishes new changes from fixes already present in the source; it does not claim a new hosted gameplay verification.

| Feedback | Implementation and source |
| --- | --- |
| Multiplayer fails or waits indefinitely; provide a guest-named bot when no player joins | The existing server search window is six seconds. This change also seats the fallback during recovery of an interrupted join after that deadline, using the original ticket and one transaction shared with polling. New bots receive stable `Guest_XXXXXX` usernames. Private invitations remain human-only. See [raceLiveService.ts](../../../firebase-functions/src/race/live/raceLiveService.ts), [raceBotName.ts](../../../firebase-functions/src/race/matchmaking/raceBotName.ts), and [AI opponent operations](../../common/hosted/multiplayer-ai-opponents.md). |
| Next Level appears disabled while confirmation is pending | This change replaces the disabled action with the existing accessible loading spinner, then shows Next Level when the existing progression checks allow it. Dialog focus handling follows the newly available action. See [VictoryModalContent.tsx](../../../src/progression/components/rewards/VictoryModalContent.tsx), [completionPresentation.ts](../../../src/gameplay/session/completion/completionPresentation.ts), and [GameModalView.tsx](../../../src/app/modals/components/GameModalView.tsx). |
| Coin packs repeat their quantity in a description | Already fixed: coin packs display their quantity and price; product descriptions render only for subscriptions and durable products. See [ShopModalPage.tsx](../../../src/commerce/components/ShopModalPage.tsx). No new copy or locale changes are needed. |
| Challenge a friend immediately reports a race error | Already fixed in `47bcd335e`: private waiting polls use the same longer search deadline, first-timeout grace and guarded late-response recovery as public searches. Initial entry renders loading, with errors reserved for failed requests. See [LiveRaceGame.tsx](../../../src/races/components/live/LiveRaceGame.tsx), [liveRaceDeliveryDeadline.ts](../../../src/races/live/liveRaceDeliveryDeadline.ts), and [historical regression evidence](fund-hosted-2026-11-26/race-invite-client-regressions.json). |
| Out of Attempts appears twice | Already fixed: the dialog owns the single heading, and its continuation controls do not repeat it. See [GameModalView.tsx](../../../src/app/modals/components/GameModalView.tsx) and [ContinueActions.tsx](../../../src/commerce/components/ContinueActions.tsx). |
| Retrying a level briefly leaves unresponsive controls visible | This change replaces the completed board with a loading spinner while its replacement question is pending. Matching the riddle and session prevents an old outcome from hiding a new round. Settings remains available. Paid continuation also shows a loading status on the board, and continuation, hint and skip dialogs explain their pending state. Existing authority checks still govern when actions become available. See [GameFrameApp.tsx](../../../src/gameplay/components/GameFrameApp.tsx), [ContinueActions.tsx](../../../src/commerce/components/ContinueActions.tsx), and [GameplayCoinActions.tsx](../../../src/commerce/components/GameplayCoinActions.tsx). |

## Verification and release state

- Shared client type checking passed after the final loading-copy changes. The Firebase Functions build, lint, directory-layout and capacity audits passed; locale validation passed for all 16 locales.
- Regression coverage was added for guest names, join retry/reload, concurrent join recovery and polling, private invitation exclusion, and victory loading presentation.
- Tests and browser checks were not run, following the repository instruction requiring an explicit request. Historical checks linked above apply only to their recorded revisions.
- `pnpm release:jest` passed its production gate, target isolation, immutable artifact and W3C HTML checks (zero HTML findings). The artifact contains 104 files, 4.04 MB total and 0.39 MB initial resources.
- Jest confirmed version `01a21b52-2f4a-703e-a40e-7dd8c208257d` ready and active at **27 November 2026, 04:45:08 UTC**. Build: `1.0.0-dev.20261127044408.c032dedd6a7b.7fc2404f`; source: `c032dedd6a7b4a3f0e5e0537915eda1f7dbd9cd6`; ZIP SHA-256: `8ed974b75775b6a7ee2ff63448166aa66300434e476e7838aca898b894a1207e`. The exact version was checked through Jest's `list_game_versions` tool after upload processing.
- The Firebase connector initially reported success without changing deployed revisions. The subsequent selective Firebase CLI deployment completed, and `gcloud functions list --v2` confirmed all six functions below `ACTIVE` with source hash `c048768ff15054dcb6d84ac3abbca7b4b1e1069a` at 04:45 UTC. No other functions were selected for this deployment.

| Function | Region | Deployed revision |
| --- | --- | --- |
| `joinLiveRace` | `europe-west1` | `joinliverace-00033-tac` |
| `updateLiveRace` | `europe-west1` | `updateliverace-00031-juk` |
| `startRaceRun` | `europe-west1` | `startracerun-00035-now` |
| `joinLiveRace` | `us-central1` | `joinliverace-00033-jut` |
| `updateLiveRace` | `us-central1` | `updateliverace-00031-tew` |
| `startRaceRun` | `us-central1` | `startracerun-00065-zij` |

This confirms deployment and build activation, not hosted gameplay acceptance or review approval. Game publication and review submission were not changed.
