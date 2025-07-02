export const checkAnyOverlayVisible = (
  isInstructionsVisible: boolean,
  isFullProfileDetailsOverlayVisible: boolean,
  isCoinShopModalVisible: boolean,
  isWatchAdModalVisible: boolean,
  isWelcomeOverlayVisible: boolean,
  isOutOfAttemptsModalVisible: boolean,
  additionalOverlay: boolean = false
): boolean => {
  return (
    isInstructionsVisible ||
    isFullProfileDetailsOverlayVisible ||
    isCoinShopModalVisible ||
    isWatchAdModalVisible ||
    isWelcomeOverlayVisible ||
    isOutOfAttemptsModalVisible ||
    additionalOverlay
  );
};
