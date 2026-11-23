# Additional release targets — round 7

Research date: 21 September 2026

## Selection standard

This pass searched messaging and social mini apps, wallet/dapp catalogs, smart-TV catalogs, education publishers, PWA directories, and regional browser portals. A recommendation requires current first-party evidence of all of the following:

- an active external-developer submission route;
- direct use of a hosted standards-based HTML5 application or its static ZIP;
- no Android, iOS, Electron, TWA, television-vendor package, or proprietary game-runtime conversion;
- no mandatory exclusivity; and
- a distinct release/discovery surface rather than a downstream placement from an existing distributor.

Only two additions meet that standard beyond the current 45 targets.

## Recommended additions

### Zoom App Marketplace

**Target name:** `Zoom App Marketplace`

**Why it qualifies:** Zoom Apps are third-party web applications displayed in a WebView inside the Zoom client. A developer configures a hosted HTTPS Home URL and domain allowlist; Zoom requests that URL and renders its HTML. Zoom supplies a JavaScript SDK rather than requiring a native application package. Public apps have an active Marketplace submission route with functional, metadata, compliance, and security review.

**Non-exclusivity evidence:** The official Marketplace Developer Agreement describes the developer's API rights and the reciprocal trademark/material licenses as non-exclusive, states that the developer retains rights in its application, and makes the developer responsible for its own customer relationships and distribution. Zoom also documents developer-controlled unpublishing and removal. Confirm the version presented during onboarding has equivalent terms before acceptance.

**Fit:** Riddle Quest can run as a single-player meeting-break or social activity in Zoom's embedded browser without changing its game engine. The Zoom adapter should handle readiness, lifecycle/context, optional Zoom identity, and safe return to the meeting. Multiplayer or meeting-media access is not required for the first release.

**Ads and IAP:** Do not include Facebook rewarded/interstitial advertising or any other target's SDK. Zoom documents Marketplace App Monetization, including platform checkout and tax/billing support, but eligibility and current commercial terms must be confirmed in the developer account. Disable purchases initially; use Zoom's documented monetization path only after server-side entitlement verification and idempotent grants are designed. No first-party in-app advertising route was found, so record ads as unsupported.

**Automation boundary:** CI can build a dedicated Zoom artifact, validate provider isolation, test required CSP/OWASP response headers, and deploy the hosted Home URL. It can also run a test harness with the Zoom Apps JS SDK mocked. Account creation, agreement acceptance, scope selection, domain validation, security evidence, Marketplace review, and first production publication remain manual. Do not automate the review UI. Production credentials belong in server-side secrets and must never enter a browser bundle or pull-request workflow.

**Dashboard TODOs:**

- Create the Zoom developer application under Roobs World Limited and select a public Zoom App surface.
- Review the current Marketplace Developer Agreement and confirm non-exclusive distribution and UK-company monetization eligibility.
- Configure the Home URL, OAuth redirect URLs, domain allowlist, least-privilege scopes, deauthorization endpoint, and required OWASP headers.
- Create an isolated Zoom adapter; keep the base game and all other target artifacts free of Zoom code.
- Publish Terms of Use, Privacy Policy, self-service documentation, support URL, data-retention/deletion behavior, and monitored support contact.
- Prepare listing copy, screenshots, test account/instructions, technical design, security evidence, and functional review evidence.
- Submit for review and record app ID, review status, production URL, released version, install metrics, monetization status, and last verification date.

**Official sources:**

- [Create a Zoom App](https://developers.zoom.us/docs/zoom-apps/create/)
- [Zoom Apps architecture](https://developers.zoom.us/docs/zoom-apps/architecture/)
- [Zoom Marketplace distribution and review](https://developers.zoom.us/docs/distribute/)
- [Zoom app monetization and growth](https://developers.zoom.us/docs/distribute/grow-your-app/)
- [Removing and unpublishing an app](https://developers.zoom.us/docs/distribute/published-apps/remove-and-unpublish/)
- [Zoom Marketplace Developer Agreement](https://explore.zoom.us/docs/doc/Zoom%20Marketplace%20Developer%20Agreement%207.10.2019__APPROVED.pdf)

### PWA Directory

**Target name:** `PWA Directory`

**Why it qualifies:** PWA Directory is an active curated catalog with more than 700 installable web applications. Its standard submission is free and requires only the application's public URL, name, category, and contact email. Review checks HTTPS, a valid web manifest, a registered service worker, installability, working core flows, honest behavior, and real product value. It links users to the official hosted PWA, so no wrapper or platform runtime is introduced.

**Non-exclusivity evidence:** Its current terms define the service as a catalog linking to each application's official site, state that names, logos, and screenshots remain the owners' property, and allow the owner to request correction or removal. It requests no exclusive distribution license. The optional paid Pro Launch changes review speed and temporary placement only; it is not required for publication.

**Ads and IAP:** PWA Directory does not host the game or provide commerce/ad SDKs. The canonical website's existing lawful monetization may remain, subject to the directory's honesty and no-dark-pattern review rules. Record platform ads and platform IAP as not applicable. Purchases remain the website's Stripe flow with existing server-side verification; no PWA Directory code belongs in the game.

**Automation boundary:** The standard web form is manual, but PWA Directory also publishes an official MCP endpoint for looking up requirements, submitting an app, and following review. Automation may submit the public metadata and poll status through that documented interface after recording the exact payload for audit. It must never purchase Pro Launch automatically; the official page says an agent may hand the developer a payment link but does not pay. Deployment continues through the existing website pipeline.

**Dashboard TODOs:**

- Audit `https://www.roobsworld.com` for an installable manifest, service worker, icons, HTTPS, offline behavior, and launch display mode.
- Confirm the game is reachable as the PWA start URL and that authentication/payment fallbacks work when installed.
- Prepare category, short description, contact email, screenshot URLs, privacy/support links, and review notes.
- Submit through the free standard review path; do not purchase Pro Launch without a separate business decision.
- Record submission ID/date, review result, requested corrections, listing URL, installation evidence, and last automated availability check.
- Add a scheduled read-only check for the listing URL and PWA installability; do not treat directory referral traffic as game-platform telemetry unless it is source-attributed.

**Official sources:**

- [Submit a PWA](https://pwa.directory/submit)
- [PWA Directory editorial criteria](https://pwa.directory/about)
- [PWA Directory terms](https://pwa.directory/terms)

## Holds and exclusions

| Candidate | Decision | Reason |
| --- | --- | --- |
| Greenhouse Games | Hold pending contract | Its first-party creator page has direct HTML5/WebGL upload, review, browser play, monthly gameplay-hour payouts, and excellent educational-puzzle fit. It also asks whether already-published games can be listed. However, the accessible page does not expose the answer or operative creator license, so mandatory non-exclusivity cannot yet be verified. It bans ads, microtransactions, trackers, and paid upgrades. Request the current creator terms before adding it. |
| EducationalGamez | Hold pending verification | Its page describes developer registration, HTML5 ZIP uploads, a mandatory score/progress API, review, and 70% premium revenue share. It does not publish non-exclusivity terms, and the developer portal/agreement could not be independently verified from the public documentation. |
| Okona | Exclude for the current game | It has an excellent direct HTML5 upload/hosting route and its terms say developers retain ownership and decide where games appear. However, the product requires a phone-controller multiplayer design and JavaScript SDK. Riddle Quest does not currently implement that gameplay model, so this would be a new product variant rather than distribution of the existing release. |
| Smart-TV Alliance | Exclude | Its shared submission portal closed in 2015 and redirects developers to individual manufacturers. It is not an active common route. |
| Samsung TV, LG webOS TV, Panasonic, VIDAA, Roku | Exclude | Current routes require vendor packages, signing, device-specific manifests, proprietary runtimes, certification, or partner arrangements. A hosted URL alone is insufficient. |
| Viber, WhatsApp, Slack, Microsoft Teams, Google Chat | Exclude | No current first-party game-discovery route accepting a normal hosted HTML5 game was found. Bot/app integrations are not equivalent to a playable game catalog and generally require platform-specific manifests and review. |
| Snapchat Minis | Exclude | No current open external-developer HTML5 mini-app submission programme was verified. |
| TikTok Mini Games | Exclude | TikTok retired HTML/H5 mini games in September 2026 and now requires conversion to its native mini-game runtime; a normal website or HTML ZIP is explicitly insufficient. |
| WeChat, Alipay, OPPO, vivo, HAGO | Exclude | No current first-party path was verified that accepts this standard hosted Vite build from a UK company without proprietary mini-game conversion or regional entity qualification. |
| VK Mini Apps / OK Games | Hold | Hosted web technology is plausible, but a current English contracting and payout route clearly available to a UK company was not verified. Legal, sanctions, data-residency, and payment review are required first. |
| DappRadar and wallet dapp directories | Exclude | They list functioning blockchain dapps, not ordinary web games. Adding blockchain/wallet behavior solely to qualify would change the product and its risk model. |
| Solana Mobile dApp Store | Exclude | Requires an Android package and mobile publishing workflow. |
| WalletConnect Explorer | Exclude | It is discovery for apps integrating WalletConnect, not a general game release destination. The current game has no legitimate wallet requirement. |
| Coinbase/Base mini apps | Do not count separately | Current mini-app distribution overlaps the existing Farcaster Mini Apps target rather than creating an independent release surface. |
| World, Pi, MiniPay | Already represented | These wallet/mini-app ecosystems are already canonical targets and must not be duplicated. |
| Web Apps Directory | Do not count separately | It is a sister catalog linked from PWA Directory under the same directory family. Count the reviewed PWA submission once rather than inflating coverage with adjacent listings. |
| Small browser listing portals | Outreach only | Sites such as SlowDen, YalGames, DeskLink, Paizix, Gamingro, IPlayArena, AxoGamer, and similar directories have open intake but insufficient demonstrated reach, durable commercial terms, or operational history for another maintained release artifact. Track them as promotion leads. |
| Game portals supplied by GameDistribution, GameFlare, GamePix, GameMonetize, Playgama, Famobi, SOFTGAMES, or other existing networks | Do not count separately | They are downstream syndication placements. The creator-facing distributor is already the release target. |

## Conclusion

Add `Zoom App Marketplace` as an isolated hosted-web integration candidate and `PWA Directory` as a PWA discovery release. Greenhouse Games is the strongest next possibility, but it must remain off the canonical target list until its current creator agreement confirms non-exclusive licensing.

Beyond these two, the credible pure-browser market is effectively exhausted under the stated rules. Future additions should require a newly opened first-party route or newly available contract evidence, rather than converting small directories or downstream syndication sites into artificial platform counts.
