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
 * Repository for player persistence across Firestore and guest local storage.
 *
 * @remarks
 * Pattern: Repository + Adapter. The repository hides the split persistence
 * strategy used by guest accounts and provider-auth accounts while preserving a
 * single API for loading, saving, and clearing player records.
 *
 * Boundary: auth application layer. It may use AsyncStorage and Firestore
 * service helpers, but callers should not care which backend stores the data.
 *
 * Invariants:
 * - Guest snapshots are merged onto a fresh guest baseline before use.
 * - Firestore writes are sanitized before they cross the persistence boundary.
 * - Clearing local data is best-effort and never throws into UI code.
 */
class PlayerRepository {
  /**
   * Loads the guest profile snapshot from local storage and merges it with a fresh guest baseline.
   *
   * @param uid - Guest user identifier used to seed the baseline document.
   * @returns The merged guest profile, or `null` when no guest snapshot exists.
   */
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
        preferredLanguage:
          typeof parsed.preferredLanguage === "string" ? parsed.preferredLanguage : guestBase.preferredLanguage,
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

  /**
   * Persists the guest player snapshot to local storage.
   *
   * @param player - Guest player document to save locally.
   */
  async saveGuestProfile(player: Player): Promise<void> {
    try {
      await AsyncStorage.setItem(GUEST_PROGRESS_STORAGE_KEY, JSON.stringify(player));
    } catch (error) {
      logger.error("Error saving guest progress locally:", error);
      captureException(error);
    }
  }

  /**
   * Removes the guest player snapshot from local storage.
   */
  async clearGuestProfile(): Promise<void> {
    try {
      await AsyncStorage.removeItem(GUEST_PROGRESS_STORAGE_KEY);
    } catch (error) {
      logger.warn("Error clearing guest progress locally:", error);
      captureException(error);
    }
  }

  /**
   * Clears all local persistence used by the app.
   */
  async clearAllLocalData(): Promise<void> {
    try {
      await AsyncStorage.clear();
      logger.debug("Cleared all local app data.");
    } catch (error) {
      logger.warn("Error clearing local app data:", error);
      captureException(error);
    }
  }

  /**
   * Loads the canonical player document from Firestore.
   *
   * @param userId - Authenticated user identifier.
   * @returns The stored player document, or `null` when no record exists.
   */
  loadUserProgress(userId: string): Promise<Player | null> {
    return loadUserProgressFromFirestore(userId);
  }

  /**
   * Creates the canonical user document in Firestore.
   *
   * @param userId - Authenticated user identifier.
   * @param email - Email address used by the backend.
   * @param displayName - Optional display name from the auth provider.
   * @param avatarUrl - Optional avatar URL from the auth provider.
   * @param guestSeed - Optional guest profile used to seed the new account.
   * @returns The created player document.
   */
  createUserDocument(
    userId: string,
    email: string,
    displayName?: string,
    avatarUrl?: string | null,
    guestSeed?: Player,
  ): Promise<Player> {
    return createUserDocumentInFirestore(userId, email, displayName, avatarUrl ?? undefined, guestSeed);
  }

  /**
   * Applies a sanitized partial update to the canonical Firestore player document.
   *
   * @param userId - Authenticated user identifier.
   * @param basePlayer - Current player document used to validate updates.
   * @param updates - Partial player payload to sanitize and persist.
   */
  async updateUserDocument(userId: string, basePlayer: Player, updates: Partial<Player>): Promise<void> {
    const safeUpdates = buildFirestoreUserUpdates(basePlayer, updates);
    await updateUserDocumentInFirestore(userId, safeUpdates);
  }

  /**
   * Updates only the player's classic progress index in Firestore.
   *
   * @param userId - Authenticated user identifier.
   * @param newIndex - New classic-riddle index to persist.
   */
  updateClassicIndex(userId: string, newIndex: number): Promise<void> {
    return updateClassicIndexInFirestore(userId, newIndex);
  }
}

export const playerRepository = new PlayerRepository();
