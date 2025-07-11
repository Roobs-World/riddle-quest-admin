export const checkAnyOverlayVisible = (
  isInstructionsVisible: boolean,
  isFullProfileDetailsOverlayVisible: boolean,
  isCoinShopModalVisible: boolean,
  isWatchAdModalVisible: boolean,
  isWelcomeOverlayVisible: boolean,
  additionalOverlay: boolean = false
): boolean => {
  return (
    isInstructionsVisible ||
    isFullProfileDetailsOverlayVisible ||
    isCoinShopModalVisible ||
    isWatchAdModalVisible ||
    isWelcomeOverlayVisible ||
    additionalOverlay
  );
};
