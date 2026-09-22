# Platform currency verification — 22 September 2026

Scope: locally built deployment artifacts and injected provider browser harnesses.
No live purchases, provider configuration changes, or deployments were performed.

| Target | Checkout currency | Result |
| --- | --- | --- |
| Jest | SDK `price` and `currency`; currently USD | All six coin-pack buttons show USD. Product and subscription tests preserve USD across English US/UK, German, Japanese, and Arabic formatting. |
| Facebook | Meta's formatted catalog `price` | Staged adapter preserves GBP, EUR, and JPY without falling back to the USD base catalog. Commerce remains disabled by the current capability policy. |
| Reddit | Reddit Gold | Injected browser checks verify 50, 100, 150, 250, 500, and 1000 Gold prices and the Devvit checkout bridge. |
| YouTube | No paid checkout | Injected Game API browser checks confirm the self-contained solo surface excludes the shop. |
| Netflix candidate | No paid checkout | Built artifact renders without paid-shop controls, checkout currency, external requests, or browser errors. |
| Yahoo candidate | No paid checkout | Built artifact renders without paid-shop controls, checkout currency, external requests, or browser errors. |

Game coins remain gameplay units; they are separate from the currency used to buy
coin packs. Netflix and Yahoo builds enter through `standaloneMain.tsx`; the Yahoo
Stripe source is not part of the candidate artifact.

## Validation

- All six production build commands and their target isolation audits passed,
  including the strict YouTube content audit (no fixture fallback).
- 87 focused Jest purchase, purchase-hook, Facebook commerce, and Reddit bootstrap
  tests passed.
- Final verification: 44 browser tests passed across Jest (including identity and
  lifecycle), Facebook, Reddit, YouTube, Netflix, and Yahoo.
- Portal type checking and `git diff --check` passed.
- No runtime currency changes were necessary. Added regression coverage for
  locale-independent currency selection, Meta price preservation, rendered Jest
  prices, and purchase-free candidate artifacts.

The candidate checks are available through `test:standalone:playwright` and are
included in `verify:all-targets`. To reuse already built artifacts:

```bash
PORTAL_USE_EXISTING_BUILD=1 pnpm --filter @qwordly/portal test:standalone:playwright
```

Provider references checked:
[Jest payments](https://docs.jest.com/sdk/payments),
[Reddit payments](https://developers.reddit.com/docs/earn-money/payments/payments_add).
Live provider checkout and server receipt fulfillment were not exercised by these
local checks; existing server-authoritative grant and recovery behavior was unchanged.
