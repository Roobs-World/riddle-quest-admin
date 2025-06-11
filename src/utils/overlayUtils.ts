export const checkAnyOverlayVisible = (
  isInstructionsVisible: boolean,
  isFullProfileDetailsOverlayVisible: boolean,
  isCoinShopModalVisible: boolean,
  isWatchAdModalVisible: boolean,
  isWelcomeOverlayVisible: boolean,
  isOutOfAttemptsModalVisible: boolean,
  isCreditsOverlayVisible: boolean
): boolean => {
  return (
    isInstructionsVisible ||
    isFullProfileDetailsOverlayVisible ||
    isCoinShopModalVisible ||
    isWatchAdModalVisible ||
    isWelcomeOverlayVisible ||
    isOutOfAttemptsModalVisible ||
    isCreditsOverlayVisible
  );
};
