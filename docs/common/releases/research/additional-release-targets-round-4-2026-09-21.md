# Additional release targets — round 4 (browser-only correction)

Research date: 21 September 2026

## Correction and selection rules

An earlier draft proposed desktop stores using Electron wrappers. Those targets were invalid for this repository: its release policy prohibits native-store code and the product remains a standard React/Vite HTML5 game. Steam, Epic Games Store PC, Snap Store, and Flathub are therefore removed from consideration.

This corrected pass accepts only a platform that has a current first-party external-developer route, accepts a normal HTML5/browser build directly, requires neither a native wrapper nor exclusivity, and is distinct from the downstream placements of an existing distributor target.

Two credible routes remain. The broader market is close to exhausted under these constraints: most remaining results are small listing sites without established operations, engine-specific communities, native mini-game runtimes, or destinations already reached through a distributor.

## Recommended additions

### GameFlare Distribution

**Target name:** `GameFlare Distribution`

**Why it qualifies:** GameFlare operates an active first-party developer programme for uploading HTML5 games. Its developer page says it accepts any HTML5-based game, accepts secure server connections, requests the game files, and allows updates. It explicitly says developers retain ownership and may upload the game to any other portal, satisfying the non-exclusive requirement. GameFlare distributes across its own sites and hundreds of publisher sites, so the network should be counted once, never as one target per downstream portal.

**Submission route:** Use the `Join Us Today`/upload flow on the official developer page, or first send the playable HTTPS build for suitability review as its FAQ directs.

**Monetisation and ads:** GameFlare publishes an advertising revenue-share model: 50% developer share on publisher sites and 85% on GameFlare sites, with a €50 payout threshold and PayPal, TransferWise, or European-company wire transfer. Its SDK/sitelock is optional. Repository policy permits rewarded and interstitial ads only in the Facebook artifact, so this artifact must not contain those ad formats. Ask GameFlare to monetize around the game without bundled ad code; do not proceed if its contract requires prohibited in-game formats. Treat IAP as unsupported unless GameFlare supplies a documented commerce API and terms. Do not silently reuse Stripe inside the embedded build.

**Automation boundary:** CI may create a provider-neutral static ZIP and checksum and run browser and isolation audits. Account creation, contract acceptance, payout setup, first submission, review, and production approval are manual. Automate later uploads only if the developer portal exposes an official API or CLI; browser scripting against an undocumented form is not a durable release pipeline.

**Dashboard TODOs:**

- Create the Roobs World Limited developer account and submit the playable HTTPS build for suitability review.
- Confirm non-exclusive rights, payout/tax details, updates, and host-side ads without an in-game ad SDK.
- Record IAP as unavailable pending official commerce documentation.
- Generate a provider-neutral ZIP with no provider SDK, Firebase browser, analytics, payment, or ad leakage.
- Supply listing assets, controls, orientation, dimensions, privacy/support URLs, and age information.
- Record review, production URL, distribution status, revenue statements, and last verified build.

**Official sources:**

- [GameFlare Distribution](https://distribution.gameflare.com/)
- [GameFlare developer programme and FAQ](https://distribution.gameflare.com/developers/)

### Shockwave

**Target name:** `Shockwave`

**Why it qualifies:** Shockwave's current first-party Developer Center invites developers to upload game files, describes browser delivery, and states that its SDK has HTML5 plug-ins plus a REST API. Its FAQ explicitly accepts games already published elsewhere; exclusive content only receives optional incentives, so exclusivity is not mandatory.

**Submission route:** Register through the Developer Center, use `Submit Your Game`, upload the HTML5 files and listing material, integrate the mandatory Shockwave SDK in an isolated target, validate on its testing ground, and submit for QA.

**Monetisation and ads:** The public page promises monetisation but does not disclose revenue share, payout threshold, IAP, or ad mechanics. Mark ads and IAP as `contract/API required`. Repository policy forbids rewarded and interstitial ads outside Facebook. Before implementation, obtain written confirmation that the mandatory SDK can operate without a prohibited ad format and obtain its identity, leaderboard, challenge, telemetry, privacy, and commerce behavior. Any purchase integration must use server verification and idempotent grants.

**Automation boundary:** CI may build a separate Shockwave artifact and run provider-isolation tests once current SDK files and documentation are issued. Do not copy an SDK from an unofficial package. Registration, agreement acceptance, SDK access, initial upload, compatibility testing, QA, monetisation enrollment, and final publication remain manual unless Shockwave provides an official authenticated interface.

**Dashboard TODOs:**

- Register Roobs World Limited and request current HTML5 SDK/API documentation and commercial terms.
- Confirm non-exclusive distribution, UK-company payouts, revenue share, ads, privacy, updates, and removal rights.
- Map the mandatory SDK before coding and keep it in a new isolated adapter and artifact.
- Record ads and IAP as blocked until written documentation proves compatibility with repository policy.
- Prepare HTML5 files, listing media, controls, dimensions, privacy/support URLs, and existing-platform list.
- Complete testing and QA; record review, production URL, SDK/release versions, metrics, and verification date.

**Official source:**

- [Shockwave Developer Center](https://developers.shockwave.com/)

## Explicit exclusions and holds

| Candidate | Decision | Reason |
| --- | --- | --- |
| Steam, Epic Games Store PC, Snap Store, Flathub | Exclude | Each requires a desktop executable or native store package. An Electron/Flatpak/Snap wrapper violates the repository instructions. |
| TikTok Mini Games | Exclude | TikTok says HTML games are no longer accepted, existing HTML games were retired in September 2026, and a website/HTML ZIP cannot be uploaded. It now requires native mini-game runtime conversion. See [TikTok HTML sunset](https://developers.tiktok.com/docs/en/migrate-from-html-to-native-runtime). |
| Opera GX.games | Exclude | Publishing is tied to GameMaker/GX export rather than general upload of this React/Vite build. |
| Construct Arcade and gd.games | Exclude | Engine-specific routes; this is not a Construct or GDevelop project. |
| Google Play TWA, Apple web wrappers, other native-store packaging | Exclude | These require mobile/native packages contrary to repository policy. |
| Chrome Web Store and Firefox Add-ons | Exclude | Extension marketplaces are not appropriate HTML5 game stores. |
| WeChat, Alipay, OPPO, vivo, and similar mini-game runtimes | Exclude | Current routes require runtime conversion and/or qualifications not shown to accept this Vite artifact directly from a UK company. |
| Gamezop | Exclude | Current pages recruit sites to embed Gamezop's catalogue; no open game-developer intake was verified. |
| Agame, Keygames, and other Azerion portals | Do not count separately | GameDistribution is already the creator-facing Azerion target; these are downstream placements. |
| Minijuegos | Do not count separately | Part of the Miniplay network already represented by `Miniplay`. |
| SlowDen, YalGames, DeskLink Games, Browser Game Lab, NoAdsGames, AxoGamer, Paizix, Gamingro, IPlayArena | Hold as outreach leads | They advertise browser-game intake, but available first-party evidence does not establish enough audience, history, durable commercial terms, or automation to justify another maintained artifact. |
| Entity Games | Hold | Active browser pitch form, but its guide seeks console-quality, mid-core, social games and does not publish distribution/exclusivity terms. |
| Arkadium | Exclude | Its official programme states that an exclusivity period is required. |
| FreeOnlineGames / FOG and HAGO | Exclude | No current first-party external-developer route accepting this build was verified. |
| VK Mini Apps / OK Games | Hold | A current English contracting and payout route clearly available to a UK company was not verified. |

## Recommended order and stopping rule

1. Contact GameFlare first because it has the clearest non-exclusive HTML5 route and commercial model.
2. Contact Shockwave for current SDK and contract documentation before creating an adapter.
3. Stop adding canonical targets after these two unless a platform produces first-party evidence meeting every selection rule.

After GameFlare Distribution and Shockwave, the practical credible market is exhausted under the repository's pure-browser, multi-platform, non-exclusive constraints. Smaller link directories may improve backlinks through the outreach tracker, but counting each as a release target would overstate coverage and create maintenance without a durable integration.
