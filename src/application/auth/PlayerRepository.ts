import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createUserDocumentInFirestore,
  loadUserProgressFromFirestore,
  updateClassicIndexInFirestore,
  updateUserDocumentInFirestore,
} from "../../services/FirestoreService";
import {Player} from "../../validation/firestoreSchemas";
import {createGuestPlayer} from "../../features/auth/sessionBootstrap";
import {logger} from "../../utils/logger";
import {captureException} from "../../utils/sentry";
import {buildFirestoreUserUpdates, GUEST_PROGRESS_STORAGE_KEY} from "./playerPersistence";

/**
 * Repository for player documents (Firestore + guest AsyncStorage).
 */
export class PlayerRepository {
  async loadGuestProfile(uid: string): Promise<Player | null> {
    try {
      const raw = await AsyncStorage.getItem(GUEST_PROGRESS_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<Player>;
      const guestBase = createGuestPlayer(uid);
      return {
        ...guestBase,
        coins: typeof parsed.coins === "number" ? parsed.coins : guestBase.coins,
        progress: {...guestBase.progress, ...(parsed.progress ?? {})},
        stats: {...guestBase.stats, ...(parsed.stats ?? {})},
        unlockedAchievements: Array.isArray(parsed.unlockedAchievements)
          ? parsed.unlockedAchievements
          : guestBase.unlockedAchievements,
        hasPurchasedApp:
          typeof parsed.hasPurchasedApp === "boolean" ? parsed.hasPurchasedApp : guestBase.hasPurchasedApp,
        avatarUrl: typeof parsed.avatarUrl === "string" ? parsed.avatarUrl : guestBase.avatarUrl,
        displayName: typeof parsed.displayName === "string" ? parsed.displayName : guestBase.displayName,
        lastDailyChallengeCompletedAt:
          typeof parsed.lastDailyChallengeCompletedAt === "number" ? parsed.lastDailyChallengeCompletedAt : undefined,
      };
    } catch (error) {
      logger.error("Error loading guest progress locally:", error);
      captureException(error);
      return null;
    }
  }

  async saveGuestProfile(player: Player): Promise<void> {
    try {
      await AsyncStorage.setItem(GUEST_PROGRESS_STORAGE_KEY, JSON.stringify(player));
    } catch (error) {
      logger.error("Error saving guest progress locally:", error);
      captureException(error);
    }
  }

  async clearGuestProfile(): Promise<void> {
    try {
      await AsyncStorage.removeItem(GUEST_PROGRESS_STORAGE_KEY);
    } catch (error) {
      logger.warn("Error clearing guest progress locally:", error);
      captureException(error);
    }
  }

  async clearAllLocalData(): Promise<void> {
    try {
      await AsyncStorage.clear();
      logger.debug("Cleared all local app data.");
    } catch (error) {
      logger.warn("Error clearing local app data:", error);
      captureException(error);
    }
  }

  loadUserProgress(userId: string): Promise<Player | null> {
    return loadUserProgressFromFirestore(userId);
  }

  createUserDocument(
    userId: string,
    email: string,
    displayName?: string,
    avatarUrl?: string | null,
    guestSeed?: Player,
  ): Promise<Player> {
    return createUserDocumentInFirestore(userId, email, displayName, avatarUrl ?? undefined, guestSeed);
  }

  async updateUserDocument(userId: string, basePlayer: Player, updates: Partial<Player>): Promise<void> {
    const safeUpdates = buildFirestoreUserUpdates(basePlayer, updates);
    await updateUserDocumentInFirestore(userId, safeUpdates);
  }

  updateClassicIndex(userId: string, newIndex: number): Promise<void> {
    return updateClassicIndexInFirestore(userId, newIndex);
  }
}

export const playerRepository = new PlayerRepository();
