// Utility function to check if any of the specified overlays or modals are visible
export const checkAnyOverlayVisible = (
  isVictoryModalVisible: boolean,
  isLossModalVisible: boolean,
  isHintOverlayVisible: boolean,
  isSkipOverlayVisible: boolean,
  isHomeOverlayVisible: boolean,
  isPlayOverlayVisible: boolean,
  isProfileOverlayVisible: boolean,
  isSettingsOverlayVisible: boolean
): boolean => {
  return (
    isVictoryModalVisible ||
    isLossModalVisible ||
    isHintOverlayVisible ||
    isSkipOverlayVisible ||
    isHomeOverlayVisible ||
    isPlayOverlayVisible ||
    isProfileOverlayVisible ||
    isSettingsOverlayVisible
  );
};
