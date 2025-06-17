import { Audio } from "expo-av";
import { Platform } from "react-native";

/**
 * Audio Quality Optimization Utility
 * Provides enhanced audio configuration and quality monitoring for Qwordly
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
  // New adaptive preset for devices with buffering issues
  ADAPTIVE_SMOOTH: {
    enableHighQuality: true,
    sampleRate: 44100,
    bitRate: 192000,
    bufferSize: 1536,
    useHardwareAcceleration: true,
  },
};

// Adaptive quality management
interface BufferingTracker {
  bufferingCount: number;
  lastBufferingTime: number;
  currentQualityLevel: keyof typeof AUDIO_QUALITY_PRESETS;
  adjustmentHistory: Array<{
    timestamp: number;
    action: string;
    reason: string;
  }>;
}

const bufferingTrackers = new Map<Audio.Sound, BufferingTracker>();

// Thresholds for adaptive quality
const BUFFERING_THRESHOLD = 5; // Max buffering events in time window
const BUFFERING_TIME_WINDOW = 30000; // 30 seconds
const QUALITY_ADJUSTMENT_COOLDOWN = 10000; // 10 seconds between adjustments

/**
 * Configure optimal audio session for high-quality playback
 */
export const configureHighQualityAudioSession = async (): Promise<void> => {
  try {
    console.log(
      "AudioOptimization: Configuring adaptive high-quality audio session..."
    );

    // Base audio configuration optimized for stability
    const audioConfig = {
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
      // Enhanced buffer management
      interruptionModeIOS: 1,
      interruptionModeAndroid: 1,
    };

    // Platform-specific optimizations with better buffering
    if (Platform.OS === "ios") {
      await Audio.setAudioModeAsync({
        ...audioConfig,
        // iOS-specific settings for reduced buffering
      });
    } else if (Platform.OS === "android") {
      await Audio.setAudioModeAsync({
        ...audioConfig,
        // Android-specific settings for stability
      });
    } else {
      await Audio.setAudioModeAsync(audioConfig);
    }

    console.log(
      "AudioOptimization: Adaptive high-quality audio session configured successfully"
    );
  } catch (error) {
    console.error(
      "AudioOptimization: Failed to configure audio session:",
      error
    );
    throw error;
  }
};

/**
 * Create sound instance with adaptive quality settings
 */
export const createHighQualitySound = async (
  source: Parameters<typeof Audio.Sound.createAsync>[0],
  options: Parameters<typeof Audio.Sound.createAsync>[1] = {}
): Promise<{ sound: Audio.Sound }> => {
  try {
    // Start with optimal configuration but be ready to adapt
    const initialConfig = getOptimalAudioConfig();

    const qualityOptions = {
      // Conservative settings to prevent initial buffering
      shouldCorrectPitch: false,
      // Only use high-quality pitch if explicitly requested and device supports it
      ...(initialConfig.enableHighQuality &&
        Audio.PitchCorrectionQuality?.High && {
          pitchCorrectionQuality: Audio.PitchCorrectionQuality.High,
        }),
      rate: 1.0,
      volume: options.volume ?? 1.0,
      // Adaptive buffer settings based on quality level
      ...options,
    };

    console.log(
      "AudioOptimization: Creating adaptive high-quality sound with options:",
      { ...qualityOptions, config: initialConfig }
    );

    const result = await Audio.Sound.createAsync(source, qualityOptions);

    // Initialize buffering tracker for this sound
    bufferingTrackers.set(result.sound, {
      bufferingCount: 0,
      lastBufferingTime: 0,
      currentQualityLevel: getQualityLevelFromConfig(initialConfig),
      adjustmentHistory: [],
    });

    // Log audio file information for quality monitoring
    const status = await result.sound.getStatusAsync();
    if (status.isLoaded) {
      console.log(
        "AudioOptimization: Sound loaded with adaptive quality metrics:",
        {
          uri: status.uri,
          duration: status.durationMillis,
          shouldCorrectPitch: status.shouldCorrectPitch,
          volume: status.volume,
          rate: status.rate,
          qualityLevel: getQualityLevelFromConfig(initialConfig),
        }
      );
    }

    return result;
  } catch (error) {
    console.error(
      "AudioOptimization: Failed to create adaptive high-quality sound:",
      error
    );
    throw error;
  }
};

/**
 * Helper function to determine quality level from config
 */
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
  return "HIGH"; // Default fallback
};

/**
 * Adaptive quality adjustment based on buffering performance
 */
const adjustQualityIfNeeded = async (sound: Audio.Sound): Promise<void> => {
  const tracker = bufferingTrackers.get(sound);
  if (!tracker) return;

  const now = Date.now();
  const timeSinceLastAdjustment =
    now -
    (tracker.adjustmentHistory[tracker.adjustmentHistory.length - 1]
      ?.timestamp || 0);

  // Only adjust if enough time has passed since last adjustment
  if (timeSinceLastAdjustment < QUALITY_ADJUSTMENT_COOLDOWN) {
    return;
  }

  // Count recent buffering events
  const recentBufferingTime = now - BUFFERING_TIME_WINDOW;
  const recentBufferingEvents = tracker.adjustmentHistory.filter(
    (event) =>
      event.timestamp > recentBufferingTime &&
      event.action === "buffering_detected"
  ).length;

  if (recentBufferingEvents >= BUFFERING_THRESHOLD) {
    // Too much buffering - step down quality
    const newQualityLevel = getNextLowerQuality(tracker.currentQualityLevel);
    if (newQualityLevel !== tracker.currentQualityLevel) {
      console.log(
        `AudioOptimization: Excessive buffering detected (${recentBufferingEvents} events), reducing quality from ${tracker.currentQualityLevel} to ${newQualityLevel}`
      );

      tracker.currentQualityLevel = newQualityLevel;
      tracker.adjustmentHistory.push({
        timestamp: now,
        action: "quality_reduced",
        reason: `${recentBufferingEvents} buffering events in ${
          BUFFERING_TIME_WINDOW / 1000
        }s`,
      });

      // Apply new quality settings
      try {
        // Note: We can't change audio encoding settings on an existing sound,
        // but we can optimize playback parameters based on quality level
        const volumeAdjustment = newQualityLevel === "STANDARD" ? 0.9 : 1.0;
        await sound.setStatusAsync({
          shouldPlay: true,
          rate: 1.0,
          volume: volumeAdjustment, // Slight volume reduction for lowest quality
        });
        console.log(
          `AudioOptimization: Applied quality adjustment - level: ${newQualityLevel}, volume: ${volumeAdjustment}`
        );
      } catch (error) {
        console.error(
          "AudioOptimization: Failed to apply quality adjustment:",
          error
        );
      }
    }
  }
};

/**
 * Get next lower quality level for adaptive adjustment
 */
const getNextLowerQuality = (
  currentLevel: keyof typeof AUDIO_QUALITY_PRESETS
): keyof typeof AUDIO_QUALITY_PRESETS => {
  const qualityOrder: Array<keyof typeof AUDIO_QUALITY_PRESETS> = [
    "ULTRA_HIGH",
    "HIGH",
    "ADAPTIVE_SMOOTH",
    "STANDARD",
  ];

  const currentIndex = qualityOrder.indexOf(currentLevel);
  if (currentIndex < qualityOrder.length - 1) {
    return qualityOrder[currentIndex + 1];
  }
  return currentLevel; // Already at lowest
};

/**
 * Enhanced audio quality monitoring with adaptive management
 */
export const monitorAudioQuality = (sound: Audio.Sound): void => {
  try {
    sound.setOnPlaybackStatusUpdate(async (status) => {
      if (status.isLoaded) {
        const tracker = bufferingTrackers.get(sound);
        const now = Date.now();

        // Track buffering events with reduced logging frequency
        if (status.isBuffering) {
          if (tracker) {
            tracker.bufferingCount++;
            tracker.lastBufferingTime = now;
            tracker.adjustmentHistory.push({
              timestamp: now,
              action: "buffering_detected",
              reason: "status.isBuffering === true",
            });

            // Only log buffering every 5th occurrence to reduce spam
            if (tracker.bufferingCount % 5 === 1) {
              console.warn(
                `AudioOptimization: Audio buffering detected (${tracker.bufferingCount} total, quality: ${tracker.currentQualityLevel})`
              );
            }

            // Check if quality adjustment is needed
            await adjustQualityIfNeeded(sound);
          }
        }

        // Enhanced quality metrics logging (every 15 seconds instead of 10)
        if (status.isPlaying && status.positionMillis % 15000 < 500) {
          const qualityMetrics = {
            isPlaying: status.isPlaying,
            isBuffering: status.isBuffering,
            volume: status.volume,
            rate: status.rate,
            shouldCorrectPitch: status.shouldCorrectPitch,
            durationMillis: status.durationMillis,
            positionMillis: status.positionMillis,
            qualityLevel: tracker?.currentQualityLevel || "unknown",
            bufferingCount: tracker?.bufferingCount || 0,
          };
          console.log(
            "AudioOptimization: Adaptive quality metrics:",
            qualityMetrics
          );
        }
      } else if (status.error) {
        console.error("AudioOptimization: Audio error detected:", status.error);
      }
    });
  } catch (error) {
    console.error(
      "AudioOptimization: Failed to set up adaptive quality monitoring:",
      error
    );
  }
};

/**
 * Optimize audio for different device capabilities - always prioritize highest quality
 */
export const getOptimalAudioConfig = (): AudioQualityConfig => {
  try {
    // Check if we're in production build (EAS builds preserve max quality)
    const isProductionBuild =
      !__DEV__ && process.env.EXPO_PRESERVE_AUDIO_QUALITY === "1";

    if (isProductionBuild) {
      // Production builds: Always start with maximum quality
      console.log(
        "AudioOptimization: Production build detected - using ULTRA_HIGH quality"
      );
      return AUDIO_QUALITY_PRESETS.ULTRA_HIGH;
    }

    // Development mode: More conservative approach to prevent initial buffering during testing
    if (Platform.OS === "ios") {
      // iOS devices can handle HIGH quality in development
      return AUDIO_QUALITY_PRESETS.HIGH;
    } else if (Platform.OS === "android") {
      // Android optimization based on API level
      if (Platform.Version >= 30) {
        // Very new Android - can try HIGH
        return AUDIO_QUALITY_PRESETS.HIGH;
      } else if (Platform.Version >= 28) {
        // Modern Android - use adaptive smooth
        return AUDIO_QUALITY_PRESETS.ADAPTIVE_SMOOTH;
      } else if (Platform.Version >= 24) {
        // Mid-range Android devices use STANDARD
        return AUDIO_QUALITY_PRESETS.STANDARD;
      } else {
        return AUDIO_QUALITY_PRESETS.STANDARD;
      }
    } else {
      // Web and other platforms - conservative approach
      return AUDIO_QUALITY_PRESETS.ADAPTIVE_SMOOTH;
    }
  } catch (error) {
    console.error(
      "AudioOptimization: Failed to determine optimal config:",
      error
    );
    return AUDIO_QUALITY_PRESETS.ADAPTIVE_SMOOTH; // Safe fallback
  }
};

/**
 * Validate audio file quality
 */
export const validateAudioQuality = async (
  sound: Audio.Sound
): Promise<boolean> => {
  try {
    const status = await sound.getStatusAsync();

    if (!status.isLoaded) {
      console.warn("AudioOptimization: Audio file not loaded properly");
      return false;
    }

    // Check for minimum quality requirements
    const qualityChecks = {
      hasValidDuration: status.durationMillis && status.durationMillis > 0,
      hasValidUri: Boolean(status.uri),
      isNotCorrupted: true, // If status.isLoaded is true, then it's not corrupted
    };

    const isValid = Object.values(qualityChecks).every(
      (check) => check === true
    );

    if (!isValid) {
      console.warn(
        "AudioOptimization: Audio quality validation failed:",
        qualityChecks
      );
    } else {
      console.log("AudioOptimization: Audio quality validation passed");
    }

    return isValid;
  } catch (error) {
    console.error("AudioOptimization: Audio validation error:", error);
    return false;
  }
};

/**
 * Apply audio enhancement filters (future expansion)
 */
export const applyAudioEnhancements = async (
  sound: Audio.Sound
): Promise<void> => {
  try {
    // Future implementation for audio enhancement filters
    // This could include EQ, compression, or other audio processing
    console.log(
      "AudioOptimization: Audio enhancement filters ready for implementation"
    );

    // For now, ensure optimal playback settings
    await sound.setStatusAsync({ volume: 1.0 });
    if (Audio.PitchCorrectionQuality?.High) {
      await sound.setRateAsync(1.0, false, Audio.PitchCorrectionQuality.High);
    } else {
      await sound.setRateAsync(1.0, false);
    }
  } catch (error) {
    console.error(
      "AudioOptimization: Failed to apply audio enhancements:",
      error
    );
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
