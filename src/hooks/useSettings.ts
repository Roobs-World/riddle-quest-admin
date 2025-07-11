import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SoundManager } from "../services/SoundManager";
import { safeDelay } from "../utils/timing";

const SOUND_ENABLED_STORAGE_KEY = "isSoundEnabled";
const HAPTICS_ENABLED_STORAGE_KEY = "isHapticsEnabled";

export const useSettings = () => {
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isHapticsEnabled, setIsHapticsEnabled] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const soundEnabled = await AsyncStorage.getItem(
          SOUND_ENABLED_STORAGE_KEY
        );
        if (soundEnabled !== null) {
          const parsedSoundEnabled = JSON.parse(soundEnabled);
          setIsSoundEnabled(parsedSoundEnabled);
          SoundManager.setSoundEnabled(parsedSoundEnabled);
        } else {
          SoundManager.setSoundEnabled(true);
        }

        const hapticsEnabled = await AsyncStorage.getItem(
          HAPTICS_ENABLED_STORAGE_KEY
        );
        if (hapticsEnabled !== null) {
          setIsHapticsEnabled(JSON.parse(hapticsEnabled));
        }
      } catch (error) {
        console.error("Error loading settings from AsyncStorage:", error);
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(
      SOUND_ENABLED_STORAGE_KEY,
      JSON.stringify(isSoundEnabled)
    ).catch((error: unknown) =>
      console.error("Error saving sound setting:", error)
    );

    SoundManager.setSoundEnabled(isSoundEnabled);
    if (isSoundEnabled) {
      safeDelay(500).then(() => SoundManager.playBackgroundMusic());
    } else {
      SoundManager.pauseBackgroundMusic();
    }
  }, [isSoundEnabled]);

  useEffect(() => {
    AsyncStorage.setItem(
      HAPTICS_ENABLED_STORAGE_KEY,
      JSON.stringify(isHapticsEnabled)
    ).catch((error: unknown) =>
      console.error("Error saving haptics setting:", error)
    );
  }, [isHapticsEnabled]);

  const toggleSoundEnabled = useCallback((enabled: boolean) => {
    setIsSoundEnabled(enabled);
  }, []);

  const toggleHapticsEnabled = useCallback((enabled: boolean) => {
    setIsHapticsEnabled(enabled);
  }, []);

  return {
    isSoundEnabled,
    isHapticsEnabled,
    toggleSoundEnabled,
    toggleHapticsEnabled,
  };
};
