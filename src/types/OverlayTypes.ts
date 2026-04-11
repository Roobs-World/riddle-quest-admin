/**
 * Visibility flags for each gameplay overlay/modal.
 */
export interface GameScreenOverlayState {
  /** Victory modal visibility flag. */
  isVictoryModalVisible: boolean;
  /** Loss modal visibility flag. */
  isLossModalVisible: boolean;
  /** Hint overlay visibility flag. */
  isHintOverlayVisible: boolean;
  /** Home/exit overlay visibility flag. */
  isHomeOverlayVisible: boolean;
  /** Play/resume overlay visibility flag. */
  isPlayOverlayVisible: boolean;
  /** Profile overlay visibility flag. */
  isProfileOverlayVisible: boolean;
  /** Settings overlay visibility flag. */
  isSettingsOverlayVisible: boolean;
}

/**
 * Setter actions used to toggle each game overlay visibility flag.
 */
export interface GameScreenOverlayActions {
  /** Sets victory modal visibility. */
  setIsVictoryModalVisible: (isVisible: boolean) => void;
  /** Sets loss modal visibility. */
  setIsLossModalVisible: (isVisible: boolean) => void;
  /** Sets hint overlay visibility. */
  setIsHintOverlayVisible: (isVisible: boolean) => void;
  /** Sets home overlay visibility. */
  setIsHomeOverlayVisible: (isVisible: boolean) => void;
  /** Sets play overlay visibility. */
  setIsPlayOverlayVisible: (isVisible: boolean) => void;
  /** Sets profile overlay visibility. */
  setIsProfileOverlayVisible: (isVisible: boolean) => void;
  /** Sets settings overlay visibility. */
  setIsSettingsOverlayVisible: (isVisible: boolean) => void;
}
