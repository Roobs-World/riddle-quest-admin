# Live PvP rematches — 3 October 2026

Facebook and Reddit now expose an explicit rematch action on a human result and an available recent-history entry. The caller submits its own retained terminal ticket; the server resolves the original rival. Jest retains its established adapter and invitation paths.

## Authority and platform boundaries

- The strict join contract adds an optional opaque `rematchOfTicketId`, mutually exclusive with ordinary challenge creation or acceptance. No rival UID, name or provider profile can select the recipient. Only Facebook and Reddit can create this extension; ordinary Jest queue play and settlement continue to work.
- Creation validates both private human seats, provider/content/run bindings, committed settlement, the original seven-day source window, current account existence and deletion guards, and bilateral blocks inside the transaction. The original locale and category are immutable. Bot, foreign, future, expired, unsettled and corrupt sources fail before a new seat, invitation or grant.
- A new private lobby reserves only that original human. Public searches and bot fallback cannot take it. It uses the existing 15-minute invitation window and shared five-per-hour creator/one-per-minute recipient budgets. Concurrent tabs recover one lobby; stable retries cannot change the source or content selection, including after expiry. Rematch creation grants nothing.
- The original recipient receives an in-game inbox notice and must explicitly accept through the existing authoritative challenge flow. Preview never joins. Acceptance retains current account, block, locale, creator-presence and expiry checks. Rematch previews use the creator's current game-owned profile. Reserved rematches hide generic sharing so the invitation cannot be redirected to another friend.
- Facebook uses its authenticated lazy callable adapter and existing consent-gated notification outbox. Enqueuing is not evidence of provider delivery. Reddit uses only same-origin `/api/game/race.live.join`, `.inbox` and `.challenge` through the narrow Devvit allowlist, signed gateway, existing budgets and shared account-operation lease. Reddit gets no provider push outbox or additional browser SDK/host.
- Existing account deletion cleanup removes a creator's waiting seat and cross-user invitation or cancels a reservation addressed to a deleted recipient. It removes push linkage, preserves the surviving account balance and prevents subsequent acceptance. The real cleanup, rather than a mocked deletion response, is exercised for both roles and providers.
- Both rematch entry points retire the old view before starting a new journey and retain one retry request ID. Inbox previews are reused, preventing ten extra network reads per poll; foreign-locale notices are hidden and failed refreshes retire old rows. Existing translated copy is reused across all 16 supported locales.

## Locale defect found during verification

The rebuilt Reddit browser reproduced Arabic page copy alongside an English game initialization. A product-list guard suppressed host initialization whenever commerce was absent or its catalog stayed unchanged. The guard now tracks the locale and mode actually delivered alongside the product list; locale/mode changes synchronize independently of catalog changes, while profile-only updates keep their separate projection. The same Arabic browser assertion that failed now passes. Its diagnostic log is retained.

The Reddit fixture server also needed the correct SVG content type to render the existing coin asset. This is a harness correction; no production asset was replaced. The rematch journey now decodes the actual image before taking its screenshot.

## Verification

The executable diagnostics, logs and screenshots are in `artifacts/live-race-rematch-2026-10-03/`.

- **64 real emulator tests in four suites pass:** 18 rematch cases, six existing private-invitation regressions, 15 history cases and 25 account-deletion cases. They cover both seats/providers, concurrent requests, source-bound retries, real bot rejection, quotas, bilateral blocking, current identity and deletion. A real signed Reddit HTTP request verifies join/replay, strict public inbox/preview schemas, rejected extra selectors, the deleted-account lease and no Reddit push outbox. Cleanup is guarded by owned demo projects and loopback emulator hosts.
- Full Functions units pass **1,579 tests in 128 suites**; core passes **313 tests in 34 suites**; portal passes **2,272 tests in 267 suites**, with 118 browser tests in 15 suites skipped. Reddit trusted-server tests pass **51 cases**; its types and server build pass.
- Both injected Facebook and Reddit browser journeys pass through the actual target adapters, covering history and terminal rematches, retry identity, private sharing suppression, inbox preview without acceptance, exact explicit acceptance, locale isolation and immediate post-block retirement. Facebook owns a separate fresh `13_plus` build with injected FBInstant v8; Reddit reads the owned isolated build. Existing provider lifecycle, live race, tournament and solo feedback checks remain in those journeys.
- **Six selected Jest authenticated browser regressions pass**, covering restored-language initialization, Arabic Shop copy, subscription refresh/cancellation, background catalog loading, signed guest identity and decodable daily/race notifications. The other 68 tests in that suite were skipped by the selected pattern. This does not claim full Jest browser acceptance.
- All **six isolated builds and explicit output-directory audits pass** for Jest, Facebook, Reddit, YouTube, Netflix and Yahoo. Their existing SDK, same-origin, ads and self-contained boundaries remain enforced. Portal/Functions types, Functions lint/module-cycle checks and TSDoc pass. Compiled rematch/invitation/callable/gateway modules load under **Node 22.23.1** without invoking a handler.
- French Facebook and Arabic RTL Reddit history at 390/1,280 pixels and terminal rematch screenshots were visually inspected. Baseline schema, premature retry assertion, transient outage and host-locale diagnostic failures are retained separately from final passing logs.

## Release and MCP limits

Firefox is configured/enabled in the local MCP inventory, but this running chat exposes no Firefox callable tools or Firefox browser surface. Browser checks above ran in the repository's injected Chromium harnesses. Previous authenticated Meta reads established admin/read access to the development app; these checks perform no Meta setting changes.

This shared tree changed concurrently, and other chats committed/deployed separate work. The manifest explicitly records **unconfirmed atomic source/build provenance**, **upload ineligible**, **no deployment by this chat** and **no provider mutation by this chat**. These synthetic browser and loopback emulator checks establish local behavior, not hosted provider acceptance or deployed-source equivalence.

Remaining review gates include verified hosted roles/devices and signed forwarding, Meta purchase/refund contracts and payout readiness, rewarded-ad verification, notification consent/delivery, and production index/deployment acceptance. Native Facebook context selection still does not bind a selected friend to the global queue, and context recording remains a browser completion effect. Rematches use the prior authoritative human pair and do not resolve those separate gaps.

Later on 3 October, the [durable context-delivery follow-up](../../../facebook/evidence/facebook-live-context-delivery-2026-10-03.md) binds new Facebook seats to their original SDK context and recovers eligible scores through the worker, including both rematch winning seats. Legacy unbound seats retain browser submission. The selected-friend queue and hosted acceptance gates remain open.
