import { FirestoreRiddle } from "../../validation/firestoreSchemas";

/**
 * Interface for riddle data operations
 */
export interface IRiddleDataService {
  /**
   * Fetches the current daily riddle.
   *
   * @returns Daily riddle document or `null` when unavailable.
   */
  fetchDailyRiddle(): Promise<FirestoreRiddle | null>;

  /**
   * Fetches a specific classic mode riddle by its level.
   *
   * @param level One-based classic level index.
   * @returns Classic riddle document or `null` when no match exists.
   */
  fetchClassicRiddle(level: number): Promise<FirestoreRiddle | null>;

  /**
   * Fetches a specific tutorial mode riddle by its level.
   *
   * @param level One-based tutorial level index.
   * @returns Tutorial riddle document or `null` when no match exists.
   */
  fetchTutorialRiddle(level: number): Promise<FirestoreRiddle | null>;

  /**
   * Fetches a riddle by its document ID.
   *
   * @param riddleId Firestore riddle document id.
   * @returns Riddle document or `null` when not found.
   */
  fetchRiddleById(riddleId: string): Promise<FirestoreRiddle | null>;

  /**
   * Counts available classic riddles.
   *
   * @returns Number of classic riddles.
   */
  getClassicRiddleCount(): Promise<number>;

  /**
   * Counts available tutorial riddles.
   *
   * @returns Number of tutorial riddles.
   */
  getTutorialRiddleCount(): Promise<number>;
}
