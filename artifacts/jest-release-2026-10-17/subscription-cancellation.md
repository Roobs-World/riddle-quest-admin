# Live sandbox cancellation check

Build: `1.0.0-dev.20261017114313.34c43b31f9cd.401d2cf4`.

The entitlement API reports the configured monthly SKU as `active` with `sandbox: true` for all three available sandbox accounts. The backend accepts their signed entitlements and restores them after reload.

Calling the platform SDK directly, without the game's adapter, returns:

```json
{"result":"error","error":"not_active"}
```

The call uses `JestSDK.payments.cancelSubscription({subscriptionSku: "com.roobsworld.riddlequest.premium.monthly"})`. This result also occurs after the notification request-size fix, so it is independent of the earlier HTTP 413 failures.

The [subscription documentation](https://docs.jest.com/sdk/html5/subscriptions) says cancelled subscriptions remain entitled until their paid period ends. These accounts may already have cancelled renewals; the available entitlement response does not establish that a new cancellation is possible. This run therefore cannot confirm a fresh live cancellation or classify the response as a game defect.

The app's cancellation flow passes in the Simulator: confirmation succeeds, the entitlement becomes inactive, and the existing coin balance is preserved. The final Simulator session passes all 20 Basic Launch checks and all 5 Recommended checks.

A sandbox account with a fresh, cancellable subscription is needed to complete the live cancellation case. [Reset Player State](https://docs.jest.com/dev-console/sandbox-users) does not clear subscriptions and would also reset player identities across apps, so it is not a suitable billing fixture reset.

No account reset or billing-catalog change was performed.
