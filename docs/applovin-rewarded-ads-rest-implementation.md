# AppLovin Rewarded Ads: Remaining Implementation Guide

This guide covers what is still required to fully ship rewarded AppLovin ads in Riddle Quest.

## What Is Already In Place

- Rewarded ad hook exists and is wired into `GameScreen`:
  - `src/hooks/useRewardedAds.ts`
  - `src/screens/game/GameScreen.tsx`
- AppLovin config values are read from Expo config extras:
  - `src/config/applovin.ts`
  - `app.config.js` (`extra.APPLOVIN_*`)
- App startup now initializes AppLovin via:
  - `src/services/AppLovinService.ts`
  - `App.tsx`
- Android Expo config plugin adds `applovin.sdk.key` metadata:
  - `plugins/withAppLovinMax.js`
  - registered in `app.config.js`

## Remaining Work

## 1. Set Real Environment Values

Update `.env` with real values (no placeholders):

- `APPLOVIN_SDK_KEY`
- `APPLOVIN_REWARDED_AD_UNIT_ID`
- `APPLOVIN_INTERSTITIAL_AD_UNIT_ID` (optional for now, but keep valid if used later)

Also ensure these are set in EAS environments used for builds:

- development
- preview
- production

## 2. Implement Missing Firebase Function: `awardedAdCallback`

The app currently calls this Cloud Function from `useRewardedAds`, but it does not exist in `firebase-functions/src/index.ts`.

### Required behavior

- Callable function name: `awardedAdCallback`
- Input payload:
  - `userId: string`
  - `placement: string`
- Validate auth + payload.
- Prevent abuse (idempotency/rate limit per user/session window).
- Apply reward (coins or continue entitlement) in Firestore.
- Log analytics/debug details for ad attribution.
- Return a typed success response.

### Integration points

- Add implementation file (for example `firebase-functions/src/ads.ts`).
- Export from `firebase-functions/src/index.ts`.
- Add unit tests under `firebase-functions/src/__tests__/`.

## 3. Deploy Firebase Functions

From `firebase-functions/`:

```bash
pnpm test
pnpm build
firebase deploy --only functions
```

Confirm `awardedAdCallback` is deployed and callable from the app.

## 4. Regenerate Native Projects and Rebuild

Because Expo plugin/config changed, rebuild native artifacts.

From repo root:

```bash
pnpm exec expo prebuild --clean
pnpm exec expo run:android
```

If using EAS:

```bash
pnpm exec eas build --profile development --platform android
```

## 5. Configure AppLovin Dashboard Correctly

- Ensure ad unit IDs match the app package (`com.grindhead.Riddle Quest`).
- Ensure the same IDs are used for the correct environment.
- Add test devices / test mode.
- Verify waterfall/mediation setup is active for rewarded inventory.

## 6. End-to-End QA Checklist

- App logs show successful AppLovin initialization.
- Rewarded ad loads before showing loss/shop actions.
- Show flow returns:
  - `true` only when reward callback is received.
  - `false` on load/display/timeout failure.
- `awardedAdCallback` updates backend reward state exactly once.
- No duplicate listener behavior after navigating away/back to game screen.
- Error fallback modals appear for no-fill/not-ready paths.

## 7. Production Hardening (Recommended)

- Add server-side anti-fraud controls:
  - short replay window lock
  - per-user reward caps
  - request signature/customData strategy
- Add telemetry:
  - ad load success rate
  - ad show success rate
  - reward completion rate
  - backend callback success/failure rate
- Add alerts for sudden drop in rewarded completions.

## Quick Verification Commands

```bash
pnpm test -- src/screens/game/__tests__/GameScreen.test.tsx
pnpm test -- src/services/__tests__/AnalyticsService.test.ts
pnpm exec expo config --type public
```

Use `expo config --type public` output to confirm `extra.APPLOVIN_*` values resolve correctly for your active environment.
