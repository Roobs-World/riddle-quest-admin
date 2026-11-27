# Riddle Quest banner placement and activation — 27 November 2026

The earlier prerequisite inspection established that no banner placement existed; it did not establish a Meta restriction against creating one. A subsequent authenticated inspection of the same RiddleQuest Audience Network property offered **Banner** as an Instant Games placement format. The current [Meta banner guide](https://developers.facebook.com/documentation/games/monetize/in-app-ads/banner-ads), read in the browser, still documents creating a separate Banner placement and its gradual phase-out through 31 March 2027.

Under the owner's Facebook integration and test-upload authorization, created exactly one dedicated menu ad space and one Banner placement. No existing rewarded/interstitial placement was modified or reused.

| Field | Observed value |
| --- | --- |
| Game / app | Riddle Quest, `1748953042991569` |
| Business | Roobs World Limited, `2198725140593714` |
| Audience Network property | RiddleQuest, `957348766757902` |
| New ad space | Riddle Quest Menus, `1831460568074149` |
| New placement | Riddle Quest Menu Banner, `1748953042991569_1831460981407441` |
| Display format | Banner |
| Placement status immediately after creation | Ready to publish |

The [placement's existing-property page](https://business.facebook.com/pub/property/adspace?business_id=2198725140593714&property_id=957348766757902&ad_space_id=1831460568074149) contains the exact row. No public game publication, review submission, payout change or permission expansion occurred. **Ready to publish** is the placement's observed label, not proof that an ad has been served or that every game-review requirement is approved.

The Facebook build is being configured with `VITE_FACEBOOK_BANNER_ENABLED=true` and the new public placement ID. Activation remains subject to the two advertised SDK methods, current account ownership, fresh server-owned subscription/ad-removal eligibility, visible page, mounted layout and the existing service cutoff. Static Settings/Profile surfaces may be eligible; active gameplay and the multiplayer surface are excluded. Native dialog preparation hides the banner before admitting another provider surface.

Firebase source, configuration and deployment remain frozen. Production game version 9 and the accepted Testing version 14 are unchanged at this setup stage. Local activation verification and a new exact-artifact Testing upload must be recorded before claiming this feature is accepted.

## Local activation checks

The existing banner lifecycle and combined ad-eligibility suites passed **20 tests across two suites** in 0.257 seconds. Log: `/tmp/facebook-banner-activation-unit.log`.

```sh
pnpm exec jest --config jest.config.cjs --runInBand --runTestsByPath platforms/web/facebook/src/__tests__/FacebookExpandedBanner.test.ts platforms/web/facebook/src/__tests__/FacebookAdConfiguration.test.ts
```

An independent read-only activation review found no client-side blocker. It confirmed paired SDK support, current-owner checks, fresh combined subscription/ad-removal eligibility before load, serialized native hide/cleanup, rechecking late loads, lifecycle suppression and the existing service cutoff. This does not establish provider fill or native host acceptance.

The full injected-SDK browser journey passed in **33.923 seconds** (one suite, one integrated test), including the new activation scenario through the real built entry and layout. The isolated browser build explicitly uses a synthetic placement. Only external Meta surface/SDK and existing HTTP/subscription boundaries are fixtures; no production test hook was added. The scenario verifies that Settings fits above the external 60-pixel banner, a held hide acknowledgement prevents a native Privacy dialog from overlapping it, cancellation restores the eligible menu banner, gameplay hides it and restores input, and no-fill clears reservation while controls remain usable. Log: `/tmp/facebook-banner-activation-browser-final.log`.

```sh
PORTAL_BROWSER_TESTS=1 pnpm exec jest --config jest.config.cjs --runInBand --runTestsByPath platforms/web/facebook/src/__tests__/facebookBrowser.jest-playwright.test.ts
```

The fixture selects English through the real Settings language control and waits for the resulting game/menu transition before reopening Settings. A language change closes that menu; it must not be mistaken for a banner failing to appear on an eligible surface. The final verification used this synchronized flow, with temporary diagnostics removed.
