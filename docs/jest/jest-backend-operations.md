# Jest backend on the Facebook branch

The Facebook client and the shared backend have separate provider boundaries. This branch excludes the Jest browser app and SDK but preserves every Jest backend integration from `c3b74fa37`.

| Integration | Export or owner |
| --- | --- |
| Signed player identity and account provisioning | `exchangeJestIdentity`, `platforms/web/jest/server/jestIdentity.ts` |
| Signed purchases and idempotent coin grants | `grantJestPurchase`, purchase receipts and shared product catalog |
| Recurring subscriptions and entitlement reconciliation | `syncJestSubscriptions` |
| Signed referral conversions and rewards | `verifyJestReferrals` |
| Provider avatar synchronization | `syncJestAvatar` |
| Account lifecycle and recoverable deletion | `retryJestAccountDeletion`, shared deletion callable and generation/tombstone guards |
| Manager-owned notification plans | `getJestNotificationPlan`, `notification-manager/api/devices/jest/registration.ts`, `notification-manager/server/jest/plan.ts` |
| Multiplayer, presence and notification preferences | Existing shared provider authorization, rules, indexes and race services |

Jest referral identifiers and notification schemas used by the server now live in `platforms/web/jest/server/referrals` and `server/notifications`. They have no browser SDK dependency. The Functions staging script copies the server root without recreating a Jest client source tree.

Build and validate from the repository root:

```sh
pnpm --dir firebase-functions build
pnpm check:types:notification-manager
pnpm check:functions-layout
```

These commands compile and inspect local artifacts. They do not deploy or change live data. Production identity, origins, secret bindings, purchase/subscription SKU configuration and server-authoritative grants retain their existing deployment validation. Backend deployment and service configuration changes require their usual explicit authorization.

The Sentry worker retains Jest deployed-version inventory and signed main-base/exact-head checks. Its repair scope permits Jest server files without recreating the removed client. Facebook artifact checks reject Jest SDK, server modules and other provider runtime dependencies.

The shared race codec accepts persisted `jest-invite-` identifiers as well as `race-invite-` identifiers. These opaque wire values preserve existing backend contracts; they do not load the Jest SDK or expose Jest registration/subscription UI in Facebook.
