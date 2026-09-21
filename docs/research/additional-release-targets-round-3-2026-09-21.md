# Additional release targets — round 3

Research date: 21 September 2026

## Selection rules

A target is recommended only when its own current documentation provides an active developer application or submission route, supports an HTML5/browser game or a documented conversion of an HTML5 game, and does not state that exclusivity or a native Android/iOS build is mandatory. A portal reached through an existing distributor is not counted as another target.

Public pages do not replace the contract presented during onboarding. Confirm that each final agreement remains non-exclusive before accepting it.

## Recommended additions

### Miniplay / Minijuegos

**Recommendation:** Add one target named `Miniplay` (Minijuegos is part of the same network, not a separate target).

**Why it qualifies:** Miniplay's official developer documentation says games need to run in a browser, supports hosted or self-hosted games in sandboxed iframes, and contains a current publishing checklist. The checklist directs a developer to register, send a support request containing development and production URLs, integrate the API, test in a private development environment, and request production launch. The form explicitly asks whether the game will also be available outside Miniplay, which supports the intended multi-platform release model.

**Integration boundary:** Start with a provider-neutral hosted URL or static bundle. Add Miniplay identity, statistics, achievements, save data, and purchases only in an isolated Miniplay adapter after credentials are issued. Keep its keys and tokens out of every other artifact. Purchase fulfilment must continue through the server-authoritative, idempotent grant path.

**Manual gate:** Create a corporate Miniplay account and send the browser/iframe game registration request. Ask for the current commercial terms and written confirmation of non-exclusive distribution before accepting them.

**Official sources:**

- [Miniplay API overview and publishing checklist](https://ssl.miniplay.com/dev/docs/overview)
- [Miniplay HTML5 JavaScript API](https://ssl.miniplay.com/dev/docs/c2s-js-api)

### Kizi

**Recommendation:** Add `Kizi` as a direct publisher application target.

**Why it qualifies:** Kizi's official developer page invites indie developers and studios to contact it to publish games, explicitly lists HTML5 support, and describes license-fee and in-game-purchase revenue-share models. Its separate reference to funding and sponsorship for “Kizi-exclusive content” presents exclusivity as a special commercial option rather than a publishing prerequisite.

**Integration boundary:** Submit the existing provider-neutral HTML5 handoff first. Treat identity, IAP, advertising, and any Kizi API as unavailable until Kizi supplies current technical and commercial documentation. Do not infer an ad SDK from the public page.

**Manual gate:** Contact Kizi through its developer page, provide the playable build and media kit, and obtain written platform requirements, monetisation terms, and non-exclusive rights before implementing an adapter.

**Official source:**

- [Kizi developer publishing page](https://kizi.com/developers)

### Huawei Quick Game (HTML5)

**Recommendation:** Add `Huawei Quick Game` as an isolated candidate target.

**Why it qualifies:** Huawei's official developer site documents an HTML5 Quick Game path, states that its IDE can package HTML5 games, and provides a release process through AppGallery Connect: create a quick game, apply for services, develop using the HTML5 guide, upload the RPK, and submit it for review. Huawei also documents account APIs for quick games released outside mainland China and publishes a European developer contact, so the route is not limited to a mainland-China entity. It requires an RPK wrapper but not an Android or iOS application.

**Integration boundary:** Build a dedicated RPK wrapper around the isolated web artifact. Keep Huawei account, IAP, analytics, and advertising code confined to this target. The official FAQ says the simple “Generate RPK based on HTML5 URL” flow is for releases outside mainland China when Account Kit and IAP are not required; enabling IAP therefore needs the full documented service integration and server-authoritative fulfilment.

**Manual gate:** Register Roobs World Limited as a Huawei developer, verify that UK business onboarding and the intended release countries are accepted, review the current developer agreement for non-exclusivity, create the Quick Game in AppGallery Connect, and obtain the required service approvals before implementation.

**Official sources:**

- [Huawei Quick Game overview](https://developer.huawei.com/consumer/en/quickGame/)
- [Huawei HTML5 Quick Game account API](https://developer.huawei.com/consumer/en/doc/quickApp-References/quickgame-h5-api-account-0000001513850029)
- [Huawei Quick Game HTML5 FAQ](https://developer.huawei.com/consumer/es/doc/quickApp-Guides/quickgame-faq-others-0000002453354833)

## Consider later, but do not add yet

### Entity Games

Entity has an active first-party submission form that accepts an existing browser-game port and a browser lead platform. Its submission guide, however, targets console-quality, mid-core, deeply replayable games with social features and requests a concept document and development budget. Riddle Quest is unlikely to fit that positioning without a substantial product pitch. The public material also does not disclose licensing or exclusivity terms. Reassess if the game gains a deeper social/multiplayer layer.

Official sources: [submission form](https://entitygames.com/game-developers/submit-your-game/) and [submission guide](https://entity.gg/game-developers/submission-guide/).

## Exclusions

| Candidate | Decision | Reason |
| --- | --- | --- |
| Gamezop | Exclude | Its current first-party business pages solicit websites and apps that want to embed Gamezop's existing catalogue. They do not expose an external game-developer submission route. |
| Agame and other Azerion portals | Exclude as separate targets | Azerion identifies GameDistribution as its creator distribution and monetisation network across owned and third-party portals. GameDistribution is already a target, so adding individual Azerion destinations would double-count downstream syndication. |
| FreeOnlineGames / FOG | Exclude | No current first-party external-developer intake or maintained HTML5 submission documentation was found. |
| HAGO | Exclude | No current first-party public developer submission route for an independently hosted HTML5 game was found. |
| WeChat Mini Games | Exclude for this round | No current English first-party route was verified that clearly permits a UK company to onboard and publish this existing browser build without a mainland-China-specific operational path. Reconsider only after Tencent confirms entity eligibility and supplies applicable terms. |
| Alipay Mini Programs / Mini Games | Exclude for this round | Alipay Global documents payment products for overseas merchants, but no first-party global game-submission route for this browser game was verified. A payment integration is not a game distribution target. |
| Entity Games | Hold | Active browser pitch route, but weak product fit and undisclosed licensing terms. |
| Arkadium | Exclude | Its official developer page states that a required exclusivity period is part of the programme, conflicting with the multi-platform strategy. |
| SlowDen, YalGames, Browser Game Lab, DeskLink Games, NoAdsGames, AxoGamer | Exclude for now | Each exposes a submission page, but none currently has enough established reach or independently verifiable publisher history to justify another maintained artifact ahead of the three recommendations above. These can remain outreach/listing candidates rather than release-platform integrations. |

## Suggested implementation order

1. Add Miniplay as a provider-neutral candidate and complete its account/support-request gate.
2. Add Kizi as a provider-neutral publisher handoff and send the direct application.
3. Add Huawei Quick Game as gated research work; do not build the RPK or add Huawei SDKs until UK business onboarding and services are approved.

This round adds three distinct routes. Miniplay and Kizi are browser publishers; Huawei Quick Game is a separately packaged HTML5 ecosystem. None is a downstream destination of an existing distributor target.
