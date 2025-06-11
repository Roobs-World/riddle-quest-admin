export interface GameScreenOverlayState {
  isVictoryModalVisible: boolean;
  isLossModalVisible: boolean;
  isHintOverlayVisible: boolean;
  isHomeOverlayVisible: boolean;
  isPlayOverlayVisible: boolean;
  isProfileOverlayVisible: boolean;
  isSettingsOverlayVisible: boolean;
  isCreditsOverlayVisible: boolean;
}

export interface GameScreenOverlayActions {
  setIsVictoryModalVisible: (isVisible: boolean) => void;
  setIsLossModalVisible: (isVisible: boolean) => void;
  setIsHintOverlayVisible: (isVisible: boolean) => void;
  setIsHomeOverlayVisible: (isVisible: boolean) => void;
  setIsPlayOverlayVisible: (isVisible: boolean) => void;
  setIsProfileOverlayVisible: (isVisible: boolean) => void;
  setIsSettingsOverlayVisible: (isVisible: boolean) => void;
  setIsCreditsOverlayVisible: (isVisible: boolean) => void;
}
