# Netflix and Yahoo candidate builds

Riddle Quest provides isolated HTML5 artifacts for Netflix and Yahoo:

```bash
pnpm build:netflix
pnpm build:yahoo
```

The resulting upload directories are `packages/portal/dist-netflix/` and `packages/portal/dist-yahoo/`. Each build runs target-boundary, locale, TypeScript, size, portability, SDK, advertising, commerce, and content-manifest checks. The Netflix audit also prohibits network and analytics code.

The Netflix artifact is an engineering candidate rather than a submission-ready partner build. Netflix does not provide a public HTML5 game SDK or submission contract that this repository can safely install. Until partner documentation and credentials are supplied, it uses the provider-neutral standalone adapter, makes no network calls, and saves progress in browser local storage. No SDK from another target is included.

The Yahoo candidate uses the provider-neutral standalone adapter, bundles the audited content pack, and saves progress locally. It makes no provider, authentication, Firebase, analytics, advertising, or purchase requests. The hosted candidate is `https://yahoo.roobsworld.com/`. The previous Yahoo identity/Stripe entry is not a shipping target: live testing exposed disabled anonymous authentication and unauthorized gameplay calls, and those dependencies conflict with the repository's self-contained candidate requirement. Existing remote account data is unchanged; the candidate uses its own local save namespace. Partner identity or commerce requires an approved contract before re-enabling a provider adapter.

The Netflix candidate bundles the same audited 17-locale, 180-riddle production content pack used by the YouTube release. A partner release still needs a target-owned adapter for any required lifecycle, save, identity, or commerce API before submission.

Preview either built artifact locally with:

```bash
pnpm --filter @qwordly/portal preview:netflix
pnpm --filter @qwordly/portal preview:yahoo
```
