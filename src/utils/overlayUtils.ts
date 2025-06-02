export const checkAnyOverlayVisible = (
  isVictoryModalVisible: boolean,
  isInstructionsVisible: boolean,
  isFullProfileDetailsOverlayVisible: boolean,
  isCoinShopModalVisible: boolean,
  isWatchAdModalVisible: boolean,
  isWelcomeOverlayVisible: boolean,
  isOutOfAttemptsModalVisible: boolean
): boolean => {
  return (
    isVictoryModalVisible ||
    isInstructionsVisible ||
    isFullProfileDetailsOverlayVisible ||
    isCoinShopModalVisible ||
    isWatchAdModalVisible ||
    isWelcomeOverlayVisible ||
    isOutOfAttemptsModalVisible
  );
};
