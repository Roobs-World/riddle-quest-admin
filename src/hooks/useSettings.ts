/**
 * @fileoverview
 * Hook for managing user-facing audio and haptics settings.
 *
 * This hook persists sound and haptics preferences to AsyncStorage,
 * coordinates those values with `SoundManager`, and exposes a minimal
 * API for components to read and update the current settings.
 */
import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SoundManager } from "../services/SoundManager";
import { safeDelay } from "../utils/timing";
import { logger } from "../utils/logger";
import { captureException } from "../utils/sentry";
import { SOUND_RESUME_DELAY_MS } from "../constants/game";

const SOUND_ENABLED_STORAGE_KEY = "isSoundEnabled";
const HAPTICS_ENABLED_STORAGE_KEY = "isHapticsEnabled";
const HARD_MODE_STORAGE_KEY = "isHardMode";

/**
 * Manages persisted sound and haptics preferences for the current user.
 *
 * Preferences are loaded from AsyncStorage on mount, written back on change,
 * and propagated to `SoundManager` so that background music and effects
 * stay in sync with the toggles.
 *
 * @returns Current boolean flags for sound and haptics along with callbacks
 * to update each preference.
 */
export const useSettings = () => {
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isHapticsEnabled, setIsHapticsEnabled] = useState(true);
  const [isHardMode, setIsHardMode] = useState(false);

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

        const hardMode = await AsyncStorage.getItem(HARD_MODE_STORAGE_KEY);
        if (hardMode !== null) {
          setIsHardMode(JSON.parse(hardMode));
        }
      } catch (error) {
        logger.error("Error loading settings from AsyncStorage:", error);
        captureException(error);
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(
      SOUND_ENABLED_STORAGE_KEY,
      JSON.stringify(isSoundEnabled)
    ).catch((error: unknown) => {
      logger.error("Error saving sound setting:", error);
      captureException(error);
    });

    SoundManager.setSoundEnabled(isSoundEnabled);
    if (isSoundEnabled) {
      safeDelay(SOUND_RESUME_DELAY_MS).then(() =>
        SoundManager.playBackgroundMusic()
      );
    } else {
      SoundManager.pauseBackgroundMusic();
    }
  }, [isSoundEnabled]);

  useEffect(() => {
    AsyncStorage.setItem(
      HAPTICS_ENABLED_STORAGE_KEY,
      JSON.stringify(isHapticsEnabled)
    ).catch((error: unknown) => {
      logger.error("Error saving haptics setting:", error);
      captureException(error);
    });
  }, [isHapticsEnabled]);

  useEffect(() => {
    AsyncStorage.setItem(
      HARD_MODE_STORAGE_KEY,
      JSON.stringify(isHardMode)
    ).catch((error: unknown) => {
      logger.error("Error saving hard mode setting:", error);
      captureException(error);
    });
  }, [isHardMode]);

  const toggleSoundEnabled = useCallback((enabled: boolean) => {
    setIsSoundEnabled(enabled);
  }, []);

  const toggleHapticsEnabled = useCallback((enabled: boolean) => {
    setIsHapticsEnabled(enabled);
  }, []);

  const toggleHardMode = useCallback((enabled: boolean) => {
    setIsHardMode(enabled);
  }, []);

  return {
    isSoundEnabled,
    isHapticsEnabled,
    isHardMode,
    toggleSoundEnabled,
    toggleHapticsEnabled,
    toggleHardMode,
  };
};
