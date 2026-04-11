import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MuteButton from "../buttons/MuteButton";
import { SoundManager } from "../../services/SoundManager";
import { verticalScale } from "@/utils/responsive";

const SOUND_ENABLED_STORAGE_KEY = "isSoundEnabled";
const OVERLAY_TOP_OFFSET = verticalScale(64);
const OVERLAY_RIGHT_OFFSET = 16;

const getCurrentSoundEnabled = (): boolean => {
  if (typeof SoundManager.getSoundEnabled === "function") {
    return SoundManager.getSoundEnabled();
  }
  return true;
};

const parseSoundPreference = (rawValue: string | null): boolean => {
  if (rawValue === null) return getCurrentSoundEnabled();
  try {
    return JSON.parse(rawValue);
  } catch {
    return getCurrentSoundEnabled();
  }
};

const GlobalMuteOverlay = () => {
  const [isMuted, setIsMuted] = useState(!getCurrentSoundEnabled());

  useEffect(() => {
    const syncFromStorage = async () => {
      const storedSound = await AsyncStorage.getItem(SOUND_ENABLED_STORAGE_KEY);
      const soundEnabled = parseSoundPreference(storedSound);
      setIsMuted(!soundEnabled);
      SoundManager.setSoundEnabled(soundEnabled);
    };

    void syncFromStorage();
  }, []);

  const handleToggleMute = useCallback(() => {
    const nextIsMuted = !isMuted;
    const nextSoundEnabled = !nextIsMuted;

    setIsMuted(nextIsMuted);
    SoundManager.setSoundEnabled(nextSoundEnabled);
    void AsyncStorage.setItem(
      SOUND_ENABLED_STORAGE_KEY,
      JSON.stringify(nextSoundEnabled)
    );

    if (nextSoundEnabled) {
      void SoundManager.playBackgroundMusic();
      return;
    }

    void SoundManager.pauseBackgroundMusic();
  }, [isMuted]);

  return (
    <View style={[styles.buttonContainer, { top: OVERLAY_TOP_OFFSET, right: OVERLAY_RIGHT_OFFSET }]}>
      <MuteButton isMuted={isMuted} onToggle={handleToggleMute} />
    </View>
  );
};

const styles = StyleSheet.create({
  buttonContainer: {
    position: "absolute",
    zIndex: 1000,
    elevation: 1000,
  },
});

export default GlobalMuteOverlay;
