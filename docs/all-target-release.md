# One-shot target release

Run every release target from the repository root:

```bash
pnpm release:all
```

The command first runs `pnpm verify:all-targets`. No target release adapter starts unless that shared gate succeeds. It then runs all configured provider and distribution adapters in a deterministic order and stops at the first failure.

Review the complete plan without building, uploading, packaging, or publishing:

```bash
pnpm release:all --dry-run
```

Each adapter preserves the provider's current delivery boundary. Jest uploads and activates automatically. Facebook, YouTube, and Reddit produce their existing immutable portal handoffs. Netflix and Yahoo produce validated isolated artifact directories until their private partner upload tools are available. Every supported HTML5 distributor receives a distinct ZIP and SHA-256 manifest. The configured itch.io Butler stage can publish after the initial project exists; the other public portals retain manual account, contract, upload, or review steps unless their release plan explicitly says otherwise.

The `Release all platforms` GitHub Actions workflow runs on version tags and by manual dispatch. It executes `pnpm release:all`, including Jest's configured automatic activation and every current target's validated handoff, packages the audited provider-neutral and distribution-specific builds, builds the release dashboard, and retains the complete handoff as one immutable Actions artifact. It uses the existing `jest-production` environment so the established Jest release credentials and any environment protection rules remain authoritative.

After the initial itch.io project page exists, configure repository secret `ITCH_BUTLER_API_KEY` and repository variable `ITCH_GAME_TARGET` (for example `roobsworld/riddle-quest`). The same workflow then publishes the verified neutral archive through itch.io's official Butler transport. Missing itch.io configuration is reported as a tracked skip and does not misrepresent the other portal handoffs as published.

CrazyGames Basic Launch and Newgrounds can use the neutral archive, but their portals do not publish a supported unattended release API. Discord, GamePix, GameDistribution, GameMonetize, and Yandex require isolated provider adapters and application identifiers before their release stages can be enabled. Poki remains on hold and only non-exclusive distribution terms are permitted.

Y8, Playgama, Amazon Appstore Web App, and JioGames HTML5 are included as reviewed handoffs. Y8 starts with an ad-free ZIP. Playgama requires contract and syndication-overlap review before an isolated Bridge adapter. Amazon requires Fire Web App compatibility testing before isolated Amazon IAP work. JioGames requires partner approval and the current set-top-box SDK before ads or IAP can be implemented. See `docs/research/additional-html5-release-targets-2026-09-21.md` for the first-party evidence and exact boundaries.

Famobi, GamePush Distribution, SOFTGAMES, and WGPlayground are also included as contract-review handoffs. Each starts with a provider-neutral ZIP. No advertising, IAP, source disclosure, or downstream syndication is enabled until a compatible non-exclusive agreement and authenticated technical contract are reviewed. See `docs/research/further-html5-release-targets-2026-09-21.md` for the current first-party evidence.

Miniplay, Kizi, and Huawei Quick Game are included as the next gated handoffs. Miniplay and Kizi receive provider-neutral browser archives for account and commercial review. Huawei receives a neutral feasibility archive only; the dedicated RPK wrapper and all Huawei services remain blocked until UK onboarding, countries, agreement terms, and service eligibility are confirmed. See `docs/research/additional-release-targets-round-3-2026-09-21.md`.

GameFlare Distribution and Shockwave are the final browser-only additions found by the current market review. GameFlare receives an ad-free neutral archive and may monetize around the game only if its contract remains compatible. Shockwave receives a neutral review archive until its official mandatory SDK and ad behavior are reviewed. See `docs/research/additional-release-targets-round-4-2026-09-21.md`.

AirConsole, World App Mini Apps, and Farcaster Mini Apps extend coverage to controller-driven and hosted mini-app ecosystems. Their neutral archives are planning inputs: AirConsole still needs a phone controller, World needs a free-versus-wallet commercial decision, and Farcaster needs a stable domain plus signed manifest. Base compatibility is recorded as a future Farcaster client receipt instead of a duplicate build target. See `docs/research/additional-release-targets-round-5-2026-09-21.md`.

Pi Apps Platform and MiniPay Mini Apps are hosted-web candidates with manual account and terms gates. Pi advertising remains disabled because repository policy reserves rewarded and interstitial formats for Facebook. Both targets start commerce-disabled; cryptocurrency payments require a separate legal and commercial decision plus server-authoritative fulfillment. See `docs/research/additional-release-targets-round-6-2026-09-21.md`.

Zoom App Marketplace and PWA Directory add an embedded collaboration surface and a curated installable-web discovery surface. Zoom stays commerce-disabled until Marketplace eligibility and entitlement verification are reviewed. PWA Directory introduces no SDK; its free submission follows an installability audit and points to the canonical hosted PWA. See `docs/research/additional-release-targets-round-7-2026-09-21.md`.

Miro Marketplace is included as a gated team-building integration candidate. Its artifact must remain ad-free, add meaningful facilitator and board-result behavior, and complete a controlled beta above Miro's published adoption thresholds before Marketplace review. See `docs/research/additional-release-targets-round-8-2026-09-21.md`.
