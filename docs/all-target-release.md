# One-shot target release

Run every release target from the repository root:

```bash
pnpm release:all
```

The command first runs `pnpm verify:all-targets`. No target release adapter starts unless that shared gate succeeds. It then runs the Jest, Facebook, YouTube, Reddit, Netflix, and Yahoo adapters in a deterministic order and stops at the first failure.

Review the complete plan without building, uploading, packaging, or publishing:

```bash
pnpm release:all --dry-run
```

Each adapter preserves the provider's current delivery boundary. Jest uploads and activates automatically. Facebook, YouTube, and Reddit produce their existing immutable portal handoffs. Netflix and Yahoo produce validated isolated artifact directories until their private partner upload tools are available. itch.io, CrazyGames, and Newgrounds receive distinct provider-neutral ZIPs and SHA-256 manifests. The configured itch.io Butler stage can publish after the initial project exists; CrazyGames and Newgrounds retain manual portal handoffs because neither publishes a supported upload API.

The `Release all platforms` GitHub Actions workflow runs on version tags and by manual dispatch. It executes `pnpm release:all`, including Jest's configured automatic activation and every current target's validated handoff, packages the audited provider-neutral and distribution-specific builds, builds the release dashboard, and retains the complete handoff as one immutable Actions artifact. It uses the existing `jest-production` environment so the established Jest release credentials and any environment protection rules remain authoritative.

After the initial itch.io project page exists, configure repository secret `ITCH_BUTLER_API_KEY` and repository variable `ITCH_GAME_TARGET` (for example `roobsworld/riddle-quest`). The same workflow then publishes the verified neutral archive through itch.io's official Butler transport. Missing itch.io configuration is reported as a tracked skip and does not misrepresent the other portal handoffs as published.

CrazyGames Basic Launch and Newgrounds can use the neutral archive, but their portals do not publish a supported unattended release API. Discord, GamePix, GameDistribution, GameMonetize, and Yandex require isolated provider adapters and application identifiers before their release stages can be enabled. Poki remains on hold and only non-exclusive distribution terms are permitted.
