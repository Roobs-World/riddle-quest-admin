import AsyncStorage from "@react-native-async-storage/async-storage";
import { Player } from "../types/Player";
/**
 * The AsyncStorage key used to store the player's progress data.
 */
const PROGRESS_STORAGE_KEY = "@player_progress";

/**
 * Saves the player's progress data to AsyncStorage.
 * @param {PlayerProgress} progress - The player progress object to save.
 * @returns {Promise<void>} A promise that resolves when the progress is successfully saved.
 */
export const saveProgress = async (progress: Player): Promise<void> => {
  try {
    const jsonValue = JSON.stringify(progress);
    await AsyncStorage.setItem(PROGRESS_STORAGE_KEY, jsonValue);
  } catch (e) {
    console.error("Failed to save progress to AsyncStorage:", e);
  }
};

/**
 * Loads the player's progress data from AsyncStorage.
 * @returns {Promise<PlayerProgress | null>} A promise resolving to the loaded player progress object, or null if no data is found or an error occurs.
 */
export const loadProgress = async (): Promise<Player | null> => {
  try {
    const jsonValue = await AsyncStorage.getItem(PROGRESS_STORAGE_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error("Failed to load progress from AsyncStorage:", e);
    return null;
  }
};

/**
 * Clears the player's progress data from AsyncStorage.
 * @returns {Promise<void>} A promise that resolves when the progress is successfully cleared.
 */
export const clearProgress = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(PROGRESS_STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clear progress from AsyncStorage:", e);
  }
};
