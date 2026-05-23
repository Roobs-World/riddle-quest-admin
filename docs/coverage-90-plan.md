# 90% Project Coverage Plan

## Goal
- Reach and sustain **>90% total project statements and lines** covered by `test:coverage:project`.

## Current Baseline (2026-04-11)
- `pnpm run test:coverage:project`
- Statements: **96.70%**
- Lines: **97.14%**
- Test suites: **162 passed / 162 total**

## Definition of Done
- [x] `pnpm run test:coverage:project` exits `0`
- [x] Total project statements and lines are over 90%
- [x] New/updated tests are deterministic and pass with `--runInBand`
- [x] This plan file is updated with completed items and final results

## Working Commands
- Full tests: `pnpm exec jest --watchAll=false --runInBand`
- Full coverage + project gate: `pnpm run test:coverage:project`
- Game-only coverage gate: `pnpm run test:coverage:game`

## Execution Strategy
1. Raise the lowest files first (0%-40%) to remove biggest blockers quickly.
2. Raise mid-tier files (40%-79%) by focused branch/edge-case tests.
3. Finish near-threshold files (80%-89%) with surgical tests.
4. Re-run strict gate after each batch and update this file.

## Phase Checklist

### Phase 1 - Zero Coverage Files
- [x] `src/components/background/SolarSystem3D.tsx` - `src/components/background/__tests__/SolarSystem3D.test.tsx`
- [x] `src/components/background/SolarSystemConfig.ts` - `src/components/background/__tests__/SolarSystemConfig.test.ts`
- [x] `src/components/buttons/CloseButtonWhite.tsx` - `src/components/buttons/__tests__/CloseButtonWhite.test.tsx`
- [x] `src/components/buttons/TwitterSignInButton.tsx` - `src/components/buttons/__tests__/TwitterSignInButton.test.tsx`
- [x] `src/components/development/ModalTogglePanel.tsx` - `src/components/development/__tests__/ModalTogglePanel.test.tsx`
- [x] `src/components/icons/TwitterXIcon.tsx` - `src/components/icons/__tests__/TwitterXIcon.test.tsx`
- [x] `src/components/loading/PulsingSpinner.tsx` - `src/components/loading/__tests__/PulsingSpinner.test.tsx`
- [x] `src/components/modals/ModalProvider.tsx` - `src/components/modals/__tests__/ModalProvider.test.tsx`
- [x] `src/services/SolarSystemPreloader.ts` - `src/services/__tests__/SolarSystemPreloader.test.ts`
- [x] `src/services/TextureDebugger.ts` - `src/services/__tests__/TextureDebugger.test.ts`

### Phase 2 - Critical Low Coverage (<40%)
- [x] `src/components/background/StarryBackground.tsx` - `src/components/background/__tests__/StarryBackground.test.tsx`
- [x] `src/components/shop/CoinShopModal.tsx` - `src/components/shop/__tests__/CoinShopModal.test.tsx`
- [x] `src/navigation/NavigationStack.tsx` - `src/navigation/__tests__/NavigationStack.test.tsx`
- [x] `src/components/icons/XIcon.tsx` - `src/components/icons/__tests__/XIcon.test.tsx`
- [x] `src/screens/game/GameScreen.tsx` - `src/screens/game/__tests__/GameScreen.test.tsx` (98.03% statements / 100% lines in focused coverage)
- [x] `src/utils/audioOptimization.ts` - `src/utils/__tests__/audioOptimization.test.ts` (98.46% statements/lines)
- [x] `src/utils/sentry.ts` - `src/utils/__tests__/sentry.test.ts`

### Phase 3 - Mid Coverage (40%-79%)
- [x] `src/components/icons/CloseIconWhite.tsx` - `src/components/icons/__tests__/CloseIconWhite.test.tsx`
- [x] `src/components/buttons/WideButton.tsx` - `src/components/buttons/__tests__/WideButton.test.tsx` (100% statements/lines)
- [x] `src/contexts/AuthContext.tsx`
- [x] `src/services/ProductPricingService.ts` - `src/services/__tests__/ProductPricingService.test.ts`
- [x] `src/components/modals/help/HintModal.tsx` - `src/components/modals/help/__tests__/HintModal.test.tsx` (100% statements/lines in focused coverage)
- [x] `src/components/modals/settings/AvatarOptionsModal.tsx` - `src/components/modals/settings/__tests__/AvatarOptionsModal.test.tsx`
- [x] `src/constants/AppStrings.ts` - `src/constants/__tests__/AppStrings.i18n.test.ts`, `src/constants/__tests__/AppStrings.coverage.test.ts`
- [x] `src/screens/LandingScreen.tsx` - `src/screens/__tests__/LandingScreen.test.tsx`
- [x] `src/screens/auth/LoginScreen.tsx` - `src/screens/auth/__tests__/LoginScreen.test.tsx`
- [x] `src/hooks/useModal.ts` - `src/hooks/__tests__/useModal.test.ts` (100% statements/lines in focused coverage)
- [x] `src/screens/auth/SignUpScreen.tsx` - `src/screens/auth/__tests__/SignUpScreen.test.tsx`
- [x] `src/services/FirestoreService.ts` - `src/services/__tests__/FirestoreService.test.ts`
- [x] `src/components/modals/help/WelcomeModal.tsx` - `src/components/modals/help/__tests__/WelcomeModal.test.tsx`

### Phase 4 - Near Threshold (80%-89%)
- [x] `src/utils/responsive.ts` - `src/utils/__tests__/responsive.test.ts`
- [x] `src/components/modals/settings/FullProfileDetailsModal.tsx` - `src/components/modals/settings/__tests__/FullProfileDetailsModal.test.tsx` (94.59% lines)
- [x] `src/services/NotificationService.ts` - `src/services/__tests__/NotificationService.test.ts`
- [x] `src/services/AnalyticsService.ts` - `src/services/__tests__/AnalyticsService.test.ts` (95.38% lines)
- [x] `src/services/GameStateManager.ts` - `src/services/__tests__/GameStateManager.test.ts` (100% lines)
- [x] `src/components/inputFields/UserPasswordInput.tsx` - `src/components/inputFields/__tests__/UserPasswordInput.test.tsx` (100% lines)
- [x] `src/services/solar/sceneFactory.ts` - `src/services/solar/__tests__/sceneFactory.test.ts`
- [x] `src/hooks/useSettings.ts` - `src/hooks/__tests__/useSettings.test.ts` (100% lines)
- [x] `src/hooks/useTileCapture.ts` - `src/hooks/__tests__/useTileCapture.test.ts` (97.61% lines)
- [x] `src/components/modals/settings/SettingsModal.tsx` - `src/components/modals/settings/__tests__/SettingsModal.test.tsx` (92.59% lines)

### Phase 5 - Final Hardening
- [x] Run `pnpm run test:coverage:project`
- [x] Fix any newly surfaced files under 90%
- [x] Re-run and confirm stable pass twice

## Progress Log
- [x] 2026-04-11: Created plan and tracking file.
- [x] 2026-04-11: Completed 8/10 Phase 1 files to >=90% (remaining: `SolarSystem3D.tsx`, `ModalTogglePanel.tsx`).
- [x] 2026-04-11: Improved strict project coverage from 70.88%/71.28% to 77.12%/77.44%.
- [x] 2026-04-11: Completed Phase 1 (all zero-coverage files now >=90% statements/lines in focused runs).
- [x] 2026-04-11: Re-ran strict project gate; baseline now 80.53%/80.89%, with remaining blockers in Phases 2-4.
- [x] 2026-04-11: Completed `StarryBackground.tsx` to 100% statements/lines and raised strict project baseline to 81.78%/82.04%.
- [x] 2026-04-11: Completed `XIcon.tsx` and `CloseIconWhite.tsx` to 100% and raised strict project baseline to 81.83%/82.10%.
- [x] 2026-04-11: Completed `CoinShopModal.tsx` (98.03% statements / 100% lines) and `NavigationStack.tsx` (94.69% statements / 95.41% lines) in focused coverage runs.
- [x] 2026-04-11: Added `src/utils/__tests__/sentry.test.ts`; `sentry.ts` is now 100% statements/lines in focused coverage, and strict project baseline improved to 84.45%/84.70%.
- [x] 2026-04-11: Phase 2 audioOptimization.ts raised to 98.46% lines.
- [x] 2026-04-11: Phase 3 WideButton.tsx raised to 100% lines.
- [x] 2026-04-11: Phase 4 useTileCapture.ts raised to 97.61% lines, SettingsModal.tsx to 92.59% lines, useSettings.ts to 100% lines, UserPasswordInput.tsx to 100% lines, GameStateManager.ts to 100% lines, AnalyticsService.ts to 95.38% lines.
- [x] 2026-04-11: Overall project coverage improved to 86.43% lines.
- [x] 2026-04-11: `useModal.ts` raised to 100% statements/branches/functions/lines in focused coverage (`src/hooks/__tests__/useModal.test.ts`).
- [x] 2026-04-11: `GameScreen.tsx` raised to 98.03% statements / 100% lines in focused coverage (`src/screens/game/__tests__/GameScreen.test.tsx`).
- [x] 2026-04-11: `HintModal.tsx` raised to 100% statements/lines in focused coverage (`src/components/modals/help/__tests__/HintModal.test.tsx`).
- [x] 2026-04-11: Strict project run reached 91.22% statements / 91.53% lines overall, with remaining per-file blockers listed in Phases 3-4.
- [x] 2026-04-11: Phase 3 complete.
- [x] 2026-04-11: Phase 4 complete.
- [x] 2026-04-11: Project gate passing at >=90% (`pnpm run test:coverage:project` -> 0).
- [x] 2026-05-23: Updated the project gate to enforce total project statements and lines over 90%, matching the requested project coverage target.

## Notes
- Mark completed items by changing `[ ]` to `[x]`.
- Add test file links next to each completed item for traceability.
- If a file is intentionally excluded, document the reason and update the gate script accordingly.
