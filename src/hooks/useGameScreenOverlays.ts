import { useState } from "react";
import {
  GameScreenOverlayState,
  GameScreenOverlayActions,
} from "../types/OverlayTypes";

/**
 * Centralized state hook for all gameplay overlay visibility flags.
 *
 * @returns Overlay visibility state plus typed setter actions.
 */
const useGameScreenOverlays = (): GameScreenOverlayState &
  GameScreenOverlayActions => {
  const [isVictoryModalVisible, setIsVictoryModalVisible] = useState(false);
  const [isLossModalVisible, setIsLossModalVisible] = useState(false);
  const [isHintOverlayVisible, setIsHintOverlayVisible] = useState(false);
  const [isHomeOverlayVisible, setIsHomeOverlayVisible] = useState(false);
  const [isPlayOverlayVisible, setIsPlayOverlayVisible] = useState(false);
  const [isProfileOverlayVisible, setIsProfileOverlayVisible] = useState(false);
  const [isSettingsOverlayVisible, setIsSettingsOverlayVisible] =
    useState(false);

  return {
    isVictoryModalVisible,
    setIsVictoryModalVisible,
    isLossModalVisible,
    setIsLossModalVisible,
    isHintOverlayVisible,
    setIsHintOverlayVisible,
    isHomeOverlayVisible,
    setIsHomeOverlayVisible,
    isPlayOverlayVisible,
    setIsPlayOverlayVisible,
    isProfileOverlayVisible,
    setIsProfileOverlayVisible,
    isSettingsOverlayVisible,
    setIsSettingsOverlayVisible,
  };
};

export default useGameScreenOverlays;
