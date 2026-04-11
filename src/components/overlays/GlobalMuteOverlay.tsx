import React, { useCallback, useEffect, useState } from "react";
import { Modal, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MuteButton from "../buttons/MuteButton";
import { SoundManager } from "../../services/SoundManager";

const SOUND_ENABLED_STORAGE_KEY = "isSoundEnabled";

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

  return null;
  
  (
    <Modal
      transparent={true}
      visible={true}
      animationType="none"
      statusBarTranslucent={true}
    >
      <View style={{ flex: 1 }} pointerEvents="box-none">
        <View
          pointerEvents="box-none"
          style={{ position: "absolute", top: 16, right: 16, zIndex: 2147483647 }}
        >
          <MuteButton isMuted={isMuted} onToggle={handleToggleMute} />
        </View>
      </View>
    </Modal>
  );
};

export default GlobalMuteOverlay;
