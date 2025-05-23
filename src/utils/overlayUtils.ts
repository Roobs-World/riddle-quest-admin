export const checkAnyOverlayVisible = (
  isVictoryModalVisible: boolean,
  isLossModalVisible: boolean,
  isHintOverlayVisible: boolean,
  isSkipOverlayVisible: boolean,
  isHomeOverlayVisible: boolean,
  isPlayOverlayVisible: boolean,
  isProfileOverlayVisible: boolean,
  isSettingsOverlayVisible: boolean,
  isInstructionsVisible: boolean,
  isFullProfileDetailsOverlayVisible: boolean,
  isCoinShopModalVisible: boolean
): boolean => {
  return (
    isVictoryModalVisible ||
    isLossModalVisible ||
    isHintOverlayVisible ||
    isSkipOverlayVisible ||
    isHomeOverlayVisible ||
    isPlayOverlayVisible ||
    isProfileOverlayVisible ||
    isSettingsOverlayVisible ||
    isInstructionsVisible ||
    isFullProfileDetailsOverlayVisible ||
    isCoinShopModalVisible
  );
};
