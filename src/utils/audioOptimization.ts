import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioSource,
} from "expo-audio";
import { Platform } from "react-native";
import { logger } from "./logger";
import { captureException } from "./sentry";

/**
 * Audio Quality Optimization Utility
 * Provides enhanced audio configuration for Qwordly (expo-audio / SDK 55)
 */

export interface AudioQualityConfig {
  enableHighQuality: boolean;
  sampleRate: number;
  bitRate: number;
  bufferSize: number;
  useHardwareAcceleration: boolean;
}

// Enhanced presets with adaptive configurations
export const AUDIO_QUALITY_PRESETS = {
  ULTRA_HIGH: {
    enableHighQuality: true,
    sampleRate: 48000,
    bitRate: 320000,
    bufferSize: 4096,
    useHardwareAcceleration: true,
  },
  HIGH: {
    enableHighQuality: true,
    sampleRate: 44100,
    bitRate: 256000,
    bufferSize: 2048,
    useHardwareAcceleration: true,
  },
  STANDARD: {
    enableHighQuality: false,
    sampleRate: 44100,
    bitRate: 128000,
    bufferSize: 1024,
    useHardwareAcceleration: false,
  },
  ADAPTIVE_SMOOTH: {
    enableHighQuality: true,
    sampleRate: 44100,
    bitRate: 192000,
    bufferSize: 1536,
    useHardwareAcceleration: true,
  },
};

/**
 * Configure optimal audio session for high-quality playback
 */
export const configureHighQualityAudioSession = async (): Promise<void> => {
  try {
    logger.debug(
      "AudioOptimization: Configuring high-quality audio session..."
    );

    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: "doNotMix",
    });

    logger.debug(
      "AudioOptimization: High-quality audio session configured successfully"
    );
  } catch (error) {
    logger.error(
      "AudioOptimization: Failed to configure audio session:",
      error
    );
    captureException(error);
    throw error;
  }
};

/**
 * Create sound instance with expo-audio (replaces expo-av createAsync)
 */
export const createHighQualitySound = async (
  source: AudioSource,
  options: { loop?: boolean; volume?: number } = {}
): Promise<{ sound: AudioPlayer }> => {
  try {
    const initialConfig = getOptimalAudioConfig();

    const player = createAudioPlayer(source);
    player.loop = options.loop ?? false;
    player.volume = options.volume ?? 1.0;

    logger.debug(
      "AudioOptimization: Created audio player with config:",
      { ...options, qualityLevel: getQualityLevelFromConfig(initialConfig) }
    );

    return { sound: player };
  } catch (error) {
    logger.error(
      "AudioOptimization: Failed to create audio player:",
      error
    );
    captureException(error);
    throw error;
  }
};

const getQualityLevelFromConfig = (
  config: AudioQualityConfig
): keyof typeof AUDIO_QUALITY_PRESETS => {
  const presets = Object.entries(AUDIO_QUALITY_PRESETS);
  for (const [key, preset] of presets) {
    if (
      preset.sampleRate === config.sampleRate &&
      preset.bitRate === config.bitRate &&
      preset.bufferSize === config.bufferSize
    ) {
      return key as keyof typeof AUDIO_QUALITY_PRESETS;
    }
  }
  return "HIGH";
};

/**
 * Monitor audio quality (simplified for expo-audio - no-op for compatibility)
 * expo-audio handles buffering internally; player.isBuffering available if needed
 */
export const monitorAudioQuality = (
  _sound: AudioPlayer // eslint-disable-line @typescript-eslint/no-unused-vars -- API compatibility
): void => {
  // No-op: expo-audio manages quality internally
  // SoundManager compatibility - previously set status callbacks
};

/**
 * Optimize audio for different device capabilities
 */
export const getOptimalAudioConfig = (): AudioQualityConfig => {
  try {
    const isProductionBuild =
      !__DEV__ && process.env.EXPO_PRESERVE_AUDIO_QUALITY === "1";

    if (isProductionBuild) {
      logger.debug(
        "AudioOptimization: Production build - using ULTRA_HIGH quality"
      );
      return AUDIO_QUALITY_PRESETS.ULTRA_HIGH;
    }

    if (Platform.OS === "ios") {
      return AUDIO_QUALITY_PRESETS.HIGH;
    } else if (Platform.OS === "android") {
      if (Platform.Version >= 30) {
        return AUDIO_QUALITY_PRESETS.HIGH;
      } else if (Platform.Version >= 28) {
        return AUDIO_QUALITY_PRESETS.ADAPTIVE_SMOOTH;
      } else {
        return AUDIO_QUALITY_PRESETS.STANDARD;
      }
    } else {
      return AUDIO_QUALITY_PRESETS.ADAPTIVE_SMOOTH;
    }
  } catch (error) {
    logger.error(
      "AudioOptimization: Failed to determine optimal config:",
      error
    );
    captureException(error);
    return AUDIO_QUALITY_PRESETS.ADAPTIVE_SMOOTH;
  }
};

/**
 * Validate audio file quality
 */
export const validateAudioQuality = async (
  sound: AudioPlayer
): Promise<boolean> => {
  try {
    if (!sound.isLoaded) {
      logger.warn("AudioOptimization: Audio not loaded properly");
      return false;
    }

    const qualityChecks = {
      hasValidDuration: sound.duration > 0,
      isLoaded: sound.isLoaded,
    };

    const isValid = Object.values(qualityChecks).every((check) => check === true);

    if (!isValid) {
      logger.warn(
        "AudioOptimization: Audio quality validation failed:",
        qualityChecks
      );
    } else {
      logger.debug("AudioOptimization: Audio quality validation passed");
    }

    return isValid;
  } catch (error) {
    logger.error("AudioOptimization: Audio validation error:", error);
    captureException(error);
    return false;
  }
};

/**
 * Apply audio enhancement filters (simplified for expo-audio)
 */
export const applyAudioEnhancements = async (
  sound: AudioPlayer
): Promise<void> => {
  try {
    sound.volume = 1.0;
    sound.playbackRate = 1.0;
  } catch (error) {
    logger.error(
      "AudioOptimization: Failed to apply audio enhancements:",
      error
    );
    captureException(error);
  }
};

export default {
  configureHighQualityAudioSession,
  createHighQualitySound,
  monitorAudioQuality,
  getOptimalAudioConfig,
  validateAudioQuality,
  applyAudioEnhancements,
  AUDIO_QUALITY_PRESETS,
};

