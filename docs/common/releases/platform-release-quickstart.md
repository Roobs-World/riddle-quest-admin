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

The commands deliberately remain separate because their external effects differ. Jest uploads and activates the processed build. Game publication, review submission and listing visibility changes remain held. Firebase Functions deployment is allowed. Facebook, YouTube, and Reddit create local, immutable handoffs for their documented manual processes. Run `pnpm release:plan` at any time to review those effects without building or changing external state.

The existing `release:all` command crosses different provider boundaries, including automatic Jest activation. Use target-specific commands when preparing candidates or reconciling an existing upload.

Build and release only named HTML5 platform targets. Standalone web hosting and
PWA builds are excluded. `build:web` aggregates Jest, Facebook and Reddit;
`prepare:html5-handoffs` prepares a shared audited input for named distributors
such as itch.io. It does not publish a standalone game. Historical PWA dashboard
receipts remain visible with an excluded status.
