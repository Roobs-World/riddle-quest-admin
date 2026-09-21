# Platform release quickstart

Use one read-only command before preparing any platform handoff:

```sh
pnpm preflight:all-platforms
```

It runs the security audit, builds and audits the six core isolated artifacts, exercises their browser harnesses, validates the Reddit package, and prints the exact release boundary and runbook for each platform. It does not upload, publish, or promote anything.

After the preflight succeeds, run only the intended target command:

```sh
pnpm release:jest
pnpm release:facebook
pnpm release:youtube
pnpm release:reddit
```

The commands deliberately remain separate because their external effects differ. Jest uploads an automatically activating build. Facebook, YouTube, and Reddit create local, immutable handoffs for their documented manual processes. Run `pnpm release:plan` at any time to review those effects without building or changing external state.

The existing `release:all` command crosses different provider boundaries, including automatic Jest activation. Use target-specific commands when preparing candidates or reconciling an existing upload.

For the independently hosted web game and offline PWA, use `pnpm deploy:web` or `pnpm deploy:pwa`. Both run local and deployed browser gates. See [standalone web deployments](standalone-web-deployments.md) for destinations, exact-byte verification and the full E2E commands.
