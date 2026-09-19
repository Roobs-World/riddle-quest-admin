# Netflix and Yahoo candidate builds

Riddle Quest provides isolated, self-contained HTML5 candidate artifacts for Netflix and Yahoo:

```bash
pnpm build:netflix
pnpm build:yahoo
```

The resulting upload directories are `packages/portal/dist-netflix/` and `packages/portal/dist-yahoo/`. Each build runs target-boundary, locale, TypeScript, size, portability, network, SDK, analytics, advertising, commerce, and content-manifest checks.

These are engineering candidates rather than submission-ready partner builds. Netflix and Yahoo do not provide a public HTML5 game SDK or submission contract that this repository can safely install. Until partner documentation and credentials are supplied, both candidates use the provider-neutral standalone adapter, bundle all game content, make no network calls, and save progress in browser local storage. No SDK from another target is included.

The current candidates intentionally use the incomplete engineering content fixture. A partner release must replace it with approved release content and add a target-owned adapter for any required lifecycle, save, identity, or commerce API before submission.

Preview either built artifact locally with:

```bash
pnpm --filter @qwordly/portal preview:netflix
pnpm --filter @qwordly/portal preview:yahoo
```
