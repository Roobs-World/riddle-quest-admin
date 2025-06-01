import { FirestoreRiddle } from "../../validation/firestoreSchemas";

/**
 * Interface for riddle data operations
 */
export interface IRiddleDataService {
  /**
   * Fetches the current daily riddle
   */
  fetchDailyRiddle(): Promise<FirestoreRiddle | null>;

  /**
   * Fetches a specific classic mode riddle by its level
   */
  fetchClassicRiddle(level: number): Promise<FirestoreRiddle | null>;

  /**
   * Fetches a specific tutorial mode riddle by its level
   */
  fetchTutorialRiddle(level: number): Promise<FirestoreRiddle | null>;

  /**
   * Fetches a riddle by its ID
   */
  fetchRiddleById(riddleId: string): Promise<FirestoreRiddle | null>;

  /**
   * Gets the count of available classic riddles
   */
  getClassicRiddleCount(): Promise<number>;

  /**
   * Gets the count of available tutorial riddles
   */
  getTutorialRiddleCount(): Promise<number>;
}
