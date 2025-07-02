import { Player } from "../../validation/firestoreSchemas";

/**
 * Interface for user data operations
 */
export interface IUserDataService {
  /**
   * Saves the user's progress to the data store
   */
  saveUserProgress(userId: string, progress: Player["progress"]): Promise<void>;

  /**
   * Loads user progress from the data store
   */
  loadUserProgress(userId: string): Promise<Player | null>;

  /**
   * Creates a new user document
   */
  createUserDocument(userId: string, userData: Player): Promise<void>;

  /**
   * Updates user document
   */
  updateUserDocument(userId: string, updates: Partial<Player>): Promise<void>;

  /**
   * Updates the classic index for a user
   */
  updateClassicIndex(userId: string, newIndex: number): Promise<void>;

  /**
   * Updates user coins
   */
  updateUserCoins(userId: string, newCoinAmount: number): Promise<void>;

  /**
   * Checks if a user exists
   */
  userExists(userId: string): Promise<boolean>;
}
