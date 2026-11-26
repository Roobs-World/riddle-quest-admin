# Platform integration matrix

This branch has one game frontend. Missing capabilities stay absent from its UI; no other provider SDK may fill the gap.

| Target | Provider integration | Identity and saves | Commerce and social | Ads |
| --- | --- | --- | --- | --- |
| Jest | Jest HTML5 SDK | Signed player exchange and Jest player data | Registration, profiles, referrals, notifications, purchases, subscriptions and milestones | No approved Jest ad API |

Provider server integrations remain intact. Their existence does not expose another game frontend or authorize adding their SDKs to the Jest artifact. The [Jest-only frontend boundary](../../jest/jest-only-frontend.md) identifies retained backend source and contracts.
