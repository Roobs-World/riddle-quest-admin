import {FirestoreRiddle} from "../../validation/firestoreSchemas";

/**
 * Port for riddle data access.
 */
export interface IRiddleDataService {
  fetchDailyRiddle(): Promise<FirestoreRiddle | null>;
  fetchClassicRiddle(level: number): Promise<FirestoreRiddle | null>;
  fetchRiddleById(riddleId: string): Promise<FirestoreRiddle | null>;
  getClassicRiddleCount(): Promise<number>;
}
