# Reddit approval preparation — 2026-09-19

Status: prepared from repository evidence and official documentation; not submitted
and not a Reddit approval receipt. Local engineering results are recorded in the
[cross-platform handoff](reddit-cross-platform-handoff-2026-09-19.md).

## Dashboard and access

- App: https://developers.reddit.com/apps/riddle-quest
- Fetch status: https://developers.reddit.com/apps/riddle-quest/developer-settings
- Owner: `u/RareAdvertising2367`.
- Both checked Chrome profiles (`Default` and `Profile 1`) rendered logged-out
  controls and denied private app access. Automation-owned sessions were closed.
  Owner login and any account verification must happen in the browser; credentials
  should not be copied into chat or evidence.
- Latest recorded private playtest: `0.0.1.21` in `r/riddle_quest_dev`.
  This is not the approval status of a production release.

## Fetch review text

Requested host: `us-central1-riddle-quest-ec2b2.cloudfunctions.net`.

Riddle Quest's request-scoped Devvit server calls four fixed HTTPS endpoints:
`exchangeRedditIdentity`, `deleteRedditAccount`, `redditStorage`, and
`redditGameplay`. These connect the game to its existing Firebase authority for
global accounts, persistent progress, transactional balances, purchase fulfillment,
refunds, and deletion. Devvit Redis is installation-scoped and cannot replace that
global transactional account/economy authority. Requests are signed and scoped to
the current Reddit identity and operation. The webview uses only same-origin
`/api/*` and contains no Firebase browser SDK. No advertising SDK is included.

This explanation is already present in the package README's Fetch Domains section.
Under Reddit's [HTTP Fetch procedure](https://developers.reddit.com/docs/capabilities/http-fetch),
upload/playtest queues configured domains for review. Inspect the current request
before attempting another submission. Cloud-provider access still requires Reddit
to accept the limited-scope justification.

## Products for review

All products are consumable game coins; fulfillment and refund handling use the
server ledger and replay protection.

| Product ID | Reddit Gold | Game coins |
| --- | ---: | ---: |
| `riddle_quest_coins_250` | 50 | 250 |
| `riddle_quest_coins_550` | 100 | 550 |
| `riddle_quest_coins_900` | 150 | 900 |
| `riddle_quest_coins_1600` | 250 | 1,600 |
| `riddle_quest_coins_3400` | 500 | 3,400 |
| `riddle_quest_coins_7000` | 1,000 | 7,000 |

Source: `packages/core/src/pricing/redditCatalog.ts`. Local checkout, cancellation,
grant, and reload verification is recorded in [Gold evidence](reddit-gold-2026-09-19.md).
It does not establish a real payment or approved products. Reddit's
[payment publishing procedure](https://developers.reddit.com/docs/earn-money/payments/payments_publish)
reviews products with app publication.

## Policy metadata

- Terms: https://roobsworld.com/riddle-quest/terms — published; see the
  [publication record](website/riddle-quest-terms-publication-2026-09-19.md).
- Existing privacy destination: https://roobsworld.com/privacy — game-specific
  coverage remains unresolved. Use the [data inventory](../privacy-data-inventory.md)
  to cover Reddit identity, Firebase processing, Gold receipts, deletion, retained
  replay safeguards, and backend logs accurately.
- Support: `grindheadgames@gmail.com`.
- Publisher identity is established in the terms publication record; it does not
  need to be requested again. Operational retention and privacy-role decisions are
  separate from the publisher's company details.

## Remaining work and decisions

1. Obtain authenticated dashboard access and capture fetch/product/policy status.
2. Resolve the pending release-scope question: Gold purchases are requested;
   existing architecture excludes initial push notifications and uses polling.
   The current contract gate nevertheless requires native realtime and notification
   fixtures. Any scope-aware validator must prove excluded capabilities stay disabled;
   fabricated fixtures cannot satisfy this gate.
3. Confirm the production community. Architecture names `r/RiddleQuest`, an existing
   installation uses `r/RiddleQuestGame`, and the private test community is separate.
4. Complete game privacy coverage and update app policy metadata.
5. Capture actual hosted contracts and web/iOS/Android journeys with the required
   account roles. Injected harnesses are not physical-device evidence.
6. Implement and verify the exact-byte submission path required by the repository's
   release contract. The current direct-release guard blocks Devvit commands that
   rebuild/create versions. This is an engineering task, not an owner-approval toggle.
7. Submit the verified candidate, retain the provider receipts, and promote only
   the reviewed version after all gates pass.

No production feature flag, secret, payment, publication, or external approval was
changed during this preparation. Existing Facebook/Jest source and artifacts were
not changed. Separate Facebook work appearing in the shared working tree is outside
this preparation document's scope.
