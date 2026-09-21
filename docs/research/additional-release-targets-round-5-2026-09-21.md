# Additional release targets — round 5

Research date: 21 September 2026. This fifth review checked routes beyond the 40 targets already recorded in `config/platform-monetization.json`. Sources are first-party developer documentation and contracts only.

The hard filter was: active external developer intake; a standard hosted or zipped HTML5/JavaScript game remains the runtime; no native, Electron, TWA, or proprietary-runtime conversion; no mandatory exclusivity; and a distinct destination rather than another name for an existing distributor's downstream placement.

## Defensible additions

### AirConsole

**Why it qualifies.** AirConsole publishes browser games to its store for play in browsers, tablets, supported TVs, and cars, using phones as controllers. Its public Developer Console allows a developer to create a game, upload a ZIP, preview versions, and submit for review. The uploaded game remains HTML5: the ZIP has `screen.html` and `controller.html` at its root and uses AirConsole's JavaScript API. See the official [developer overview](https://developers.airconsole.com/), [quick start](https://developers.airconsole.com/quick-start), [publishing guide](https://developers.airconsole.com/publishing-your-game), and [technical requirements](https://developers.airconsole.com/technical-requirements).

**Non-exclusivity.** Sections 5.1 and 5.2 of the current [AirConsole Developer Distribution Agreement](https://www.airconsole.com/file/AirConsole-Developer-Distribution-Agreement-2023-08-14.pdf) explicitly describe the licences granted to AirConsole as non-exclusive.

**Integration.** Riddle Quest needs an isolated AirConsole adapter and a controller page. The main Vite game can remain the screen application, but input, session lifecycle, player identity/nickname, and persistent state must use the AirConsole API. Initial loading must stay below 50 MB compressed and the browser game must satisfy its lower-powered TV performance requirements. AirConsole also documents Android TV packages, but those native store outputs are outside this recommendation and must not be added.

**Monetization.** AirConsole uses its Hero subscription. Subscription revenue is shared with games based on play time; the [revenue-share page](https://developers.airconsole.com/developer-revenue-share) documents the calculation. AirConsole says it does not run third-party advertising. Its `showAd()` call displays AirConsole Hero promotion breaks rather than a third-party ad impression; pause/mute callbacks are mandatory. See [AirConsole Hero and revenue](https://developers.airconsole.com/airconsole-hero-and-revenue). No public per-game IAP API suitable for Riddle Quest was identified, so mark IAP unavailable and do not carry Stripe or another platform's commerce into this artifact.

**Automation boundary.** CI can build the two-page ZIP, validate size and file layout, run an injected AirConsole API harness, and create checksums. Game creation, first upload, agreement acceptance, review submission, and release approval use the authenticated Developer Console; no supported publishing API or CLI is documented.

**Dashboard TODOs.** Add `AirConsole` as `integration required`; create a developer account/game ID; design the phone controller; implement and isolate the SDK adapter; validate the 50 MB initial-load and TV performance constraints; upload a review version; record review and release receipts.

### World App Mini Apps

**Why it qualifies.** World Mini Apps are hosted web applications. MiniKit is framework-agnostic and can be loaded into plain HTML through an ESM CDN, so the existing Vite application can remain a web build. World provides an explicit migration route for an existing web app and a Developer Portal review path. Approved apps become discoverable to World App users. See [Getting Started](https://docs.world.org/mini-apps/quick-start/installing), [Migrate a Web App to Mini App](https://docs.world.org/mini-apps/migration/web-to-miniapp), and [Mini App Store submission](https://docs.world.org/mini-apps/quick-start/app-store). World states that World App is available in 150+ countries and operates a London flagship, supporting a practical UK route; individual payment features remain region-dependent. See the official [World FAQ](https://world.org/faqs).

**Non-exclusivity.** The public submission documentation imposes no distribution exclusivity and adapts an independently hosted web app rather than acquiring a platform-only build. The authenticated Developer Portal terms must still be checked before submission; do not accept any later clause that conflicts with multi-platform distribution.

**Integration.** Add a dedicated MiniKit adapter for readiness, wallet authentication, World ID where useful, lifecycle, and sharing. The game stays hosted on a Roobs World HTTPS domain. Keep all World SDK and wallet behavior out of the other artifacts.

**Monetization.** World documents `MiniKit.pay()` for WLD and supported local stablecoins and requires backend transaction verification before fulfillment. This is crypto payment infrastructure, not a conventional app-store IAP catalogue. Any use for digital goods needs legal, accounting, age/audience, refund, and regional-availability review before engineering. The official [Pay command](https://docs.world.org/mini-apps/commands/pay) supplies a backend verification flow. No first-party in-game advertising product was found, so ship without ads.

**Automation boundary.** CI can deploy the hosted target, validate MiniKit isolation, test browser fallback, and probe the production URL. App creation, permissions, payment allowlists, listing data, review, and release are authenticated Developer Portal steps with no documented unattended submission API.

**Dashboard TODOs.** Add `World App Mini Apps` as `commercial review required`; create the Developer Portal app; verify current UK company and payment eligibility; decide whether the release is free-only; implement MiniKit only after that decision; submit to the Mini App Store; record review status and live URL.

### Farcaster Mini Apps

**Why it qualifies.** Farcaster Mini Apps are ordinary hosted HTML/CSS/JavaScript applications. Existing projects install a JavaScript SDK or load it from an ESM CDN, call `ready()`, and publish metadata at `/.well-known/farcaster.json`. There is no conversion or central app-review upload. Farcaster offers public developer tools to sign/register the manifest, after which eligible apps appear in its directory and search. See [Getting Started](https://miniapps.farcaster.xyz/docs/getting-started), [Publishing](https://miniapps.farcaster.xyz/docs/guides/publishing), and [App Discovery and Search](https://miniapps.farcaster.xyz/docs/guides/discovery).

**Non-exclusivity.** Publishing is domain-based on a decentralized network with multiple clients, and the official process requires no exclusive distribution agreement. The existing Roobs World domain remains the app's host and identity.

**Integration.** Add a small isolated Farcaster adapter for `ready()`, signed user authentication, notifications, sharing, and wallet capability detection. Category metadata supports `games`. A stable dedicated domain or subdomain is important because the domain becomes the application identifier.

**Monetization.** Farcaster supplies Ethereum and Solana wallet actions rather than a conventional IAP catalogue. Do not treat wallet availability as ready game commerce: any digital-goods flow requires product, consumer, tax, refund, and server-authoritative entitlement design. Verified apps can be eligible for usage/on-chain developer rewards according to the publishing guide. No first-party in-game ad SDK was found, so ship without ads.

**Automation boundary.** Hosting, manifest generation, metadata validation, SDK-isolation tests, and deployments can run in CI. A Farcaster account must enable developer mode and sign/register the initial domain association. After bootstrap, ordinary releases are Vercel deployments; directory indexing remains engagement-driven rather than an API-controlled release state.

**Dashboard TODOs.** Add `Farcaster Mini Apps` as `integration required`; reserve a stable subdomain; enable developer mode; create and sign the manifest; implement the adapter; deploy and register the manifest; seed a public launch link; track directory indexing separately from deployment readiness.

## Holds and exclusions

- **Base App Mini Apps:** technically valid and active, and its official [publication guide](https://docs.base.org/base-app/miniapps/mini-apps) hosts a web app on Vercel and publishes it by posting its URL. It uses the same Farcaster manifest protocol and largely the same Mini App integration. To avoid counting a protocol-compatible client as another independent build target, implement Farcaster once and record Base App availability as a distribution/client receipt after compatibility testing. Reconsider a separate dashboard target only if Base introduces materially distinct certification or required APIs.
- **TikTok Mini Games:** excluded. Although some pages still describe HTML ZIP upload, TikTok's current [HTML-to-native migration notice](https://developers.tiktok.com/docs/en/migrate-from-html-to-native-runtime) states that HTML games stopped being accepted on 28 August 2026, were retired on 9 September 2026, and must be rebuilt for TikTok's proprietary native mini-game runtime. That directly violates the no-runtime-conversion constraint.
- **Samsung Smart TV:** excluded from this round. Samsung supports Tizen web applications, but Store delivery requires Tizen packaging/signing and hosted web apps are normally prohibited unless the developer joins a partner group. See Samsung's [Hosted Applications Q&A](https://developer.samsung.com/smarttv/develop/faq/hosted-applications.html). This is not a direct standard Vite-artifact intake route.
- **LG webOS TV, Roku, VIDAA, and Amazon Fire TV native catalogues:** their public release paths require platform packages, signing, native channels, or TV-specific application conversion. They fail the standard browser-artifact constraint.
- **Play.Works and similar TV syndicators:** no current first-party public documentation was found that simultaneously proves direct open intake, standard HTML5 delivery, and non-exclusive terms. Hold rather than infer eligibility from marketing material.
- **WeChat, Alipay, OPPO, vivo, and other proprietary mini-game runtimes:** require engine export/runtime conversion and commonly add regional entity or publisher requirements. They fail the runtime and UK-access filters.
- **GX.games, Construct Arcade, and gd.games:** official publishing routes are tied to their authoring engines or project formats rather than documented generic intake for an existing Vite archive.
- **Educational and casual editorial portals without developer programmes:** portals that only expose contact forms, licensing outreach, or distributor-fed catalogues were not added. Direct external developer intake and non-exclusive terms could not both be verified from current first-party material.

## Conclusion

Round 5 yields three defensible additions: **AirConsole**, **World App Mini Apps**, and **Farcaster Mini Apps**. AirConsole is the clearest commercial release candidate. World App and Farcaster are technically low-friction hosted-web ecosystems, but their wallet-based payment rails require a separate commercial decision and neither supplies an in-game ad product. Base should be tracked as a Farcaster-compatible client surface rather than another build target.
