export const checkAnyOverlayVisible = (
  isVictoryModalVisible: boolean,
  isInstructionsVisible: boolean,
  isFullProfileDetailsOverlayVisible: boolean,
  isCoinShopModalVisible: boolean,
  isWatchAdModalVisible: boolean
): boolean => {
  return (
    isVictoryModalVisible ||
    isInstructionsVisible ||
    isFullProfileDetailsOverlayVisible ||
    isCoinShopModalVisible ||
    isWatchAdModalVisible
  );
};
