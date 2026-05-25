/**
 * Determines if any modal/overlay is currently visible on the game screen.
 *
 * @param isInstructionsVisible Instructions/help modal visibility.
 * @param isFullProfileDetailsOverlayVisible Profile details overlay visibility.
 * @param isCoinShopVisible Coin shop modal visibility.
 * @param isWatchAdModalVisible Watch-ad modal visibility.
 * @param isWelcomeOverlayVisible Welcome/onboarding overlay visibility.
 * @param additionalOverlay Optional extra visibility flag from callers.
 * @returns `true` when at least one overlay flag is active.
 */
export const checkAnyOverlayVisible = (
  isInstructionsVisible: boolean,
  isFullProfileDetailsOverlayVisible: boolean,
  isCoinShopVisible: boolean,
  isWatchAdModalVisible: boolean,
  isWelcomeOverlayVisible: boolean,
  additionalOverlay: boolean = false,
): boolean => {
  return (
    isInstructionsVisible ||
    isFullProfileDetailsOverlayVisible ||
    isCoinShopVisible ||
    isWatchAdModalVisible ||
    isWelcomeOverlayVisible ||
    additionalOverlay
  );
};
