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
import {
  loadUserProgressFromFirestore,
  fetchDailyRiddleFromFirestore,
  fetchClassicRiddleFromFirestore,
  fetchTutorialRiddleFromFirestore,
  updateClassicIndexInFirestore,
  updateUserDocumentInFirestore,
  createUserDocumentInFirestore,
} from "../services/FirestoreService";
import { Player, FirestoreRiddle } from "../validation/firestoreSchemas";
import { getAuth } from "@react-native-firebase/auth";
import { getApp } from "@react-native-firebase/app";
import { getFunctions, httpsCallable } from "@react-native-firebase/functions";
import { RiddleInitializationService } from "../services/RiddleInitializationService";
import { logger } from "../utils/logger";
import { captureException, setUser as sentrySetUser, clearUser as sentryClearUser, addBreadcrumb } from "../utils/sentry";
import { analyticsService } from "../services/AnalyticsService";
import { offlineQueue } from "../services/OfflineQueueService";
import { NotificationService } from "../services/NotificationService";
import {
  createGuestPlayer,
  resolveInitialGameMode,
  resolveUserEmail,
} from "../features/auth/sessionBootstrap";

export type GameMode = "daily" | "classic" | "challenge" | "tutorial";

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
  "playerData" | "updatePlayerClassicIndex" | "updatePlayerData" | "updatePlayerDataLocally"
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

  const hasCompletedDailyChallengeToday = useCallback(
    async (player: Player | null): Promise<boolean> => {
      if (!player) return false;

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
          "Unable to resolve daily completion from Firebase function, falling back to player timestamp check.",
          error
        );
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
    },
    []
  );

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
        } else if (mode === "tutorial") {
          const tutorialIndex = player.progress?.tutorialIndex ?? 0;
          fetchedRiddle =
            await fetchTutorialRiddleFromFirestore(tutorialIndex);
          if (!fetchedRiddle) {
            logger.debug(
              "No tutorial riddle available, falling back to classic mode riddle."
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

        // Request notification permission and register FCM token (non-blocking).
        void (async () => {
          const granted = await NotificationService.requestPermission();
          if (granted) {
            await NotificationService.registerToken(user.uid);
            // Replace any existing token-refresh listener.
            notifUnsubRef.current?.();
            notifUnsubRef.current = NotificationService.onTokenRefresh(user.uid);
          }
        })();

        try {
          // Anonymous (guest) users get a minimal in-memory player — no Firestore read/write needed.
          if (user.isAnonymous) {
            logger.debug("👤 Anonymous guest user detected, creating in-memory player data");
            setIsRiddlesInitializing(true);
            await RiddleInitializationService.checkAndInitializeRiddles();
            setIsRiddlesInitializing(false);
            const guestPlayer: Player = createGuestPlayer(user.uid);
            setPlayerData(guestPlayer);

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

              data = await createUserDocumentInFirestore(
                user.uid,
                userEmail,
                user.displayName || undefined
              );
              logger.debug("✅ New user document created successfully");
              logger.debug(
                "📄 Created user data:",
                JSON.stringify(data, null, 2)
              );
            } catch (createError) {
              logger.error("❌ Error creating user document:", createError);
              captureException(createError);
              throw createError;
            }
          } else {
            logger.debug("✅ Existing user document found");
          }

          logger.debug("📊 User data loaded successfully:", !!data);
          setPlayerData(data);

          const completedToday = await hasCompletedDailyChallengeToday(data);
          const initialMode = resolveInitialGameMode(completedToday) as GameMode;

          setGameMode(initialMode);

          // Fetch riddle based on Firebase-backed completion status at launch:
          // daily by default, classic only when today's daily is already complete.
          logger.debug("🧩 Loading riddle for initial game mode:", initialMode);
          await fetchCurrentRiddle(data, initialMode);
          logger.debug("✅ Riddle loading completed");

          // Only set loading to false after everything is complete
          logger.debug(
            "🏁 Setting isLoading to false - initialization complete"
          );
          setIsLoading(false);
        } catch (error) {
          logger.error("❌ Error loading user data or riddle:", error);
          logger.error("❌ Error details:", JSON.stringify(error, null, 2));
          captureException(error);
          setPlayerData(null);
          setCurrentRiddle(null);
          setIsDailyChallengeAvailable(undefined);
          // Set loading to false even on error so user isn't stuck
          setIsLoading(false);
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
        setCurrentRiddle(null);
        setIsDailyChallengeAvailable(undefined);
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
  }, [fetchCurrentRiddle, hasCompletedDailyChallengeToday]);

  // Wrapped in useCallback so these are stable references and don't invalidate
  // the PlayerContext memo on every render.
  const updatePlayerClassicIndex = useCallback(
    async (newIndex: number): Promise<void> => {
      if (!playerData?.userId) return;
      try {
        await updateClassicIndexInFirestore(playerData.userId, newIndex);
        setPlayerData((prevData: Player | null) =>
          prevData
            ? { ...prevData, progress: { ...prevData.progress, classicIndex: newIndex } }
            : null
        );
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
    [playerData, fetchCurrentRiddle]
  );

  const updatePlayerData = useCallback(
    async (updates: Partial<Player>): Promise<void> => {
      if (!playerData?.userId) {
        logger.warn("Attempted to update player data without a userId.");
        return;
      }
      try {
        await updateUserDocumentInFirestore(playerData.userId, updates);
        setPlayerData((prevData: Player | null) =>
          prevData ? { ...prevData, ...updates } : null
        );
        logger.debug("AuthContext: Player data updated locally and in Firestore.");
      } catch (error) {
        logger.error("AuthContext: Error updating player data:", error);
        captureException(error);
        throw error;
      }
    },
    [playerData]
  );

  const updatePlayerDataLocally = useCallback(
    (updates: Partial<Player>): void => {
      setPlayerData((prevData: Player | null) =>
        prevData ? { ...prevData, ...updates } : null
      );
    },
    []
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
      if (currentUserIdRef.current) {
        await NotificationService.unregisterToken(currentUserIdRef.current);
        currentUserIdRef.current = null;
      }
      await getAuth(getApp()).signOut(); // Trigger Firebase sign out
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
    () => ({ playerData, updatePlayerClassicIndex, updatePlayerData, updatePlayerDataLocally }),
    [playerData, updatePlayerClassicIndex, updatePlayerData, updatePlayerDataLocally]
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
