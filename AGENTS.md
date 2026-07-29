# Repository instructions

- The client is a standard React HTML5 game built with Vite for the Jest gaming platform.
- Do not add React Native, Expo, EAS, Android, iOS, native store, admin-panel, Clerk, rewarded-ad, or native IAP code.
- Use the Jest HTML5 SDK adapter for platform identity, registration, purchases, referrals, notifications, screenshots, preferences, and lifecycle signals.
- Keep purchase grants, identity exchange, and referral rewards server-authoritative and idempotent.
- When removing visible text, verify it is unused elsewhere and remove the corresponding key from every locale.
- When adding visible text, add it to every supported locale or reuse an existing translated key.
- Verify UI changes in a browser and build the standalone Jest artifact before handoff.
