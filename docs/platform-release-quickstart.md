# Platform release quickstart

Use one read-only command before preparing any platform handoff:

```sh
pnpm preflight:all-platforms
```

It runs the security audit, builds and audits all four isolated artifacts, exercises their browser harnesses, validates the Reddit package, and prints the exact release boundary and runbook for each platform. It does not upload, publish, or promote anything.

After the preflight succeeds, run only the intended target command:

```sh
pnpm release:jest
pnpm release:facebook
pnpm release:youtube
pnpm release:reddit
```

The commands deliberately remain separate because their external effects differ. Jest uploads an automatically activating build. Facebook, YouTube, and Reddit create local, immutable handoffs for their documented manual processes. Run `pnpm release:plan` at any time to review those effects without building or changing external state.

Never add a combined release command. A single command that crosses all provider boundaries could accidentally activate Jest while only preparing local candidates for the other platforms.
