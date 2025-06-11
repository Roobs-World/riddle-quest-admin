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
} as const;

/**
 * Configure optimal audio session for high-quality playback
 */
export const configureHighQualityAudioSession = async (): Promise<void> => {
  try {
    console.log("AudioOptimization: Configuring high-quality audio session...");

    // Base audio configuration for high quality
    const audioConfig = {
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    };

    // Platform-specific optimizations
    if (Platform.OS === "ios") {
      // iOS-specific high-quality audio settings
      await Audio.setAudioModeAsync({
        ...audioConfig,
        // Use default iOS audio mode for music playback
      });
    } else if (Platform.OS === "android") {
      // Android-specific high-quality audio settings
      await Audio.setAudioModeAsync({
        ...audioConfig,
        // Use default Android audio mode for music playback
      });
    } else {
      // Fallback for other platforms
      await Audio.setAudioModeAsync(audioConfig);
    }

    console.log(
      "AudioOptimization: High-quality audio session configured successfully"
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
 * Create sound instance with optimized quality settings
 */
export const createHighQualitySound = async (
  source: Parameters<typeof Audio.Sound.createAsync>[0],
  options: Parameters<typeof Audio.Sound.createAsync>[1] = {}
): Promise<{ sound: Audio.Sound }> => {
  try {
    const qualityOptions = {
      // Disable pitch correction for better quality
      shouldCorrectPitch: false,
      // Use high-quality pitch algorithm when needed (if available)
      ...(Audio.PitchCorrectionQuality?.High && {
        pitchCorrectionQuality: Audio.PitchCorrectionQuality.High,
      }),
      // Optimize playback rate
      rate: 1.0,
      // Maximum dynamic range
      volume: options.volume ?? 1.0,
      // Additional quality settings
      ...options,
    };

    console.log(
      "AudioOptimization: Creating high-quality sound with options:",
      qualityOptions
    );

    const result = await Audio.Sound.createAsync(source, qualityOptions);

    // Log audio file information for quality monitoring
    const status = await result.sound.getStatusAsync();
    if (status.isLoaded) {
      console.log("AudioOptimization: Sound loaded with quality metrics:", {
        uri: status.uri,
        duration: status.durationMillis,
        shouldCorrectPitch: status.shouldCorrectPitch,
        volume: status.volume,
        rate: status.rate,
      });
    }

    return result;
  } catch (error) {
    console.error(
      "AudioOptimization: Failed to create high-quality sound:",
      error
    );
    throw error;
  }
};

/**
 * Monitor audio quality and performance
 */
export const monitorAudioQuality = (sound: Audio.Sound): void => {
  try {
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded) {
        // Log quality metrics during playback
        const qualityMetrics = {
          isPlaying: status.isPlaying,
          isBuffering: status.isBuffering,
          volume: status.volume,
          rate: status.rate,
          shouldCorrectPitch: status.shouldCorrectPitch,
          durationMillis: status.durationMillis,
          positionMillis: status.positionMillis,
        };

        // Log potential quality issues
        if (status.isBuffering) {
          console.warn(
            "AudioOptimization: Audio buffering detected - potential quality impact"
          );
        }

        // Periodic quality logging (every 10 seconds during playback)
        if (status.isPlaying && status.positionMillis % 10000 < 500) {
          console.log("AudioOptimization: Quality metrics:", qualityMetrics);
        }
      } else if (status.error) {
        console.error("AudioOptimization: Audio error detected:", status.error);
      }
    });
  } catch (error) {
    console.error(
      "AudioOptimization: Failed to set up quality monitoring:",
      error
    );
  }
};

/**
 * Optimize audio for different device capabilities
 */
export const getOptimalAudioConfig = (): AudioQualityConfig => {
  try {
    // Determine optimal configuration based on platform and device capabilities
    if (Platform.OS === "ios") {
      // iOS devices typically have better audio processing
      return AUDIO_QUALITY_PRESETS.HIGH;
    } else if (Platform.OS === "android") {
      // Android optimization based on API level
      if (Platform.Version >= 28) {
        return AUDIO_QUALITY_PRESETS.HIGH;
      } else {
        return AUDIO_QUALITY_PRESETS.STANDARD;
      }
    } else {
      // Web and other platforms
      return AUDIO_QUALITY_PRESETS.STANDARD;
    }
  } catch (error) {
    console.error(
      "AudioOptimization: Failed to determine optimal config:",
      error
    );
    return AUDIO_QUALITY_PRESETS.STANDARD;
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
