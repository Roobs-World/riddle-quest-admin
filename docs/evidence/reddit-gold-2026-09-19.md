# Reddit Gold integration verification — 2026-09-19

The existing Reddit target integrates Devvit Gold checkout with the game's
server-authoritative coin balance. No production currency configuration was
changed and no real Gold was spent in this run.

| Reddit Gold | Game coins |
| --- | --- |
| 50 | 250 |
| 100 | 550 |
| 150 | 900 |
| 250 | 1,600 |
| 500 | 3,400 |
| 1,000 | 7,000 |

The shared Reddit catalog matches `packages/reddit-app/products.json`. The shop
uses the Reddit-only adapter to call `purchase(sku, metadata)` from the installed
Devvit payments SDK. Fulfillment and refund routes forward signed assertions to
the Firebase authority. Receipt identity includes provider and environment;
duplicate fulfillment does not award coins twice. Refunds remove available coins
and record debt for amounts already spent. Startup recovery replays account-tagged
orders through the same ledger.

## Added browser coverage

The injected Reddit harness now enables commerce for a dedicated journey, completes
onboarding, opens the shop, and verifies all six Gold prices. It checks the SKU and
opaque account metadata sent through the real SDK message bridge. Cancellation
leaves the balance unchanged. Opening checkout does not grant coins; after the
simulated server balance changes from 300 to 550, a successful checkout displays
the 250-coin reward. Reloading reads the 550-coin balance from the mocked gateway.

This is local integration coverage, not a hosted payment receipt. Firebase ledger
behavior is independently covered by backend tests.

## Results

- Injected Reddit browser suite: passed, including the new checkout journey.
- Reddit bootstrap tests: 21 passed.
- Reddit catalog tests: 3 passed.
- Devvit package tests: 31 passed, including payment parsing and recovery.
- Backend commerce, feature-gate, and gameplay endpoint tests: 15 passed.
- Portal typecheck and complete Devvit package validation: passed.
- All four target builds and isolation audits: passed. YouTube used its explicitly
  non-release engineering fixture. Jest's artifact audit rejects Devvit integration.

Production commerce remains approval-gated. Reddit requires approved products
before actual payments are processed; development uses sandbox purchases. See
[Reddit's payment documentation](https://developers.reddit.com/docs/earn-money/payments/payments_add).
The outstanding owner-session and approval evidence is recorded in
[the browser/MCP verification](reddit-browser-mcp-2026-09-19.md).
