# Platform release quickstart

Run the shared build and audit preparation before a platform handoff:

```sh
pnpm preflight:all-platforms
```

It runs the security audit, builds and audits the core isolated artifacts, validates the Reddit package, and prints the exact release boundary and runbook for each platform. It does not run local tests, start a local game, upload, publish or promote anything. Complete manual acceptance through each provider's private hosted version separately.

After the preflight succeeds, run only the intended target command:

```sh
pnpm release:jest
pnpm release:youtube
pnpm release:reddit
```

The commands remain separate because their external effects differ. Jest uploads and activates the processed build. Game publication, review submission and listing visibility changes remain held. Firebase Functions deployment is allowed. YouTube and Reddit create local, immutable handoffs for their documented manual processes. Facebook's backend remains available, with no frontend release target on this branch. Run `pnpm release:plan` at any time to review those effects without building or changing external state.

The existing `release:all` command crosses different provider boundaries, including automatic Jest activation. Use target-specific commands when preparing candidates or reconciling an existing upload.

Build and release only named HTML5 platform targets. Standalone web hosting and
PWA builds are excluded. `build:web` aggregates Jest and Reddit;
`prepare:html5-handoffs` prepares a shared audited input for named distributors
such as itch.io. It does not publish a standalone game. Historical PWA dashboard
receipts remain visible with an excluded status.
