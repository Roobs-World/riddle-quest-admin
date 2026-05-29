import {Player} from "../../validation/firestoreSchemas";

/**
 * Port for user data persistence operations.
 */
export interface IUserDataService {
  saveUserProgress(userId: string, progress: Player["progress"]): Promise<void>;
  loadUserProgress(userId: string): Promise<Player | null>;
  createUserDocument(userId: string, userData: Player): Promise<void>;
  updateUserDocument(userId: string, updates: Partial<Player>): Promise<void>;
  updateClassicIndex(userId: string, newIndex: number): Promise<void>;
  updateUserCoins(userId: string, newCoinAmount: number): Promise<void>;
  userExists(userId: string): Promise<boolean>;
}
