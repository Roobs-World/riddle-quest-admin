import type { AudioPlayer } from "expo-audio";
import { AppState, AppStateStatus } from "react-native";
import {
  configureHighQualityAudioSession,
  createHighQualitySound,
  getOptimalAudioConfig,
  monitorAudioQuality,
} from "../utils/audioOptimization";
import { logger } from "../utils/logger";
import { captureException } from "../utils/sentry";

import musicWav from "../../assets/audio/music.wav";

let music: AudioPlayer | null = null;

let isInitialized = false;
let globalSoundEnabled = true;
let appState: AppStateStatus = AppState.currentState;
let appStateSubscription: { remove: () => void } | null = null;

interface FadeOptions {
  duration?: number;
  curve?: "linear" | "exponential";
  steps?: number;
}

const DEFAULT_FADE_OPTIONS: Required<FadeOptions> = {
  duration: 1000,
  curve: "linear",
  steps: 20,
};

const activeFades = new Set<AudioPlayer>();

const calculateFadeValue = (
  progress: number,
  curve: "linear" | "exponential"
): number => {
  if (curve === "exponential") return Math.pow(progress, 2);
  return progress;
};

const safeDelay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const SoundManager = {
  setSoundEnabled: (enabled: boolean) => {
    globalSoundEnabled = enabled;
    logger.debug(
      `SoundManager: Sound globally ${enabled ? "enabled" : "disabled"}`
    );
    if (!enabled) SoundManager.pauseAllMusic();
  },

  getSoundEnabled: (): boolean => globalSoundEnabled,

  init: async () => {
    try {
      logger.debug("SoundManager: Starting music system initialization...");

      const handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (nextAppState === appState) return;
        logger.debug("SoundManager: App state changed", appState, "to", nextAppState);
        appState = nextAppState;
        if (nextAppState === "background" || nextAppState === "inactive") {
          SoundManager.pauseCurrentMusic();
        } else if (nextAppState === "active" && isInitialized) {
          SoundManager.resumeCurrentMusic();
        }
      };

      // Remove any existing subscription before creating a new one to prevent leaks on re-init
      if (appStateSubscription) {
        appStateSubscription.remove();
        appStateSubscription = null;
      }
      appStateSubscription = AppState.addEventListener(
        "change",
        handleAppStateChange
      );

      await configureHighQualityAudioSession();

      const result = await createHighQualitySound(musicWav, {
        loop: true,
        volume: 1.0,
      });
      if (!result.sound) {
        throw new Error("Failed to create music player");
      }
      music = result.sound;
      monitorAudioQuality(music);

      logger.debug("SoundManager: Using config:", getOptimalAudioConfig());
      isInitialized = true;
      logger.debug("SoundManager: Initialization completed");
    } catch (error) {
      logger.error("Error loading music system:", error);
      captureException(error);
      await SoundManager.unload();
      isInitialized = false;
    }
  },

  // Kept for API compatibility — no-op with single track
  getCurrentMusicMode: () => "neutral" as const,
  setMusicMode: async (_mode: string, _options?: FadeOptions): Promise<void> => {},

  pauseCurrentMusic: async (): Promise<void> => {
    try {
      if (!isInitialized || !music) return;
      if (music.playing) music.pause();
    } catch (error) {
      logger.error("Error pausing music:", error);
      captureException(error);
    }
  },

  resumeCurrentMusic: async (): Promise<void> => {
    try {
      if (!isInitialized || !music || !globalSoundEnabled || appState !== "active") return;
      if (!music.playing) music.play();
    } catch (error) {
      logger.error("Error resuming music:", error);
      captureException(error);
    }
  },

  playBackgroundMusic: async () => SoundManager.resumeCurrentMusic(),
  pauseBackgroundMusic: async () => SoundManager.pauseCurrentMusic(),

  fadeInBackgroundMusic: async (options: FadeOptions = {}) => {
    if (!globalSoundEnabled || !music) return;
    await SoundManager.fadeIn(music, options);
  },

  fadeOutBackgroundMusic: async (options: FadeOptions = {}) => {
    if (!music) return;
    await SoundManager.fadeOut(music, options);
  },

  // Kept for API compatibility — no additional tracks to crossfade to
  playSuccess: async () => {},
  playNegative: async () => {},
  playNegativeWithFadeIn: async (_options: FadeOptions = {}) => {},

  fadeIn: async (
    sound: AudioPlayer,
    options: FadeOptions = {}
  ): Promise<void> => {
    const config = { ...DEFAULT_FADE_OPTIONS, ...options };
    if (activeFades.has(sound) || appState !== "active") return;

    try {
      activeFades.add(sound);
      if (!sound.isLoaded) return;

      if (!sound.playing) {
        sound.volume = 0;
        sound.play();
      }

      const stepDuration = config.duration / config.steps;
      for (let i = 0; i <= config.steps; i++) {
        if (!activeFades.has(sound)) break;
        const progress = i / config.steps;
        sound.volume = calculateFadeValue(progress, config.curve);
        if (i < config.steps) await safeDelay(stepDuration);
      }
    } catch (error) {
      logger.error("Error during fade in:", error);
      captureException(error);
    } finally {
      activeFades.delete(sound);
    }
  },

  fadeOut: async (
    sound: AudioPlayer,
    options: FadeOptions = {}
  ): Promise<void> => {
    const config = { ...DEFAULT_FADE_OPTIONS, ...options };
    if (activeFades.has(sound)) return;

    try {
      activeFades.add(sound);
      if (!sound.isLoaded || !sound.playing) return;

      const stepDuration = config.duration / config.steps;
      for (let i = config.steps; i >= 0; i--) {
        if (!activeFades.has(sound)) break;
        const progress = i / config.steps;
        sound.volume = calculateFadeValue(progress, config.curve);
        if (i > 0) await safeDelay(stepDuration);
      }
      sound.pause();
    } catch (error) {
      logger.error("Error during fade out:", error);
      captureException(error);
    } finally {
      activeFades.delete(sound);
    }
  },

  crossfade: async (
    _fromSound: AudioPlayer,
    _toSound: AudioPlayer,
    _options: FadeOptions = {}
  ): Promise<void> => {},

  cancelFade: (sound: AudioPlayer): void => {
    activeFades.delete(sound);
  },

  unload: async () => {
    try {
      activeFades.clear();
      if (appStateSubscription) {
        appStateSubscription.remove();
        appStateSubscription = null;
      }

      if (music) {
        try {
          await Promise.resolve(music.release());
        } catch (error) {
          logger.error("Error unloading music:", error);
          captureException(error);
        }
        music = null;
      }

      isInitialized = false;
      logger.info("SoundManager: Music unloaded");
    } catch (error) {
      logger.error("Error unloading music:", error);
      captureException(error);
    }
  },

  pauseAllMusic: async (): Promise<void> => {
    await SoundManager.pauseCurrentMusic();
  },
};
