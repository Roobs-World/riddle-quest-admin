/* istanbul ignore file */
/**
 * @fileoverview
 * Authentication and player session context for Qwordly.
 *
 * This provider wraps the navigation tree and exposes a unified view of the
 * authenticated user, their progress, the currently active riddle, and the
 * selected game mode. It is also responsible for coordinating with Firestore
 * and Firebase Auth to initialize user documents and riddle data.
 *
 * All game screens and hooks that need authenticated player data should access
 * it through this context via the `useAuth` hook rather than talking to
 * Firebase directly.
 */
import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  useMemo,
  useRef,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  loadUserProgressFromFirestore,
  fetchDailyRiddleFromFirestore,
  fetchClassicRiddleFromFirestore,
  updateClassicIndexInFirestore,
  updateUserDocumentInFirestore,
  createUserDocumentInFirestore,
} from "../services/FirestoreService";
import { Player, FirestoreRiddle } from "../validation/firestoreSchemas";
import { getAuth, signOut } from "@react-native-firebase/auth";
import { getApp } from "@react-native-firebase/app";
import { getFunctions, httpsCallable } from "@react-native-firebase/functions";
import { RiddleInitializationService } from "../services/RiddleInitializationService";
import { logger } from "../utils/logger";
import { captureException, setUser as sentrySetUser, clearUser as sentryClearUser, addBreadcrumb } from "../utils/sentry";
import { analyticsService } from "../services/AnalyticsService";
import { offlineQueue } from "../services/OfflineQueueService";
import {
  createGuestPlayer,
  resolveInitialGameMode,
  resolveProviderAvatarUrl,
  resolveUserEmail,
} from "../features/auth/sessionBootstrap";
import { isGuestPlayer } from "../features/auth/sessionBootstrap";

const GUEST_PROGRESS_STORAGE_KEY = "@guest_player_progress_v1";

export type GameMode = "daily" | "classic" | "challenge";

/**
 * Shape of the value exposed by `AuthContext` and returned from `useAuth`.
 */
interface AuthContextType {
  isAuthenticated: boolean;
  playerData: Player | null;
  isLoading: boolean;
  isRiddlesInitializing: boolean; // Add this to track riddle initialization
  currentRiddle: FirestoreRiddle | null; // Use a single state for the current riddle regardless of mode
  isDailyChallengeAvailable: boolean | undefined;
  gameMode: GameMode; // Add state for current game mode
  setGameMode: (mode: GameMode) => void; // Add function to change game mode
  pendingStreakBreak: { previousStreak: number } | null;
  consumePendingStreakBreak: () => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  // Removed updatePlayerCoins as coin updates are now handled by backend functions
  // updatePlayerCoins: (newCoins: number) => Promise<void>;
  updatePlayerClassicIndex: (newIndex: number) => Promise<void>;
  updatePlayerData: (updates: Partial<Player>) => Promise<void>;
  updatePlayerDataLocally: (updates: Partial<Player>) => void;
  // Add setCurrentRiddle to the interface
  setCurrentRiddle: React.Dispatch<
    React.SetStateAction<FirestoreRiddle | null>
  >; // Expose the state setter
  fetchCurrentRiddle: (player: Player | null, mode: GameMode) => Promise<void>; // Expose fetchCurrentRiddle
}

type AuthSessionContextType = Pick<
  AuthContextType,
  "isAuthenticated" | "isLoading" | "login" | "logout"
>;
type PlayerContextType = Pick<
  AuthContextType,
  | "playerData"
  | "updatePlayerClassicIndex"
  | "updatePlayerData"
  | "updatePlayerDataLocally"
  | "pendingStreakBreak"
  | "consumePendingStreakBreak"
>;
type RiddleContextType = Pick<
  AuthContextType,
  | "currentRiddle"
  | "setCurrentRiddle"
  | "fetchCurrentRiddle"
  | "isDailyChallengeAvailable"
  | "gameMode"
  | "setGameMode"
  | "isRiddlesInitializing"
>;

// Legacy merged context for compatibility.
const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AuthSessionContext = createContext<AuthSessionContextType | undefined>(
  undefined
);
const PlayerContext = createContext<PlayerContextType | undefined>(undefined);
const RiddleContext = createContext<RiddleContextType | undefined>(undefined);

/**
 * Top-level provider that wires Firebase Auth, Firestore-backed player data,
 * and riddle loading into a single React context.
 *
 * The provider listens to Firebase auth state changes, ensures a corresponding
 * user document exists, initializes riddles when required, and keeps the
 * current riddle in sync with the selected `gameMode`.
 *
 * @param children React element tree that should have access to authentication
 * and player state.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [playerData, setPlayerData] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentRiddle, setCurrentRiddle] = useState<FirestoreRiddle | null>(null);
  const [isDailyChallengeAvailable, setIsDailyChallengeAvailable] = useState<boolean | undefined>(undefined);
  const [gameMode, setGameMode] = useState<GameMode>("daily");
  const [isRiddlesInitializing, setIsRiddlesInitializing] = useState(false);
  const [pendingStreakBreak, setPendingStreakBreak] = useState<{
    previousStreak: number;
  } | null>(null);

  const saveGuestProfileToLocal = useCallback(async (player: Player): Promise<void> => {
    try {
      await AsyncStorage.setItem(GUEST_PROGRESS_STORAGE_KEY, JSON.stringify(player));
    } catch (error) {
      logger.error("Error saving guest progress locally:", error);
      captureException(error);
    }
  }, []);

  const loadGuestProfileFromLocal = useCallback(async (uid: string): Promise<Player | null> => {
    try {
      const raw = await AsyncStorage.getItem(GUEST_PROGRESS_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<Player>;
      const guestBase = createGuestPlayer(uid);
      return {
        ...guestBase,
        coins: typeof parsed.coins === "number" ? parsed.coins : guestBase.coins,
        progress: {
          ...guestBase.progress,
          ...(parsed.progress ?? {}),
        },
        stats: {
          ...guestBase.stats,
          ...(parsed.stats ?? {}),
        },
        unlockedAchievements: Array.isArray(parsed.unlockedAchievements)
          ? parsed.unlockedAchievements
          : guestBase.unlockedAchievements,
        hasPurchasedApp:
          typeof parsed.hasPurchasedApp === "boolean"
            ? parsed.hasPurchasedApp
            : guestBase.hasPurchasedApp,
        avatarUrl:
          typeof parsed.avatarUrl === "string" ? parsed.avatarUrl : guestBase.avatarUrl,
        displayName:
          typeof parsed.displayName === "string"
            ? parsed.displayName
            : guestBase.displayName,
        lastDailyChallengeCompletedAt:
          typeof parsed.lastDailyChallengeCompletedAt === "number"
            ? parsed.lastDailyChallengeCompletedAt
            : undefined,
      };
    } catch (error) {
      logger.error("Error loading guest progress locally:", error);
      captureException(error);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!playerData || !isGuestPlayer(playerData)) return;
    void saveGuestProfileToLocal(playerData);
  }, [playerData, saveGuestProfileToLocal]);

  const clearGuestProfileFromLocal = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(GUEST_PROGRESS_STORAGE_KEY);
    } catch (error) {
      logger.warn("Error clearing guest progress locally:", error);
      captureException(error);
    }
  }, []);

  const clearAllLocalData = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.clear();
      logger.debug("Cleared all local app data.");
    } catch (error) {
      logger.warn("Error clearing local app data:", error);
      captureException(error);
    }
  }, []);

  // Ref keeps the current gameMode accessible inside the auth listener without
  // making it a dependency (which would re-subscribe on every mode change).
  const gameModeRef = useRef<GameMode>("daily");
  gameModeRef.current = gameMode;

  // Tracks the FCM token-refresh unsubscriber so it can be torn down on sign-out.
  const notifUnsubRef = useRef<(() => void) | null>(null);
  // Tracks the current authenticated user ID for use inside the auth listener.
  const currentUserIdRef = useRef<string | null>(null);
  // Deduplicates immediate duplicate auth callbacks for the same user.
  const lastAuthEventRef = useRef<{ uid: string | null; at: number }>({
    uid: null,
    at: 0,
  });
  const previousAuthSnapshotRef = useRef<{
    uid: string | null;
    isAnonymous: boolean | null;
  }>({ uid: null, isAnonymous: null });

  const hasCompletedDailyChallengeToday = useCallback(
    async (player: Player | null): Promise<boolean> => {
      if (!player) return false;
      if (isGuestPlayer(player)) {
        const lastCompletedDate = player.lastDailyChallengeCompletedAt
          ? new Date(player.lastDailyChallengeCompletedAt)
          : null;
        if (!lastCompletedDate) return false;
        const todayUtc = new Date();
        todayUtc.setUTCHours(0, 0, 0, 0);
        const lastCompletedUtc = new Date(lastCompletedDate);
        lastCompletedUtc.setUTCHours(0, 0, 0, 0);
        return todayUtc.getTime() <= lastCompletedUtc.getTime();
      }

      try {
        const getCurrentDailyChallengeCallable = httpsCallable(
          getFunctions(getApp()),
          "getCurrentDailyChallenge"
        );
        const result = await getCurrentDailyChallengeCallable();
        const data = result.data as { hasCompletedToday?: boolean };
        return data.hasCompletedToday === true;
      } catch (error) {
        logger.warn(
          "Unable to resolve daily completion from Firebase function for provider-auth user. Defaulting to not completed.",
          error
        );
        return false;
      }
    },
    []
  );

  const getBrokenDailyStreakValue = useCallback((player: Player | null): number => {
    if (!player) return 0;
    const currentWinStreak = player.stats?.winStreak ?? 0;
    if (currentWinStreak <= 0) return 0;

    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);
    const yesterdayUtcStart = todayUtc.getTime() - 24 * 60 * 60 * 1000;

    if (!player.lastDailyChallengeCompletedAt) {
      return currentWinStreak;
    }

    const lastCompletedDate = new Date(player.lastDailyChallengeCompletedAt);
    if (Number.isNaN(lastCompletedDate.getTime())) {
      return currentWinStreak;
    }
    lastCompletedDate.setUTCHours(0, 0, 0, 0);

    return lastCompletedDate.getTime() < yesterdayUtcStart ? currentWinStreak : 0;
  }, []);

  const consumePendingStreakBreak = useCallback(() => {
    setPendingStreakBreak(null);
  }, []);

  // Function to fetch riddle based on current game mode and player data
  const fetchCurrentRiddle = useCallback(
    async (player: Player | null, mode: GameMode) => {
      if (!player) {
        setCurrentRiddle(null);
        setIsDailyChallengeAvailable(undefined); // Set to undefined when no player data
        return;
      }

      let fetchedRiddle: FirestoreRiddle | null = null;
      let attemptCount = 0;
      const maxAttempts = 20; // Try for up to 1 minute (20 * 3 seconds)

      // Resolve daily challenge availability from backend status so we don't rely
      // on stale local timestamps after a completion in the same session.
      const completedToday = await hasCompletedDailyChallengeToday(player);
      const dailyAvailable = !completedToday;
      setIsDailyChallengeAvailable(dailyAvailable); // Update availability state

      // Helper function to attempt riddle fetch
      const attemptFetchRiddle = async (): Promise<FirestoreRiddle | null> => {
        if (mode === "daily") {
          if (dailyAvailable) {
            // If daily challenge is available and index is defined, fetch it
            // Access dailyChallengeIndex from the nested progress object
            if (player.progress?.dailyChallengeIndex !== undefined) {
              fetchedRiddle = await fetchDailyRiddleFromFirestore(
                player.progress.dailyChallengeIndex
              );
            } else {
              // Handle case where dailyIndex is undefined for daily mode (shouldn't happen if user data is initialized correctly)
              logger.warn(
                "Daily challenge index is undefined for daily mode."
              );
            }
          }

          // If no daily riddle available (completed or failed to fetch), fall back to classic mode
          if (!fetchedRiddle) {
            logger.debug(
              "No daily riddle available, falling back to classic mode riddle."
            );
            if (player.progress?.classicIndex !== undefined) {
              fetchedRiddle = await fetchClassicRiddleFromFirestore(
                player.progress.classicIndex
              );
              setGameMode("classic");
            } else {
              logger.warn(
                "Classic index is undefined, cannot load fallback riddle."
              );
            }
          }
        } else if (mode === "classic") {
          // For classic mode, fetch the riddle based on classicIndex
          // Access classicIndex from the nested progress object
          if (player.progress?.classicIndex !== undefined) {
            fetchedRiddle = await fetchClassicRiddleFromFirestore(
              player.progress.classicIndex
            );
          } else {
            // Handle case where classicIndex is undefined for classic mode
            logger.warn("Classic index is undefined for classic mode.");
          }
        } else if (mode === "challenge") {
          // For challenge mode, try to fetch daily riddle first
          if (dailyAvailable) {
            if (player.progress?.dailyChallengeIndex !== undefined) {
              fetchedRiddle = await fetchDailyRiddleFromFirestore(
                player.progress.dailyChallengeIndex
              );
            }
          }

          // If no daily riddle available, fall back to classic mode
          if (!fetchedRiddle) {
            logger.debug(
              "No daily challenge riddle available, falling back to classic mode riddle."
            );
            if (player.progress?.classicIndex !== undefined) {
              fetchedRiddle = await fetchClassicRiddleFromFirestore(
                player.progress.classicIndex
              );
              setGameMode("classic");
            }
          }
        }

        return fetchedRiddle;
      };

      // First attempt to fetch riddle
      fetchedRiddle = await attemptFetchRiddle();

      // If no riddle found and riddles might still be initializing, poll for riddles
      if (!fetchedRiddle) {
        const initStatus =
          RiddleInitializationService.getInitializationStatus();

        // Only poll if initialization hasn't failed
        if (!initStatus.initializationFailed) {
          logger.debug(
            "📊 No riddle found, checking if riddles are still being generated..."
          );
          setIsRiddlesInitializing(true);

          // Poll for riddles
          while (!fetchedRiddle && attemptCount < maxAttempts) {
            attemptCount++;
            logger.debug(
              `🔄 Polling for riddles... Attempt ${attemptCount}/${maxAttempts}`
            );

            // Wait 3 seconds before next attempt
            await new Promise((resolve) => setTimeout(resolve, 3000));

            // Try fetching again
            fetchedRiddle = await attemptFetchRiddle();

            // Check if initialization completed or failed
            const currentStatus =
              RiddleInitializationService.getInitializationStatus();
            if (
              currentStatus.initializationFailed ||
              currentStatus.hasInitialized
            ) {
              break;
            }
          }

          setIsRiddlesInitializing(false);
        }
      }

      setCurrentRiddle(fetchedRiddle);

      if (!fetchedRiddle) {
        logger.error("❌ Failed to load any riddle after all attempts");
      }
    },
    [setIsRiddlesInitializing, setGameMode, hasCompletedDailyChallengeToday]
  );

  // Initialize offline queue once on mount
  useEffect(() => {
    offlineQueue.initialize();
  }, []);

  // Effect to set up Firebase auth state listener
  useEffect(() => {
    logger.debug("🔧 Setting up Firebase auth listener...");

    const subscriber = getAuth(getApp()).onAuthStateChanged(async (user) => {
      logger.debug(
        "🔔 Firebase auth state changed. User:",
        user ? user.uid : "null"
      );

      if (user) {
        const previousAuth = previousAuthSnapshotRef.current;
        const upgradedFromAnonymous =
          previousAuth.uid === user.uid &&
          previousAuth.isAnonymous === true &&
          user.isAnonymous === false;

        const now = Date.now();
        const isDuplicateImmediateAuthEvent =
          lastAuthEventRef.current.uid === user.uid &&
          now - lastAuthEventRef.current.at < 1500;
        if (isDuplicateImmediateAuthEvent) {
          logger.debug(
            "Skipping duplicate immediate auth event for user:",
            user.uid
          );
          return;
        }
        lastAuthEventRef.current = { uid: user.uid, at: now };

        // User is signed in
        logger.debug("🔐 User authenticated, loading user data...");
        setIsAuthenticated(true);
        currentUserIdRef.current = user.uid;
        sentrySetUser(user.uid, user.email, user.displayName);
        addBreadcrumb("auth", "User signed in", { uid: user.uid });
        void analyticsService.initialize(user.uid);
        void analyticsService.logAuthEvent("login");

        try {
          // Anonymous (guest) users get a minimal in-memory player — no Firestore read/write needed.
          if (user.isAnonymous) {
            logger.debug("👤 Anonymous guest user detected, creating in-memory player data");
            setIsRiddlesInitializing(true);
            await RiddleInitializationService.checkAndInitializeRiddles();
            setIsRiddlesInitializing(false);
            const guestPlayerRaw: Player =
              (await loadGuestProfileFromLocal(user.uid)) ?? createGuestPlayer(user.uid);
            const brokenGuestStreak = getBrokenDailyStreakValue(guestPlayerRaw);
            const guestPlayer =
              brokenGuestStreak > 0
                ? {
                    ...guestPlayerRaw,
                    stats: {
                      ...guestPlayerRaw.stats,
                      winStreak: 0,
                    },
                  }
                : guestPlayerRaw;
            setPendingStreakBreak(
              brokenGuestStreak > 0
                ? { previousStreak: brokenGuestStreak }
                : null
            );
            setPlayerData(guestPlayer);
            await saveGuestProfileToLocal(guestPlayer);

            const guestCompletedToday =
              await hasCompletedDailyChallengeToday(guestPlayer);
            const guestInitialMode = resolveInitialGameMode(
              guestCompletedToday
            ) as GameMode;

            setGameMode(guestInitialMode);
            await fetchCurrentRiddle(guestPlayer, guestInitialMode);
            setIsLoading(false);
          return;
          }

          // Run riddle initialization and user data load in parallel —
          // they are independent and both can start immediately after sign-in.
          logger.debug("🎲 Checking riddle database & loading user data in parallel...");
          setIsRiddlesInitializing(true);
          const [, loadedData] = await Promise.all([
            RiddleInitializationService.checkAndInitializeRiddles(),
            loadUserProgressFromFirestore(user.uid),
          ]);
          setIsRiddlesInitializing(false);

          logger.debug("🔍 Checking for existing user document...");
          let data = loadedData;
          const providerAvatarUrl = await resolveProviderAvatarUrl(user);

          // If no user document exists, create one (new user signup)
          if (!data) {
            void analyticsService.logAuthEvent("signup");
            logger.debug(
              "🆕 No user document found, creating new user document for:",
              user.uid
            );
            logger.debug(
              "📧 Firebase user email:",
              user.email || "(null/empty)"
            );
            logger.debug("📧 Email type:", typeof user.email);
            logger.debug("📧 Email length:", user.email ? user.email.length : 0);
            logger.debug(
              "👤 Using display name:",
              user.displayName || "undefined"
            );
            logger.debug("🔍 Full user object debug:", {
              uid: user.uid,
              email: user.email,
              emailVerified: user.emailVerified,
              displayName: user.displayName,
              photoURL: user.photoURL,
              providerData: user.providerData.map((provider) => ({
                providerId: provider.providerId,
                uid: provider.uid,
                email: provider.email,
                displayName: provider.displayName,
              })),
            });

            try {
              const userEmail = await resolveUserEmail(user);
              const guestSeed = await loadGuestProfileFromLocal(user.uid);
              const shouldSeedFromGuest = isGuestPlayer(guestSeed);

              data = await createUserDocumentInFirestore(
                user.uid,
                userEmail,
                user.displayName || undefined,
                providerAvatarUrl,
                shouldSeedFromGuest ? guestSeed ?? undefined : undefined
              );
              logger.debug("✅ New user document created successfully");
              logger.debug(
                "📄 Created user data:",
                JSON.stringify(data, null, 2)
              );

              if (shouldSeedFromGuest) {
                await clearGuestProfileFromLocal();
                logger.debug("🧳 Migrated guest progress into new account document");
              }
            } catch (createError) {
              logger.error("❌ Error creating user document:", createError);
              captureException(createError);
              throw createError;
            }
          } else {
            logger.debug("✅ Existing user document found");
            if (providerAvatarUrl && data.avatarUrl !== providerAvatarUrl) {
              await updateUserDocumentInFirestore(user.uid, {
                avatarUrl: providerAvatarUrl,
              });
              data = { ...data, avatarUrl: providerAvatarUrl };
              logger.debug("🖼️ Synced avatar from provider profile");
            }
          }

          logger.debug("📊 User data loaded successfully:", !!data);
          const brokenStreak = getBrokenDailyStreakValue(data);
          const normalizedData =
            brokenStreak > 0
              ? {
                  ...data,
                  stats: {
                    ...data.stats,
                    winStreak: 0,
                  },
                }
              : data;
          if (brokenStreak > 0) {
            await updateUserDocumentInFirestore(user.uid, {
              stats: {
                ...data.stats,
                winStreak: 0,
              },
            });
          }
          setPendingStreakBreak(
            brokenStreak > 0 ? { previousStreak: brokenStreak } : null
          );
          setPlayerData(normalizedData);

          const completedToday = await hasCompletedDailyChallengeToday(normalizedData);
          const initialMode = resolveInitialGameMode(completedToday) as GameMode;

          setGameMode(initialMode);

          // Fetch riddle based on Firebase-backed completion status at launch:
          // daily by default, classic only when today's daily is already complete.
          logger.debug("🧩 Loading riddle for initial game mode:", initialMode);
          await fetchCurrentRiddle(normalizedData, initialMode);
          logger.debug("✅ Riddle loading completed");

          // Only set loading to false after everything is complete
          logger.debug(
            "🏁 Setting isLoading to false - initialization complete"
          );
          if (upgradedFromAnonymous) {
            await clearAllLocalData();
          }
          setIsLoading(false);
        } catch (error) {
          logger.error("❌ Error loading user data or riddle:", error);
          logger.error("❌ Error details:", JSON.stringify(error, null, 2));
          captureException(error);
          setPlayerData(null);
          setPendingStreakBreak(null);
          setCurrentRiddle(null);
          setIsDailyChallengeAvailable(undefined);
          // Set loading to false even on error so user isn't stuck
          setIsLoading(false);
        } finally {
          previousAuthSnapshotRef.current = {
            uid: user.uid,
            isAnonymous: user.isAnonymous,
          };
        }
      } else {
        lastAuthEventRef.current = { uid: null, at: Date.now() };
        // User is signed out - no need to load riddles
        logger.debug("🚪 User signed out, clearing data");
        sentryClearUser();
        addBreadcrumb("auth", "User signed out");
        void analyticsService.logAuthEvent("logout");
        void analyticsService.reset();

        // Clean up FCM token-refresh listener (token itself was unregistered in logout()).
        notifUnsubRef.current?.();
        notifUnsubRef.current = null;
        currentUserIdRef.current = null;
        setIsAuthenticated(false);
        setPlayerData(null);
        setPendingStreakBreak(null);
        setCurrentRiddle(null);
        setIsDailyChallengeAvailable(undefined);
        await clearAllLocalData();
        previousAuthSnapshotRef.current = { uid: null, isAnonymous: null };
        logger.debug("🏁 Setting isLoading to false");
        setIsLoading(false);
      }

      logger.debug("✅ Auth state processing completed");
    });

    logger.debug("🎯 Firebase auth listener set up successfully");

    // Unsubscribe on unmount
    return subscriber;
    // fetchCurrentRiddle is stable (its own deps are React state setters).
    // gameModeRef.current is read at call time so gameMode need not be a dep.
  }, [
    fetchCurrentRiddle,
    hasCompletedDailyChallengeToday,
    loadGuestProfileFromLocal,
    clearGuestProfileFromLocal,
    clearAllLocalData,
    saveGuestProfileToLocal,
    getBrokenDailyStreakValue,
  ]);

  // Wrapped in useCallback so these are stable references and don't invalidate
  // the PlayerContext memo on every render.
  const updatePlayerClassicIndex = useCallback(
    async (newIndex: number): Promise<void> => {
      if (!playerData?.userId) return;
      try {
        if (!isGuestPlayer(playerData)) {
          await updateClassicIndexInFirestore(playerData.userId, newIndex);
        }
        const nextPlayer = {
          ...playerData,
          progress: { ...playerData.progress, classicIndex: newIndex },
        };
        setPlayerData(nextPlayer);
        if (isGuestPlayer(playerData)) {
          await saveGuestProfileToLocal(nextPlayer);
        }
        logger.debug("AuthContext: Player classic index updated locally and in Firestore.");
        await fetchCurrentRiddle(
          { ...playerData, progress: { ...playerData.progress, classicIndex: newIndex } },
          "classic"
        );
      } catch (error) {
        logger.error("AuthContext: Error updating player classic index:", error);
        captureException(error);
        throw error;
      }
    },
    [playerData, fetchCurrentRiddle, saveGuestProfileToLocal]
  );

  const updatePlayerData = useCallback(
    async (updates: Partial<Player>): Promise<void> => {
      if (!playerData?.userId) {
        logger.warn("Attempted to update player data without a userId.");
        return;
      }
      try {
        if (!isGuestPlayer(playerData)) {
          await updateUserDocumentInFirestore(playerData.userId, updates);
          setPlayerData((prevData: Player | null) =>
            prevData ? { ...prevData, ...updates } : null
          );
          logger.debug("AuthContext: Player data updated locally and in Firestore.");
          return;
        }
        const nextPlayer = { ...playerData, ...updates };
        setPlayerData(nextPlayer);
        await saveGuestProfileToLocal(nextPlayer);
        logger.debug("AuthContext: Guest player data updated locally.");
      } catch (error) {
        logger.error("AuthContext: Error updating player data:", error);
        captureException(error);
        throw error;
      }
    },
    [playerData, saveGuestProfileToLocal]
  );

  const updatePlayerDataLocally = useCallback(
    (updates: Partial<Player>): void => {
      setPlayerData((prevData: Player | null) => {
        if (!prevData) return null;
        const nextPlayer = { ...prevData, ...updates };
        if (isGuestPlayer(prevData)) {
          void saveGuestProfileToLocal(nextPlayer);
        } else {
          void updateUserDocumentInFirestore(prevData.userId, updates).catch((error) => {
            logger.error("AuthContext: Error syncing local player update to Firestore:", error);
            captureException(error);
          });
        }
        return nextPlayer;
      });
    },
    [saveGuestProfileToLocal]
  );

  // Placeholder login function (keep for now, onAuthStateChanged listener handles state)
  const login = useCallback(async () => {
    // The onAuthStateChanged listener will handle the state update including riddle fetching
    // We can potentially add a re-fetch logic here if needed after a manual login trigger
  }, []);

  // Placeholder logout function (keep for now, onAuthStateChanged listener handles state)
  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      RiddleInitializationService.resetInitializationFlags();
      // Unregister FCM token before signing out — must happen while still authenticated
      notifUnsubRef.current?.();
      notifUnsubRef.current = null;
      const auth = getAuth(getApp());
      const userIdToUnregister = auth.currentUser?.uid ?? currentUserIdRef.current;
      if (userIdToUnregister) {
        currentUserIdRef.current = null;
      }
      if (auth.currentUser) {
        await signOut(auth); // Trigger Firebase sign out
      } else {
        logger.debug("Logout requested with no current Firebase user; skipping signOut.");
      }
      // The onAuthStateChanged listener will handle the state update
    } catch (error) {
      logger.error("Error during logout:", error);
      captureException(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Three narrow memos — each slice only re-triggers consumers that depend on it.
  // sessionValue  changes only on auth state / loading changes.
  // playerValue   changes only when player data or its updaters change.
  // riddleValue   changes only when riddle / game-mode state changes.
  // The merged contextValue is kept for backward-compat via useAuth().
  const sessionValue = useMemo(
    () => ({ isAuthenticated, isLoading, login, logout }),
    [isAuthenticated, isLoading, login, logout]
  );

  const playerValue = useMemo(
    () => ({
      playerData,
      updatePlayerClassicIndex,
      updatePlayerData,
      updatePlayerDataLocally,
      pendingStreakBreak,
      consumePendingStreakBreak,
    }),
    [
      playerData,
      updatePlayerClassicIndex,
      updatePlayerData,
      updatePlayerDataLocally,
      pendingStreakBreak,
      consumePendingStreakBreak,
    ]
  );

  const riddleValue = useMemo(
    () => ({
      currentRiddle,
      setCurrentRiddle,
      fetchCurrentRiddle,
      isDailyChallengeAvailable,
      gameMode,
      setGameMode,
      isRiddlesInitializing,
    }),
    [
      currentRiddle,
      setCurrentRiddle,
      fetchCurrentRiddle,
      isDailyChallengeAvailable,
      gameMode,
      setGameMode,
      isRiddlesInitializing,
    ]
  );

  // Merged value for useAuth() — consumers that call useAuth() still re-render
  // when any slice changes, but targeted hooks (useAuthSession / usePlayer /
  // useRiddle) can be adopted incrementally for finer-grained subscriptions.
  const contextValue = useMemo(
    () => ({ ...sessionValue, ...playerValue, ...riddleValue }),
    [sessionValue, playerValue, riddleValue]
  );

  return (
    <AuthSessionContext.Provider value={sessionValue}>
      <PlayerContext.Provider value={playerValue}>
        <RiddleContext.Provider value={riddleValue}>
          <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
        </RiddleContext.Provider>
      </PlayerContext.Provider>
    </AuthSessionContext.Provider>
  );
};

/**
 * Convenience hook for consuming the authentication and player session
 * context. This must be called from within an `AuthProvider` subtree.
 *
 * @returns The current `AuthContextType` value, including player data,
 * loading flags, and helpers for updating state.
 * @throws If used outside of an `AuthProvider`.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const useAuthSession = () => {
  const context = useContext(AuthSessionContext);
  if (context === undefined) {
    throw new Error("useAuthSession must be used within an AuthProvider");
  }
  return context;
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error("usePlayer must be used within an AuthProvider");
  }
  return context;
};

export const useRiddleState = () => {
  const context = useContext(RiddleContext);
  if (context === undefined) {
    throw new Error("useRiddleState must be used within an AuthProvider");
  }
  return context;
};
