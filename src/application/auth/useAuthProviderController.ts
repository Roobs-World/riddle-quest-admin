/**
 * @fileoverview Auth bootstrap controller for the provider-auth and guest
 * session lifecycle.
 *
 * The hook coordinates the auth listener, guest persistence, active game
 * session snapshots, riddle fetching, and player updates through application-
 * layer facades and repositories. It intentionally keeps React state at the
 * edge while hiding the orchestration rules that govern stale requests,
 * duplicate auth events, and local-storage cleanup.
 */
import React, {useState, useEffect, useCallback, useMemo, useRef} from "react";
import {getAuth, signOut, type FirebaseAuthTypes} from "@react-native-firebase/auth";
import {getApp} from "@react-native-firebase/app";
import {Player, FirestoreRiddle} from "@qwordly/core/validation/firestoreSchemas";
import {RiddleInitializationService} from "../../services/RiddleInitializationService";
import {logger} from "../../utils/logger";
import {captureException, setUser as sentrySetUser, clearUser as sentryClearUser, addBreadcrumb} from "../../utils/sentry";
import {analyticsService} from "../../services/AnalyticsService";
import {offlineQueue} from "../../services/OfflineQueueService";
import {
  createGuestPlayer,
  resolveInitialGameMode,
  resolveLaunchGameMode,
  resolveProviderAvatarUrl,
  resolveProviderUsername,
  resolveUserEmail,
  isGuestPlayer,
} from "../../features/auth/sessionBootstrap";
import {authSessionFacade} from "./AuthSessionFacade";
import {playerRepository} from "./PlayerRepository";
import {riddleSessionService, type RiddleSessionService} from "./RiddleSessionService";
import {isAnonymousAuthSession, sanitizePlayerUpdates} from "./playerPersistence";
import type {GameMode} from "./authTypes";
import {getLocale} from "../../i18n";

export interface PlayerRepositoryLike {
  clearAllLocalData: () => Promise<void>;
  clearGuestProfile: () => Promise<void>;
  createUserDocument: (
    userId: string,
    email: string,
    displayName?: string,
    avatarUrl?: string | null,
    guestSeed?: Player,
  ) => Promise<Player>;
  loadGuestProfile: (uid: string) => Promise<Player | null>;
  loadUserProgress: (userId: string) => Promise<Player | null>;
  saveGuestProfile: (player: Player) => Promise<void>;
  updateClassicIndex: (userId: string, newIndex: number) => Promise<void>;
  updateUserDocument: (userId: string, basePlayer: Player, updates: Partial<Player>) => Promise<void>;
}

export interface AuthProviderControllerDependencies {
  playerRepository?: PlayerRepositoryLike;
  /** Riddle loader used to resolve the current riddle for the active session. */
  riddleSessionService?: Pick<RiddleSessionService, "fetchCurrentRiddle">;
}

export interface AuthProviderControllerValue {
  /** Auth session state and login/logout actions exposed to the provider. */
  sessionValue: {
    /** True when the current user session is authenticated. */
    isAuthenticated: boolean;
    /** True while the controller is still hydrating user and riddle state. */
    isLoading: boolean;
    /** Starts the login flow and rehydrates the controller. */
    login: () => Promise<void>;
    /** Signs the current user out and clears local session state. */
    logout: () => Promise<void>;
  };
  /** Player document state and mutation helpers for profile/progress updates. */
  playerValue: {
    /** Current player document or `null` when unauthenticated. */
    playerData: Player | null;
    /** Persists the classic index change to the back end. */
    updatePlayerClassicIndex: (newIndex: number) => Promise<void>;
    /** Applies a partial player update through the repository boundary. */
    updatePlayerData: (updates: Partial<Player>) => Promise<void>;
    /** Applies a local-only player update, optionally mirroring to Firestore. */
    updatePlayerDataLocally: (updates: Partial<Player>, options?: {syncToFirestore?: boolean}) => void;
    /** Pending streak-reset info captured during auth/session transitions. */
    pendingStreakBreak: {previousStreak: number} | null;
    /** Clears the pending streak-reset marker after the UI consumes it. */
    consumePendingStreakBreak: () => void;
  };
  /** Riddle and mode state used by gameplay and initialization screens. */
  riddleValue: {
    /** Current riddle shown in the active game mode. */
    currentRiddle: FirestoreRiddle | null;
    /** Sets the current riddle directly, usually from the controller flow. */
    setCurrentRiddle: React.Dispatch<React.SetStateAction<FirestoreRiddle | null>>;
    /** Fetches the riddle for the requested player and mode. */
    fetchCurrentRiddle: (player: Player | null, mode: GameMode, completedDailyOverride?: boolean) => Promise<void>;
    /** Whether the daily challenge is currently available to the player. */
    isDailyChallengeAvailable: boolean | undefined;
    /** The active game mode after bootstrap and fallback resolution. */
    gameMode: GameMode;
    /** Updates the active game mode. */
    setGameMode: (mode: GameMode) => void;
    /** True while riddle generation or initialization work is still running. */
    isRiddlesInitializing: boolean;
  };
  /** Backward-compatible merged controller value for callers that still need every slice together. */
  contextValue: AuthProviderControllerValue["sessionValue"] &
    AuthProviderControllerValue["playerValue"] &
    AuthProviderControllerValue["riddleValue"];
}

const defaultAuthProviderControllerDependencies: AuthProviderControllerDependencies = {
  playerRepository,
  riddleSessionService,
};

export function useAuthProviderController(
  dependencies: AuthProviderControllerDependencies = defaultAuthProviderControllerDependencies,
): AuthProviderControllerValue {
  const repository = dependencies.playerRepository ?? playerRepository;
  const riddleLoader = dependencies.riddleSessionService ?? riddleSessionService;
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
  // Guards against late async guest writes re-populating storage during sign-out.
  const isGuestSignOutInProgressRef = useRef(false);
  // Monotonic request ID used to prevent stale riddle fetches from overwriting newer mode/riddle state.
  const latestRiddleFetchRequestRef = useRef(0);

  const saveGuestProfileToLocal = useCallback(async (player: Player): Promise<void> => {
    if (isGuestSignOutInProgressRef.current) return;
    await repository.saveGuestProfile(player);
  }, [repository]);

  const loadGuestProfileFromLocal = useCallback(
    (uid: string): Promise<Player | null> => repository.loadGuestProfile(uid),
    [repository],
  );

  useEffect(() => {
    if (!playerData || !isAnonymousAuthSession()) return;
    void saveGuestProfileToLocal(playerData);
  }, [playerData, saveGuestProfileToLocal]);

  const clearGuestProfileFromLocal = useCallback(
    (): Promise<void> => repository.clearGuestProfile(),
    [repository],
  );

  const clearAllLocalData = useCallback((): Promise<void> => repository.clearAllLocalData(), [repository]);

  const loadActiveGameSessionFromLocal = useCallback(
    (uid: string) => authSessionFacade.loadActiveGameSession(uid),
    [],
  );

  const saveActiveGameSessionToLocal = useCallback(
    (player: Player, mode: GameMode, riddle: FirestoreRiddle) =>
      authSessionFacade.saveActiveGameSession(player, mode, riddle),
    [],
  );

  useEffect(() => {
    if (!playerData || !currentRiddle) return;
    void saveActiveGameSessionToLocal(playerData, gameMode, currentRiddle);
  }, [playerData, gameMode, currentRiddle, saveActiveGameSessionToLocal]);

  // Ref keeps the current gameMode accessible inside the auth listener without
  // making it a dependency (which would re-subscribe on every mode change).
  const gameModeRef = useRef<GameMode>(gameMode);
  useEffect(() => {
    gameModeRef.current = gameMode;
  }, [gameMode]);

  // Tracks the FCM token-refresh unsubscriber so it can be torn down on sign-out.
  const notifUnsubRef = useRef<(() => void) | null>(null);
  // Tracks the current authenticated user ID for use inside the auth listener.
  const currentUserIdRef = useRef<string | null>(null);
  // Deduplicates immediate duplicate auth callbacks for the same user.
  const lastAuthEventRef = useRef<{
    uid: string | null;
    isAnonymous: boolean | null;
    at: number;
  }>({
    uid: null,
    isAnonymous: null,
    at: 0,
  });
  const previousAuthSnapshotRef = useRef<{
    uid: string | null;
    isAnonymous: boolean | null;
  }>({uid: null, isAnonymous: null});
  // Prevent delayed duplicate auth callbacks from restarting the same expensive
  // provider/guest bootstrap while the first pass is still loading data.
  const activeAuthBootstrapKeysRef = useRef<Set<string>>(new Set());

  const hasCompletedDailyChallengeToday = useCallback(
    (player: Player | null) => authSessionFacade.hasCompletedDailyChallengeToday(player),
    [],
  );

  const getBrokenDailyStreakValue = useCallback(
    (player: Player | null) => authSessionFacade.getBrokenDailyStreakValue(player),
    [],
  );

  const consumePendingStreakBreak = useCallback(() => {
    setPendingStreakBreak(null);
  }, []);

  const fetchCurrentRiddle = useCallback(
    async (player: Player | null, mode: GameMode, completedDailyOverride?: boolean) => {
      const requestId = ++latestRiddleFetchRequestRef.current;
      const isStaleRequest = () => requestId !== latestRiddleFetchRequestRef.current;
      await riddleLoader.fetchCurrentRiddle(
        player,
        mode,
        {
          setCurrentRiddle,
          setIsDailyChallengeAvailable,
          setGameMode,
          setIsRiddlesInitializing,
        },
        {completedDailyOverride, isStaleRequest, locale: getLocale()},
      );
    },
    [riddleLoader],
  );

  // Initialize offline queue once on mount
  useEffect(() => {
    offlineQueue.initialize();
  }, []);

  // Effect to set up Firebase auth state listener
  useEffect(() => {
    logger.debug("Setting up Firebase auth listener...");

    const auth = getAuth(getApp());
    const authHandler = async (user: FirebaseAuthTypes.User | null) => {
      logger.debug("Firebase auth state changed. User:", user ? user.uid : "null");

      if (user) {
        isGuestSignOutInProgressRef.current = false;
        const authBootstrapKey = `${user.uid}:${user.isAnonymous ? "anonymous" : "authenticated"}`;
        const previousAuth = previousAuthSnapshotRef.current;
        const previousImmediateAuthEvent = lastAuthEventRef.current;
        const upgradedFromAnonymous =
          (previousAuth.uid === user.uid && previousAuth.isAnonymous === true && user.isAnonymous === false) ||
          (previousImmediateAuthEvent.uid === user.uid &&
            previousImmediateAuthEvent.isAnonymous === true &&
            user.isAnonymous === false);

        const now = Date.now();
        const isDuplicateImmediateAuthEvent =
          lastAuthEventRef.current.uid === user.uid &&
          lastAuthEventRef.current.isAnonymous === user.isAnonymous &&
          now - lastAuthEventRef.current.at < 1500;
        if (isDuplicateImmediateAuthEvent) {
          logger.debug("Skipping duplicate immediate auth event for user:", user.uid);
          return;
        }
        lastAuthEventRef.current = {
          uid: user.uid,
          isAnonymous: user.isAnonymous,
          at: now,
        };
        if (activeAuthBootstrapKeysRef.current.has(authBootstrapKey)) {
          logger.debug("Skipping duplicate in-flight auth bootstrap for user:", user.uid);
          return;
        }
        activeAuthBootstrapKeysRef.current.add(authBootstrapKey);

        // User is signed in
        logger.debug("User authenticated, loading user data...");
        setIsAuthenticated(true);
        currentUserIdRef.current = user.uid;
        sentrySetUser(user.uid, user.email, user.displayName);
        addBreadcrumb("auth", "User signed in", {uid: user.uid});
        void analyticsService.initialize(user.uid);
        void analyticsService.logAuthEvent("login");

        try {
          // Anonymous (guest) users get a minimal in-memory player - no Firestore read/write needed.
          if (user.isAnonymous) {
            logger.debug("Anonymous guest user detected, creating in-memory player data");
            setIsRiddlesInitializing(true);
            await RiddleInitializationService.checkAndInitializeRiddles();
            setIsRiddlesInitializing(false);
            const guestPlayerRaw: Player = (await loadGuestProfileFromLocal(user.uid)) ?? createGuestPlayer(user.uid);
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
            setPendingStreakBreak(brokenGuestStreak > 0 ? {previousStreak: brokenGuestStreak} : null);
            setPlayerData(guestPlayer);
            await saveGuestProfileToLocal(guestPlayer);

            const guestCompletedToday = await hasCompletedDailyChallengeToday(guestPlayer);
            const guestDefaultMode = resolveInitialGameMode(guestCompletedToday);
            const guestStoredSession = await loadActiveGameSessionFromLocal(user.uid);
            const guestInitialMode = resolveLaunchGameMode({
              defaultMode: guestDefaultMode,
              restoredMode: guestStoredSession?.gameMode,
              dailyAvailable: !guestCompletedToday,
            }) as GameMode;

            setGameMode(guestInitialMode);
            await fetchCurrentRiddle(guestPlayer, guestInitialMode, guestCompletedToday);
            setIsLoading(false);
            return;
          }

          // Run riddle initialization and user data load in parallel -
          // they are independent and both can start immediately after sign-in.
          logger.debug("Checking riddle database & loading user data in parallel...");
          setIsRiddlesInitializing(true);
          const [, loadedData] = await Promise.all([
            RiddleInitializationService.checkAndInitializeRiddles(),
            repository.loadUserProgress(user.uid),
          ]);
          setIsRiddlesInitializing(false);

          logger.debug("Checking for existing user document...");
          let data = loadedData;
          const providerAvatarUrl = await resolveProviderAvatarUrl(user);

          // If no user document exists, create one (new user signup)
          if (!data) {
            void analyticsService.logAuthEvent("signup");
            logger.debug("No user document found, creating new user document for:", user.uid);
            logger.debug("Firebase user email:", user.email || "(null/empty)");
            logger.debug("Email type:", typeof user.email);
            logger.debug("Email length:", user.email ? user.email.length : 0);
            logger.debug("Using display name:", user.displayName || "undefined");
            logger.debug("Full user object debug:", {
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

              data = await repository.createUserDocument(
                user.uid,
                userEmail,
                user.displayName || undefined,
                providerAvatarUrl,
                shouldSeedFromGuest ? (guestSeed ?? undefined) : undefined,
              );
              logger.debug("New user document created successfully");
              logger.debug("Created user data:", JSON.stringify(data, null, 2));

              if (shouldSeedFromGuest) {
                await clearGuestProfileFromLocal();
                logger.debug("Migrated guest progress into new account document");
              }
            } catch (createError) {
              logger.error("Error creating user document:", createError);
              captureException(createError);
              throw createError;
            }
          } else {
            logger.debug("Existing user document found");
          }

          const userDocUpdates: Partial<Player> = {};

          if (providerAvatarUrl && data.avatarUrl !== providerAvatarUrl) {
            userDocUpdates.avatarUrl = providerAvatarUrl;
          }

          const shouldSyncProviderUsername = upgradedFromAnonymous || (!user.isAnonymous && isGuestPlayer(data));
          if (shouldSyncProviderUsername) {
            const providerUsername = resolveProviderUsername(user);
            if (providerUsername && data.username !== providerUsername) {
              userDocUpdates.username = providerUsername;
            }
          }

          const shouldSyncProviderEmail = !user.isAnonymous && isGuestPlayer(data);
          if (shouldSyncProviderEmail) {
            try {
              const providerEmail = await resolveUserEmail(user);
              if (providerEmail && data.email !== providerEmail) {
                userDocUpdates.email = providerEmail;
              }
            } catch (emailError) {
              logger.warn("Could not resolve provider email while reconciling upgraded profile.", emailError);
            }
          }

          if (Object.keys(userDocUpdates).length > 0) {
            await repository.updateUserDocument(user.uid, data, userDocUpdates);
            data = {...data, ...userDocUpdates};
            logger.debug("Synced provider profile fields:", userDocUpdates);
          }

          logger.debug("User data loaded successfully:", !!data);
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
            await repository.updateUserDocument(user.uid, data, {
              stats: {
                ...data.stats,
                winStreak: 0,
              },
            });
          }
          setPendingStreakBreak(brokenStreak > 0 ? {previousStreak: brokenStreak} : null);
          setPlayerData(normalizedData);

          const completedToday = await hasCompletedDailyChallengeToday(normalizedData);
          const defaultMode = resolveInitialGameMode(completedToday);
          const storedSession = await loadActiveGameSessionFromLocal(user.uid);
          const initialMode = resolveLaunchGameMode({
            defaultMode,
            restoredMode: storedSession?.gameMode,
            dailyAvailable: !completedToday,
          }) as GameMode;

          setGameMode(initialMode);

          // Fetch riddle based on Firebase-backed completion status at launch:
          // daily by default, classic only when today's daily is already complete.
          logger.debug("Loading riddle for initial game mode:", initialMode);
          await fetchCurrentRiddle(normalizedData, initialMode, completedToday);
          logger.debug("Riddle loading completed");

          // Only set loading to false after everything is complete
          logger.debug("Setting isLoading to false - initialization complete");
          if (upgradedFromAnonymous) {
            await clearAllLocalData();
          }
          setIsLoading(false);
        } catch (error) {
          logger.error("Error loading user data or riddle:", error);
          logger.error("Error details:", {
            code:
              typeof error === "object" && error !== null && "code" in error
                ? (error as {code?: unknown}).code
                : undefined,
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          });
          captureException(error);
          setPlayerData(null);
          setPendingStreakBreak(null);
          setCurrentRiddle(null);
          setIsDailyChallengeAvailable(undefined);
          setIsRiddlesInitializing(false);
          // Set loading to false even on error so user isn't stuck
          setIsLoading(false);
        } finally {
          activeAuthBootstrapKeysRef.current.delete(authBootstrapKey);
          previousAuthSnapshotRef.current = {
            uid: user.uid,
            isAnonymous: user.isAnonymous,
          };
        }
      } else {
        activeAuthBootstrapKeysRef.current.clear();
        lastAuthEventRef.current = {uid: null, isAnonymous: null, at: Date.now()};
        // User is signed out - no need to load riddles
        logger.debug("User signed out, clearing data");
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
        setIsRiddlesInitializing(false);
        await clearAllLocalData();
        previousAuthSnapshotRef.current = {uid: null, isAnonymous: null};
        logger.debug("Setting isLoading to false");
        setIsLoading(false);
      }

      logger.debug("Auth state processing completed");
    };

    const authWithUserChanged = auth as typeof auth & {
      onUserChanged?: (listener: (user: FirebaseAuthTypes.User | null) => void) => () => void;
    };

    const subscriber =
      typeof authWithUserChanged.onUserChanged === "function"
        ? authWithUserChanged.onUserChanged(authHandler)
        : auth.onAuthStateChanged(authHandler);

    logger.debug("Firebase auth listener set up successfully");

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
    loadActiveGameSessionFromLocal,
    repository,
  ]);

  // Wrapped in useCallback so these are stable references and don't invalidate
  // the PlayerContext memo on every render.
  const updatePlayerClassicIndex = useCallback(
    async (newIndex: number): Promise<void> => {
      if (!playerData?.userId) return;
      try {
        const isAnonymousSession = isAnonymousAuthSession();
        if (!isAnonymousSession) {
          await repository.updateClassicIndex(playerData.userId, newIndex);
        }
        let nextPlayerSnapshot: Player | null = null;
        setPlayerData((prevData: Player | null) => {
          if (!prevData) return null;
          const nextPlayer = {
            ...prevData,
            progress: {...prevData.progress, classicIndex: newIndex},
          };
          nextPlayerSnapshot = nextPlayer;
          return nextPlayer;
        });
        if (isAnonymousSession && nextPlayerSnapshot) {
          await saveGuestProfileToLocal(nextPlayerSnapshot);
        }
        logger.debug("AuthContext: Player classic index updated locally and in Firestore.");
        await fetchCurrentRiddle(
          nextPlayerSnapshot ?? {
            ...playerData,
            progress: {...playerData.progress, classicIndex: newIndex},
          },
          "classic",
          undefined,
        );
      } catch (error) {
        logger.error("AuthContext: Error updating player classic index:", error);
        captureException(error);
        throw error;
      }
    },
    [playerData, fetchCurrentRiddle, repository, saveGuestProfileToLocal],
  );

  const updatePlayerData = useCallback(
    async (updates: Partial<Player>): Promise<void> => {
      if (!playerData?.userId) {
        logger.warn("Attempted to update player data without a userId.");
        return;
      }
      const sanitizedUpdates = sanitizePlayerUpdates(updates);
      if (Object.keys(sanitizedUpdates).length === 0) {
        return;
      }
      try {
        const isAnonymousSession = isAnonymousAuthSession();
        if (!isAnonymousSession) {
          const authUid = getAuth(getApp()).currentUser?.uid;
          const targetUserId = authUid ?? playerData.userId;
          if (authUid && authUid !== playerData.userId) {
            logger.warn(
              "AuthContext: Detected auth/userId mismatch during player update. Using auth uid for Firestore write.",
              {authUid, playerUserId: playerData.userId},
            );
          }
          await repository.updateUserDocument(targetUserId, playerData, sanitizedUpdates);
          setPlayerData((prevData: Player | null) =>
            prevData ? {...prevData, ...sanitizedUpdates, userId: targetUserId} : null,
          );
          logger.debug("AuthContext: Player data updated locally and in Firestore.");
          return;
        }
        const nextPlayer = {...playerData, ...sanitizedUpdates};
        setPlayerData(nextPlayer);
        await saveGuestProfileToLocal(nextPlayer);
        logger.debug("AuthContext: Guest player data updated locally.");
      } catch (error) {
        logger.error("AuthContext: Error updating player data:", error);
        captureException(error);
        throw error;
      }
    },
    [playerData, saveGuestProfileToLocal, repository],
  );

  const updatePlayerDataLocally = useCallback(
    (updates: Partial<Player>, options?: {syncToFirestore?: boolean}): void => {
      const shouldSyncToFirestore = options?.syncToFirestore ?? true;
      const sanitizedUpdates = sanitizePlayerUpdates(updates);
      if (Object.keys(sanitizedUpdates).length === 0) {
        return;
      }
      setPlayerData((prevData: Player | null) => {
        if (!prevData) return null;
        const nextPlayer = {...prevData, ...sanitizedUpdates};
        if (isAnonymousAuthSession()) {
          void saveGuestProfileToLocal(nextPlayer);
        } else if (shouldSyncToFirestore) {
          const authUid = getAuth(getApp()).currentUser?.uid;
          if (authUid && authUid !== prevData.userId) {
            logger.warn("AuthContext: Skipping Firestore sync for local player update due to auth/user mismatch.", {
              authUid,
              playerUserId: prevData.userId,
            });
            return nextPlayer;
          }
          void repository.updateUserDocument(prevData.userId, prevData, sanitizedUpdates).catch((error) => {
            logger.error("AuthContext: Error syncing local player update to Firestore:", error);
            captureException(error);
          });
        }
        return nextPlayer;
      });
    },
    [saveGuestProfileToLocal, repository],
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
      // Unregister FCM token before signing out - must happen while still authenticated
      notifUnsubRef.current?.();
      notifUnsubRef.current = null;
      const auth = getAuth(getApp());
      const isGuestSignOut =
        auth.currentUser?.isAnonymous === true || previousAuthSnapshotRef.current.isAnonymous === true;
      if (isGuestSignOut) {
        isGuestSignOutInProgressRef.current = true;
        await clearAllLocalData();
      }
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
      isGuestSignOutInProgressRef.current = false;
    } finally {
      setIsLoading(false);
    }
  }, [clearAllLocalData]);

  // Three narrow memos - each slice only re-triggers consumers that depend on it.
  // sessionValue changes only on auth state / loading changes.
  // playerValue changes only when player data or its updaters change.
  // riddleValue changes only when riddle / game-mode state changes.
  // The merged contextValue stays available for compatibility callers that still
  // need the full aggregate auth surface.
  const sessionValue = useMemo(
    () => ({isAuthenticated, isLoading, login, logout}),
    [isAuthenticated, isLoading, login, logout],
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
    ],
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
    ],
  );

  // Merged value stays available for compatibility callers; targeted hooks
  // (useAuthSession / usePlayer / useRiddleState) can subscribe to just the
  // slice they need.
  const contextValue = useMemo(
    () => ({...sessionValue, ...playerValue, ...riddleValue}),
    [sessionValue, playerValue, riddleValue],
  );

  return {sessionValue, playerValue, riddleValue, contextValue};
}
