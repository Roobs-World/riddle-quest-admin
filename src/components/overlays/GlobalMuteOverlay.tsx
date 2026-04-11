import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MuteButton from "../buttons/MuteButton";
import { SoundManager } from "../../services/SoundManager";

const SOUND_ENABLED_STORAGE_KEY = "isSoundEnabled";
const OVERLAY_TOP_OFFSET = 56;
const OVERLAY_RIGHT_OFFSET = 16;

const parseSoundPreference = (rawValue: string | null): boolean => {
  if (rawValue === null) return SoundManager.getSoundEnabled();
  try {
    return JSON.parse(rawValue);
  } catch {
    return SoundManager.getSoundEnabled();
  }
};

const GlobalMuteOverlay = () => {
  const [isMuted, setIsMuted] = useState(!SoundManager.getSoundEnabled());

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
    <View pointerEvents="box-none" style={styles.touchThroughRoot}>
      <View
        pointerEvents="box-none"
        style={[
          styles.buttonContainer,
          { top: OVERLAY_TOP_OFFSET, right: OVERLAY_RIGHT_OFFSET },
        ]}
      >
        <MuteButton isMuted={isMuted} onToggle={handleToggleMute} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  touchThroughRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2147483647,
    elevation: 9999,
  },
  buttonContainer: {
    position: "absolute",
  },
});

export default GlobalMuteOverlay;
