import {spawn} from "node:child_process";
import {constants as osConstants} from "node:os";
import {fileURLToPath} from "node:url";
import path from "node:path";

const repositoryDirectory = fileURLToPath(new URL("../..", import.meta.url));

const releasePlans = Object.freeze([
  Object.freeze({
    target: "jest",
    title: "Jest",
    boundary: "remote-active-on-ready",
    publicCommand: "pnpm release:jest",
    summary: "Run the hardened production gate and upload one immutable build for automatic activation.",
    externalEffect: "Uploads to Jest and activates the exact build automatically after processing succeeds; it never submits the game for review or makes a private game public.",
    command: Object.freeze({
      executable: "pnpm",
      args: Object.freeze(["--filter", "@qwordly/portal", "release:jest:timestamped"]),
    }),
    handoff: "Wait for authoritative completion, verify the exact version is active, then run the deployed sandbox smoke.",
    runbook: "docs/jest-html5-operations.md",
  }),
  Object.freeze({
    target: "facebook",
    title: "Facebook",
    boundary: "local-immutable-handoff",
    publicCommand: "pnpm release:facebook",
    summary: "Verify the Facebook artifact and create its immutable manual-upload handoff.",
    externalEffect: "None; Meta Dashboard upload and production promotion remain manual.",
    command: Object.freeze({
      executable: "pnpm",
      args: Object.freeze(["--filter", "@qwordly/portal", "release:facebook"]),
    }),
    handoff: "Upload only the printed read-only archive to Meta as a non-production Draft.",
    runbook: "docs/facebook-instant-games-operations.md",
  }),
  Object.freeze({
    target: "youtube",
    title: "YouTube",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:youtube",
    summary: "Verify all isolated targets and create the deterministic YouTube release bundle.",
    externalEffect: "None; Developer Portal ingestion and certification remain manual.",
    command: Object.freeze({
      executable: "pnpm",
      args: Object.freeze(["--filter", "@qwordly/portal", "preflight:youtube-upload"]),
    }),
    handoff: "Upload build-youtube.zip and retain its manifest and test report for manual certification.",
    runbook: "docs/youtube-playables-operations.md",
  }),
  Object.freeze({
    target: "reddit",
    title: "Reddit",
    boundary: "local-immutable-handoff",
    publicCommand: "pnpm release:reddit",
    summary: "Validate release contracts and create the commit-bound immutable Reddit candidate handoff.",
    externalEffect: "None; Devvit ingestion and promotion remain blocked pending exact-byte proof.",
    command: Object.freeze({
      executable: "pnpm",
      args: Object.freeze(["--filter", "@qwordly/reddit-app", "release:candidate"]),
    }),
    handoff: "Remote ingestion remains blocked until an exact-byte Devvit adapter or equivalent proof is available.",
    runbook: "docs/reddit-games-operations.md",
  }),
  Object.freeze({
    target: "netflix",
    title: "Netflix",
    boundary: "local-validated-artifact",
    publicCommand: "pnpm release:netflix",
    summary: "Build and audit the isolated Netflix candidate artifact.",
    externalEffect: "None until a Netflix partner upload command is configured.",
    command: Object.freeze({executable: "pnpm", args: Object.freeze(["build:netflix"])}),
    handoff: "Use packages/portal/dist-netflix with the Netflix partner delivery tooling.",
    runbook: "docs/netflix-yahoo-candidate-builds.md",
  }),
  Object.freeze({
    target: "yahoo",
    title: "Yahoo",
    boundary: "local-validated-artifact",
    publicCommand: "pnpm release:yahoo",
    summary: "Build and audit the isolated Yahoo candidate artifact.",
    externalEffect: "None until a Yahoo partner upload command is configured.",
    command: Object.freeze({executable: "pnpm", args: Object.freeze(["build:yahoo"])}),
    handoff: "Use packages/portal/dist-yahoo with the Yahoo partner delivery tooling.",
    runbook: "docs/netflix-yahoo-candidate-builds.md",
  }),
  Object.freeze({
    target: "gamesnacks",
    title: "Google GameSnacks",
    boundary: "local-immutable-handoff",
    publicCommand: "pnpm release:gamesnacks",
    summary: "Build and package the isolated GameSnacks SDK target with its required game.json metadata.",
    externalEffect: "None; licensing and authenticated Developer Console upload remain manual.",
    command: Object.freeze({executable: "pnpm", args: Object.freeze(["build:gamesnacks"])}),
    handoff: "Complete the GameSnacks licensing agreement, then upload build-gamesnacks.zip in the Developer Console.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "itch",
    title: "itch.io",
    boundary: "local-immutable-handoff",
    publicCommand: "pnpm release:itch",
    summary: "Build the provider-neutral HTML5 game and create an itch.io-specific immutable handoff.",
    externalEffect: "None locally; the configured GitHub Actions Butler stage publishes this artifact after verification.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "itch"])}),
    handoff: "Create the initial itch.io project once, then configure Butler for automatic updates.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "crazygames",
    title: "CrazyGames Basic Launch",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:crazygames",
    summary: "Create the SDK-free, ad-free HTML5 archive accepted for a CrazyGames Basic Launch.",
    externalEffect: "None; CrazyGames Developer Portal upload and QA review remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "crazygames"])}),
    handoff: "Upload build-crazygames-basic.zip in the Developer Portal and retain its manifest digest.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "newgrounds",
    title: "Newgrounds",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:newgrounds",
    summary: "Create a provider-neutral HTML5 archive for an authenticated Newgrounds game project.",
    externalEffect: "None; Newgrounds project creation, terms review, upload, and publication remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "newgrounds"])}),
    handoff: "Use build-newgrounds.zip only after the authenticated project requirements are reviewed.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "gamejolt",
    title: "Game Jolt",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:gamejolt",
    summary: "Create a provider-neutral browser-game archive for a Game Jolt release package.",
    externalEffect: "None; game creation, package upload and publication remain authenticated dashboard steps.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "gamejolt"])}),
    handoff: "Create the Game Jolt game and browser package, then upload build-gamejolt.zip and publish its release.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "coolmath",
    title: "Coolmath Games pitch",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:coolmath",
    summary: "Create a neutral HTML5 archive for the non-exclusive Coolmath Games licensing pitch.",
    externalEffect: "None; licensing acceptance is required before any Coolmath SDK work or publication.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "coolmath"])}),
    handoff: "Submit the playable URL and retain build-coolmath-pitch.zip for requested review.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "armor",
    title: "Armor Games pitch",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:armor",
    summary: "Create a neutral HTML5 archive for a non-exclusive Armor Games licensing pitch.",
    externalEffect: "None; outreach, contract review and publication remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "armor"])}),
    handoff: "Send the playable URL and retain build-armor-pitch.zip if Armor requests the archive.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "gamepix",
    title: "GamePix review",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:gamepix",
    summary: "Create the SDK-free HTML5 archive permitted by the GamePix submission guidelines.",
    externalEffect: "None; account setup, upload, syndication choice and provider review remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "gamepix"])}),
    handoff: "Upload build-gamepix-review.zip without enabling syndication until the current terms are accepted.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "addictinggames",
    title: "Addicting Games review",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:addictinggames",
    summary: "Create a neutral HTML5 review archive for Addicting Games.",
    externalEffect: "None; the provider submission form and licensing review remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "addictinggames"])}),
    handoff: "Submit the hosted game URL and retain build-addictinggames-review.zip if the reviewer requests files.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "htmlgames",
    title: "HTMLGames.com pitch",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:htmlgames",
    summary: "Create a neutral HTML5 archive for the HTMLGames.com developer contact process.",
    externalEffect: "None; commercial review, file transfer and publication remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "htmlgames"])}),
    handoff: "Use the official developer form and retain build-htmlgames-pitch.zip for requested delivery.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "playkovo",
    title: "PlayKovo review",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:playkovo",
    summary: "Create a neutral HTML5 archive for PlayKovo manual review.",
    externalEffect: "None; submission review and publication remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "playkovo"])}),
    handoff: "Submit the hosted build or build-playkovo-review.zip through the provider review channel.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "kongregate",
    title: "Kongregate",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:kongregate",
    summary: "Create a provider-neutral HTML5 archive for Kongregate developer review.",
    externalEffect: "None; developer approval, agreement acceptance, upload and publication remain authenticated portal steps.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "kongregate"])}),
    handoff: "Apply for developer status, review the upload agreement, then upload build-kongregate.zip for review.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "lagged",
    title: "Lagged review",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:lagged",
    summary: "Create a neutral HTML5 archive for the Lagged developer application and integration review.",
    externalEffect: "None; developer approval and account-issued SDK configuration are required before monetized publication.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "lagged"])}),
    handoff: "Apply with the production playable URL and retain build-lagged-review.zip for provider review.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "gamedistribution",
    title: "GameDistribution review",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:gamedistribution",
    summary: "Create a neutral HTML5 archive for GameDistribution contracting and SDK review.",
    externalEffect: "None; contracting, assigned game ID, SDK integration, upload and activation remain authenticated provider steps.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "gamedistribution"])}),
    handoff: "Apply with the production playable URL and retain build-gamedistribution-review.zip for technical review.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "gamemonetize",
    title: "GameMonetize review",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:gamemonetize",
    summary: "Create a neutral HTML5 archive for GameMonetize account and SDK review.",
    externalEffect: "None; game creation, GameId issuance, SDK integration, upload and activation remain authenticated provider steps.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "gamemonetize"])}),
    handoff: "Create the provider game record, obtain its GameId, then integrate and validate the SDK before activation.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "yandex",
    title: "Yandex Games review",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:yandex",
    summary: "Create a neutral HTML5 archive for Yandex Games contract and integration review.",
    externalEffect: "None; developer registration, contract, mandatory SDK integration, Console upload and moderation remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "yandex"])}),
    handoff: "Confirm contracting eligibility and obtain Console access before building the isolated mandatory SDK adapter.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "telegram",
    title: "Telegram HTML5 Games review",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:telegram",
    summary: "Create a neutral hosted-game archive for Telegram bot and Mini App integration.",
    externalEffect: "None; BotFather setup, signed identity, Stars fulfillment and launch configuration remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "telegram"])}),
    handoff: "Create the bot and game in BotFather, then use build-telegram-review.zip as the isolated integration baseline.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "microsoft-pwa",
    title: "Microsoft Store PWA review",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:microsoft-pwa",
    summary: "Build an installable PWA archive for PWABuilder and Partner Center review.",
    externalEffect: "None; Partner Center enrollment, product reservation, identity-bound package generation and certification remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-microsoft-pwa.mjs"])}),
    handoff: "Reserve the product name, copy its identity values into PWABuilder and generate the signed Store package from build-microsoft-pwa.zip.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "y8",
    title: "Y8 review",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:y8",
    summary: "Create an ad-free provider-neutral HTML5 archive for Y8 review.",
    externalEffect: "None; account setup, studio review, upload, SDK approval and publication remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "y8"])}),
    handoff: "Submit build-y8-review.zip without external monetization, then add an isolated Y8 SDK adapter only after approval.",
    runbook: "docs/research/additional-html5-release-targets-2026-09-21.md",
  }),
  Object.freeze({
    target: "playgama",
    title: "Playgama review",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:playgama",
    summary: "Create a neutral HTML5 archive for Playgama contract and Bridge integration review.",
    externalEffect: "None; registration, contract acceptance, Bridge integration, distribution choices and moderation remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "playgama"])}),
    handoff: "Review partner syndication overlap before implementing the isolated Playgama Bridge adapter.",
    runbook: "docs/research/additional-html5-release-targets-2026-09-21.md",
  }),
  Object.freeze({
    target: "amazon",
    title: "Amazon Appstore Web App review",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:amazon",
    summary: "Create a self-contained HTML5 archive for Fire Web App compatibility review.",
    externalEffect: "None; enrollment, device testing, product setup, listing and certification remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "amazon"])}),
    handoff: "Test build-amazon-webapp-review.zip with Fire Web App Tester before adding isolated Amazon IAP.",
    runbook: "docs/research/additional-html5-release-targets-2026-09-21.md",
  }),
  Object.freeze({
    target: "jiogames",
    title: "JioGames HTML5 review",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:jiogames",
    summary: "Create a neutral HTML5 archive for JioGames set-top-box review.",
    externalEffect: "None; partner approval, SDK access, integration, QA and publication remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "jiogames"])}),
    handoff: "Apply for partner access and obtain the current SDK and UK commercial terms before integration.",
    runbook: "docs/research/additional-html5-release-targets-2026-09-21.md",
  }),
  Object.freeze({
    target: "famobi", title: "Famobi pitch", boundary: "local-manual-handoff", publicCommand: "pnpm release:famobi",
    summary: "Create a neutral HTML5 archive for Famobi contract and studio review.",
    externalEffect: "None; contract screening, studio approval, source handling, SDK integration, QA and publication remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "famobi"])}),
    handoff: "Pitch the hosted demo and retain build-famobi-pitch.zip until compatible non-exclusive terms are offered.",
    runbook: "docs/research/further-html5-release-targets-2026-09-21.md",
  }),
  Object.freeze({
    target: "gamepush", title: "GamePush Distribution review", boundary: "local-manual-handoff", publicCommand: "pnpm release:gamepush",
    summary: "Create a neutral HTML5 archive for GamePush contract and destination review.",
    externalEffect: "None; contracting, destination selection, SDK integration, moderation and syndication remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "gamepush"])}),
    handoff: "Request the exact destination and opt-out list before implementing the isolated GamePush SDK adapter.",
    runbook: "docs/research/further-html5-release-targets-2026-09-21.md",
  }),
  Object.freeze({
    target: "softgames", title: "SOFTGAMES pitch", boundary: "local-manual-handoff", publicCommand: "pnpm release:softgames",
    summary: "Create a neutral HTML5 archive for a non-exclusive SOFTGAMES publishing enquiry.",
    externalEffect: "None; outreach, contract review, SDK integration and publication remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "softgames"])}),
    handoff: "Request a written non-exclusive revenue-share offer before providing source or integrating an SDK.",
    runbook: "docs/research/further-html5-release-targets-2026-09-21.md",
  }),
  Object.freeze({
    target: "wgplayground", title: "WGPlayground review", boundary: "local-manual-handoff", publicCommand: "pnpm release:wgplayground",
    summary: "Create a neutral HTML5 archive for WGPlayground agreement and SDK review.",
    externalEffect: "None; agreement review, account setup, SDK integration, upload and publication remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "wgplayground"])}),
    handoff: "Review renewal, sublicensing, termination and fee clauses before integrating the isolated SDK.",
    runbook: "docs/research/further-html5-release-targets-2026-09-21.md",
  }),
  Object.freeze({
    target: "miniplay", title: "Miniplay review", boundary: "local-manual-handoff", publicCommand: "pnpm release:miniplay",
    summary: "Create a neutral HTML5 archive for Miniplay account and API review.",
    externalEffect: "None; account setup, support request, API integration, testing and production launch remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "miniplay"])}),
    handoff: "Request credentials and written non-exclusive terms before implementing an isolated Miniplay adapter.",
    runbook: "docs/research/additional-release-targets-round-3-2026-09-21.md",
  }),
  Object.freeze({
    target: "kizi", title: "Kizi pitch", boundary: "local-manual-handoff", publicCommand: "pnpm release:kizi",
    summary: "Create a neutral HTML5 archive for Kizi developer and commercial review.",
    externalEffect: "None; outreach, commercial review, SDK integration and publication remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "kizi"])}),
    handoff: "Send the playable build and accept only a compatible non-exclusive publishing offer.",
    runbook: "docs/research/additional-release-targets-round-3-2026-09-21.md",
  }),
  Object.freeze({
    target: "huawei", title: "Huawei Quick Game review", boundary: "local-manual-handoff", publicCommand: "pnpm release:huawei",
    summary: "Create a neutral HTML5 archive for Huawei Quick Game onboarding and RPK feasibility review.",
    externalEffect: "None; UK onboarding, service approvals, RPK integration and AppGallery review remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "huawei"])}),
    handoff: "Confirm UK eligibility and non-exclusive terms before building the isolated RPK wrapper or enabling services.",
    runbook: "docs/research/additional-release-targets-round-3-2026-09-21.md",
  }),
  Object.freeze({
    target: "gameflare", title: "GameFlare Distribution review", boundary: "local-manual-handoff", publicCommand: "pnpm release:gameflare",
    summary: "Create an ad-free neutral HTML5 archive for GameFlare suitability and contract review.",
    externalEffect: "None; account creation, contract acceptance, payout setup, upload and production approval remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "gameflare"])}),
    handoff: "Confirm host-side advertising without bundled ad code and non-exclusive terms before submission.",
    runbook: "docs/research/additional-release-targets-round-4-2026-09-21.md",
  }),
  Object.freeze({
    target: "shockwave", title: "Shockwave review", boundary: "local-manual-handoff", publicCommand: "pnpm release:shockwave",
    summary: "Create a neutral HTML5 archive for Shockwave SDK, contract and compatibility review.",
    externalEffect: "None; registration, SDK access, integration, testing, QA and publication remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "shockwave"])}),
    handoff: "Obtain official SDK documentation and confirm its ad behavior is compatible before isolated integration.",
    runbook: "docs/research/additional-release-targets-round-4-2026-09-21.md",
  }),
  Object.freeze({
    target: "airconsole", title: "AirConsole review", boundary: "local-manual-handoff", publicCommand: "pnpm release:airconsole",
    summary: "Create a neutral HTML5 archive for AirConsole controller, SDK and performance planning.",
    externalEffect: "None; game creation, controller implementation, upload, review and release remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "airconsole"])}),
    handoff: "Create the game ID and design the phone controller before building the isolated two-page artifact.",
    runbook: "docs/research/additional-release-targets-round-5-2026-09-21.md",
  }),
  Object.freeze({
    target: "world", title: "World App Mini Apps review", boundary: "local-manual-handoff", publicCommand: "pnpm release:world",
    summary: "Create a neutral hosted-web archive for World App eligibility and commercial review.",
    externalEffect: "None; portal setup, payment decision, MiniKit integration, review and release remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "world"])}),
    handoff: "Verify UK eligibility and choose free-only or legally reviewed wallet payments before MiniKit integration.",
    runbook: "docs/research/additional-release-targets-round-5-2026-09-21.md",
  }),
  Object.freeze({
    target: "farcaster", title: "Farcaster Mini Apps review", boundary: "local-manual-handoff", publicCommand: "pnpm release:farcaster",
    summary: "Create a neutral hosted-web archive for Farcaster manifest and SDK planning.",
    externalEffect: "None; domain reservation, manifest signing, SDK integration and launch publication remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "farcaster"])}),
    handoff: "Reserve a stable domain and sign the initial association before publishing the isolated Mini App.",
    runbook: "docs/research/additional-release-targets-round-5-2026-09-21.md",
  }),
  Object.freeze({
    target: "pi", title: "Pi Apps Platform review", boundary: "local-manual-handoff", publicCommand: "pnpm release:pi",
    summary: "Create a neutral hosted-web archive for Pi account, terms and SDK review.",
    externalEffect: "None; KYC, app creation, terms acceptance, integration and ecosystem listing remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "pi"])}),
    handoff: "Review authenticated terms and verify a dedicated domain before isolated SDK or payment work.",
    runbook: "docs/research/additional-release-targets-round-6-2026-09-21.md",
  }),
  Object.freeze({
    target: "minipay", title: "MiniPay Mini Apps review", boundary: "local-manual-handoff", publicCommand: "pnpm release:minipay",
    summary: "Create a neutral hosted-web archive for MiniPay listing and commerce review.",
    externalEffect: "None; terms review, commerce decision, listing form and approval remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "minipay"])}),
    handoff: "Confirm UK organization eligibility and start free-only unless wallet commerce is separately approved.",
    runbook: "docs/research/additional-release-targets-round-6-2026-09-21.md",
  }),
  Object.freeze({
    target: "zoom", title: "Zoom App Marketplace review", boundary: "local-manual-handoff", publicCommand: "pnpm release:zoom",
    summary: "Create a neutral hosted-web archive for Zoom App SDK, security and Marketplace review.",
    externalEffect: "None; app creation, agreement acceptance, SDK integration, review and publication remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "zoom"])}),
    handoff: "Confirm non-exclusive terms and UK monetization eligibility before isolated Zoom integration.",
    runbook: "docs/research/additional-release-targets-round-7-2026-09-21.md",
  }),
  Object.freeze({
    target: "pwa-directory", title: "PWA Directory review", boundary: "local-manual-handoff", publicCommand: "pnpm release:pwa-directory",
    summary: "Create a neutral web archive for PWA installability and free directory review.",
    externalEffect: "None; installability audit, metadata submission, review and listing approval remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "pwa-directory"])}),
    handoff: "Use the free review path after validating manifest, service worker, icons and installed launch behavior.",
    runbook: "docs/research/additional-release-targets-round-7-2026-09-21.md",
  }),
  Object.freeze({
    target: "miro", title: "Miro Marketplace review", boundary: "local-manual-handoff", publicCommand: "pnpm release:miro",
    summary: "Create an ad-free neutral hosted-web archive for Miro team-building integration planning.",
    externalEffect: "None; app creation, collaboration design, SDK integration, beta adoption and review remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "miro"])}),
    handoff: "Design a real facilitator and board-result flow before recruiting the beta organizations required for review.",
    runbook: "docs/research/additional-release-targets-round-8-2026-09-21.md",
  }),
  Object.freeze({
    target: "greenhouse", title: "Greenhouse Games review", boundary: "local-manual-handoff", publicCommand: "pnpm release:greenhouse",
    summary: "Create a neutral archive for Greenhouse educational-fit and CSP/offline planning.",
    externalEffect: "None; educational positioning, artifact adaptation, onboarding, upload and review remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "greenhouse"])}),
    handoff: "Define the learning objective and remove ads, IAP, analytics and off-origin dependencies before submission.",
    runbook: "docs/research/additional-release-targets-round-9-2026-09-21.md",
  }),
  Object.freeze({
    target: "ozogames", title: "OzoGames review", boundary: "local-manual-handoff", publicCommand: "pnpm release:ozogames",
    summary: "Create an ad-free neutral HTML5 archive for OzoGames editorial and contract review.",
    externalEffect: "None; email submission, agreement review, monetization decision and publication remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "ozogames"])}),
    handoff: "Send the demo and request written advertising, revenue-share and commerce terms before integration.",
    runbook: "docs/research/additional-release-targets-round-9-2026-09-21.md",
  }),
  Object.freeze({
    target: "slowden", title: "SlowDen review", boundary: "local-manual-handoff", publicCommand: "pnpm release:slowden",
    summary: "Create a neutral archive and metadata handoff for SlowDen hosted-link review.",
    externalEffect: "None; form submission, editorial review and public listing approval remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "slowden"])}),
    handoff: "Submit the canonical neutral URL and record the listing only after it becomes public.",
    runbook: "docs/research/additional-release-targets-round-9-2026-09-21.md",
  }),
  Object.freeze({
    target: "noadsgames", title: "NoAdsGames review", boundary: "local-manual-handoff", publicCommand: "pnpm release:noadsgames",
    summary: "Create an ad-free HTML5 archive for NoAdsGames API submission and human review.",
    externalEffect: "None; authenticated API submission and mandatory human review remain external steps.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "noadsgames"])}),
    handoff: "Submit the hosted HTTPS URL or ZIP only after confirming the artifact contains no advertising code.",
    runbook: "docs/research/additional-release-targets-round-10-2026-09-21.md",
  }),
]);

const plansByTarget = new Map(releasePlans.map((plan) => [plan.target, plan]));

function clonePlan(plan) {
  const {command: _command, ...publicPlan} = plan;
  return {
    ...publicPlan,
  };
}

/** Lists the supported platform release plans without exposing mutable internal state. */
export function listPlatformReleasePlans() {
  return releasePlans.map(clonePlan);
}

/** Gets one validated platform release plan. */
export function getPlatformReleasePlan(target) {
  const plan = plansByTarget.get(target);
  if (!plan) {
    throw new Error(`Unknown release target ${JSON.stringify(target)}; run pnpm release:plan for supported targets`);
  }
  return clonePlan(plan);
}

/** Formats a platform release plan for an operator before any command runs. */
export function formatPlatformReleasePlan(plan) {
  return [
    `Release target: ${plan.title}`,
    `Boundary: ${plan.boundary}`,
    `Action: ${plan.summary}`,
    `External effect: ${plan.externalEffect}`,
    `Command: ${plan.publicCommand}`,
    `Handoff: ${plan.handoff}`,
    `Runbook: ${plan.runbook}`,
  ].join("\n");
}

/** Runs a child release command and rejects on every non-successful outcome. */
export function runReleaseCommand({
  executable,
  args,
  cwd = repositoryDirectory,
  environment = process.env,
}) {
  return new Promise((resolve, reject) => {
    const detached = process.platform !== "win32";
    const child = spawn(executable, args, {
      cwd,
      detached,
      env: environment,
      stdio: "inherit",
    });
    let terminationTimer;
    let forwardedSignal;
    let settled = false;
    const terminateChild = (signal) => {
      try {
        if (detached && child.pid) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch (error) {
        if (error?.code !== "ESRCH") throw error;
      }
    };
    const signalHandlers = new Map(["SIGINT", "SIGTERM"].map((signal) => [signal, () => {
      if (forwardedSignal) {
        terminateChild("SIGKILL");
        return;
      }
      forwardedSignal = signal;
      terminateChild(signal);
      terminationTimer = setTimeout(() => terminateChild("SIGKILL"), 10_000);
    }]));
    const cleanup = () => {
      if (terminationTimer) clearTimeout(terminationTimer);
      for (const [signal, handler] of signalHandlers) process.removeListener(signal, handler);
    };
    const finish = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    for (const [signal, handler] of signalHandlers) process.on(signal, handler);
    child.once("error", finish);
    child.once("close", (code, signal) => {
      if (code === 0 && signal === null && !forwardedSignal) {
        finish();
        return;
      }
      const terminalSignal = forwardedSignal ?? signal;
      const error = new Error(
        `Release child failed (exit ${code ?? "none"}, signal ${terminalSignal ?? "none"})`,
      );
      if (terminalSignal && osConstants.signals[terminalSignal]) {
        error.exitCode = 128 + osConstants.signals[terminalSignal];
      }
      finish(error);
    });
  });
}

/** Executes one canonical platform release while preserving its target-specific boundary. */
export async function runPlatformRelease(
  target,
  {
    dryRun = false,
    commandRunner = runReleaseCommand,
    environment = process.env,
    log = console.log,
  } = {},
) {
  const definition = plansByTarget.get(target);
  if (!definition) getPlatformReleasePlan(target);
  const plan = clonePlan(definition);
  log(formatPlatformReleasePlan(plan));
  if (dryRun) {
    log("Dry run: no build, upload, package, or publish action was performed.");
    return {target, status: "planned", boundary: plan.boundary};
  }
  if (
    target === "jest" &&
    (environment.JEST_UPLOAD_IS_ACTIVE !== undefined || environment.JEST_CONFIRM_ACTIVATION !== undefined)
  ) {
    throw new Error(
      "release:jest has a fixed automatic-activation contract; remove JEST_UPLOAD_IS_ACTIVE and " +
      "JEST_CONFIRM_ACTIVATION instead of overriding the committed release policy",
    );
  }
  await commandRunner({...definition.command, cwd: repositoryDirectory, environment});
  log(`Release handoff ready for ${plan.title}. ${plan.handoff}`);
  return {target, status: "handoff-ready", boundary: plan.boundary};
}

/** Verifies once, then executes every target-specific release adapter in a deterministic order. */
export async function runAllPlatformReleases({
  dryRun = false,
  commandRunner = runReleaseCommand,
  environment = process.env,
  log = console.log,
} = {}) {
  if (dryRun) {
    log("All-target release plan (no build, upload, package, or publish action will be performed).\n");
    for (const plan of releasePlans) log(`${formatPlatformReleasePlan(clonePlan(plan))}\n`);
    return releasePlans.map(({target, boundary}) => ({target, status: "planned", boundary}));
  }
  log("Running the shared target verification gate before any release adapter.");
  await commandRunner({executable: "pnpm", args: ["verify:all-targets"], cwd: repositoryDirectory, environment});
  const results = [];
  for (const {target} of releasePlans) {
    results.push(await runPlatformRelease(target, {commandRunner, environment, log}));
  }
  return results;
}
