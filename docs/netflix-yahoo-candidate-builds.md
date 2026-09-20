# Netflix and Yahoo candidate builds

Riddle Quest provides isolated HTML5 artifacts for Netflix and Yahoo:

```bash
pnpm build:netflix
pnpm build:yahoo
```

The resulting upload directories are `packages/portal/dist-netflix/` and `packages/portal/dist-yahoo/`. Each build runs target-boundary, locale, TypeScript, size, portability, SDK, advertising, commerce, and content-manifest checks. The Netflix audit also prohibits network and analytics code.

The Netflix artifact is an engineering candidate rather than a submission-ready partner build. Netflix does not provide a public HTML5 game SDK or submission contract that this repository can safely install. Until partner documentation and credentials are supplied, it uses the provider-neutral standalone adapter, makes no network calls, and saves progress in browser local storage. No SDK from another target is included.

The Yahoo artifact has a target-owned web entry, Yahoo OpenID Connect registration, anonymous fallback, and Firebase-backed game data. It is deployed at `https://yahoo.roobsworld.com/`. Yahoo commerce and in-game ads are not integrated. Although a Stripe account has been configured externally, this repository contains no Stripe SDK, checkout endpoint, or webhook, so the dashboard must not report payments as implemented.

The Netflix candidate intentionally uses the incomplete engineering content fixture. A partner release must replace it with approved release content and add a target-owned adapter for any required lifecycle, save, identity, or commerce API before submission.

Preview either built artifact locally with:

```bash
pnpm --filter @qwordly/portal preview:netflix
pnpm --filter @qwordly/portal preview:yahoo
```
