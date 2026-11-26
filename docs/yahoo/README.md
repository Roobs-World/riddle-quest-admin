# Yahoo candidate

The Yahoo candidate frontend is removed from this branch. Its retained server integration is unchanged. Frontend build and handoff instructions here are historical; see the [Jest-only frontend boundary](../jest/jest-only-frontend.md).

The Yahoo candidate is owned by `platforms/web/yahoo`. Read the [shared Netflix and Yahoo candidate guide](../common/releases/netflix-yahoo-candidate-builds.md) for its self-contained build contract.

Its optional [hosted notifications](notifications.md) use the Vercel notification service and browser Web Push. Notification content comes from the management website. Game progress remains local.

The [retained Stripe integration](yahoo-stripe-operations.md) describes server-side work. Its existence does not authorize enabling commerce in the candidate browser artifact.
