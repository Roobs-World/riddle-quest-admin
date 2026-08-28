import type {JestBackendPort} from "./backend";
import type {JestPurchaseCoordinator} from "./purchases";
import type {JestPlatformPort, JestSession, PlatformResult} from "./types";
import {captureBrowserException} from "../observability/browserErrorReporter";

/** Provides phase progress behavior. */
const phaseProgress = [5, 15, 28, 42, 58, 72, 88] as const;
/** Keeps Jest's manual-loading watchdog alive until the game is actually interactive. */
const JEST_LOADING_HEARTBEAT_MS = 10_000;
/** Tracks the one live loading heartbeat owned by each initialized platform instance. */
const loadingHeartbeats = new WeakMap<
  JestPlatformPort,
  {
    /** Stores timer. */
    timer: ReturnType<typeof setInterval>; /** Stores progress. */
    /** Stores progress. */
    progress: number;
  }
>();
/** Defines the jest sdk init timeout ms value. */
export const JEST_SDK_INIT_TIMEOUT_MS = 12_000;
/** Defines the jest sdk init timeout message value. */
export const JEST_SDK_INIT_TIMEOUT_MESSAGE = "Jest SDK initialization timed out.";

/** Describes jest startup update. */
export type JestStartupUpdate = {
  /** Stores stage. */
  stage: "connecting" | "player" | "progress" | "game";
  /** Stores progress. */
  progress: number;
};

/** Result of session startup, including an intentionally completed deletion recovery. */
export type JestStartupResult =
  | PlatformResult<JestSession>
  | {
      /** Stores status. */
      status: "account-deleted";
    };

/** Stops a platform loading heartbeat without affecting another startup attempt. */
export function stopJestLoadingHeartbeat(
  platform: JestPlatformPort,
  expectedTimer?: ReturnType<typeof setInterval>,
): void {
  /** Provides heartbeat behavior. */
  const heartbeat = loadingHeartbeats.get(platform);
  if (!heartbeat || (expectedTimer !== undefined && heartbeat.timer !== expectedTimer)) return;
  clearInterval(heartbeat.timer);
  loadingHeartbeats.delete(platform);
}

/** Starts a fresh heartbeat and returns its timer identity for race-safe cleanup. */
const startJestLoadingHeartbeat = (platform: JestPlatformPort, progress: number): ReturnType<typeof setInterval> => {
  stopJestLoadingHeartbeat(platform);
  /** Provides heartbeat behavior. */
  const heartbeat = {progress, timer: undefined as unknown as ReturnType<typeof setInterval>};
  heartbeat.timer = setInterval(() => platform.setLoadingProgress(heartbeat.progress), JEST_LOADING_HEARTBEAT_MS);
  // Node test processes should not be kept alive by the browser lifecycle timer.
  /* istanbul ignore else -- browser interval handles are numeric; Node handles expose unref. */
  if (typeof heartbeat.timer === "object" && "unref" in heartbeat.timer) heartbeat.timer.unref();
  loadingHeartbeats.set(platform, heartbeat);
  return heartbeat.timer;
};

/** Reports progress while retaining the latest value for non-regressing heartbeat updates. */
const reportJestLoadingProgress = (platform: JestPlatformPort, progress: number): void => {
  platform.setLoadingProgress(progress);
  loadingHeartbeats.get(platform)!.progress = progress;
};

/** Dismisses Jest's manual-loading overlay so an in-game retry screen remains interactive. */
const exposeJestStartupFailure = (platform: JestPlatformPort): void => {
  try {
    platform.setLoadingProgress(100);
  } catch (error) {
    captureBrowserException(error, {component: "jest_startup_loading_progress"});
  }
  try {
    platform.markGameLoaded();
  } catch (error) {
    captureBrowserException(error, {component: "jest_startup_loading_overlay"});
  }
};

/** Starts jest session. */
export async function startJestSession(
  platform: JestPlatformPort,
  backend: JestBackendPort,
  purchases: JestPurchaseCoordinator,
  authenticateFirebase: (customToken: string) => Promise<void>,
  onProgress?: (update: JestStartupUpdate) => void,
  options: {
    /** Stores initialization timeout ms. */
    initializationTimeoutMs?: number;
    /** Stores on initialized. */
    onInitialized?: () => boolean | void | Promise<boolean | void>;
    /** Stores on authenticated. */
    onAuthenticated?: () => boolean | void | Promise<boolean | void>;
    /** Stores on identity deleted. */
    onIdentityDeleted?: (playerSigned: string) => void | Promise<void>;
    /** Stores deletion recovery. */
    deletionRecovery?: boolean;
    /** Stores recover account deletion. */
    recoverAccountDeletion?: (playerSigned: string) => Promise<void>;
    /** Stores with identity operation. */
    withIdentityOperation?: (operation: () => Promise<boolean>) => Promise<boolean>;
    /** Stores with account operation. */
    withAccountOperation?: <Result>(operation: () => Promise<Result>) => Promise<Result>;
  } = {},
): Promise<JestStartupResult> {
  /** Provides heartbeat timer behavior. */
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  /** Provides keep heartbeat alive behavior. */
  let keepHeartbeatAlive = false;
  /** Provides sdk initialized behavior. */
  let sdkInitialized = false;
  stopJestLoadingHeartbeat(platform);
  try {
    /** Provides initialization timeout ms behavior. */
    const initializationTimeoutMs = options.initializationTimeoutMs ?? JEST_SDK_INIT_TIMEOUT_MS;
    /** Provides initialization timeout behavior. */
    let initializationTimeout: ReturnType<typeof setTimeout>;
    /** Provides initialized behavior. */
    const initialized = await Promise.race([
      platform.init(),
      new Promise<never>((_, reject) => {
        initializationTimeout = setTimeout(
          () => reject(new Error(JEST_SDK_INIT_TIMEOUT_MESSAGE)),
          initializationTimeoutMs,
        );
      }),
    ]).finally(() => {
      clearTimeout(initializationTimeout);
    });
    if (initialized.status !== "success") return initialized;
    sdkInitialized = true;
    platform.setLoadingProgress(phaseProgress[0]);
    heartbeatTimer = startJestLoadingHeartbeat(platform, phaseProgress[0]);
    if (await options.onInitialized?.()) return {status: "account-deleted"};
    onProgress?.({stage: "player", progress: phaseProgress[1]});
    reportJestLoadingProgress(platform, phaseProgress[1]);
    /** Provides signed promise behavior. */
    const signedPromise = platform.getPlayerSigned();
    /** Provides entry intent behavior. */
    const entryIntent = platform.getEntryIntent();
    /** Provides preferences behavior. */
    const preferences = platform.readPreferences();
    /** Provides player data promise behavior. */
    const playerDataPromise = platform.readPlayerData();
    /** Provides [signed, player data] behavior. */
    const [signed, playerData] = await Promise.all([signedPromise, playerDataPromise]);
    /** Provides profile behavior. */
    let profile: JestSession["profile"] = null;

    if (signed.player.registered) {
      reportJestLoadingProgress(platform, phaseProgress[2]);
      onProgress?.({stage: "progress", progress: phaseProgress[2]});
      try {
        profile = await platform.getProfile();
      } catch (error) {
        captureBrowserException(error, {component: "jest_profile"});
      }
    }

    reportJestLoadingProgress(platform, phaseProgress[3]);
    onProgress?.({stage: "game", progress: phaseProgress[3]});
    /** Provides identity tombstoned behavior. */
    let identityTombstoned = false;
    /** Provides firebase uid behavior. */
    let firebaseUid: string | undefined;
    /** Provides authenticate identity behavior. */
    const authenticateIdentity = async (): Promise<boolean> => {
      if (options.deletionRecovery) {
        if (!options.recoverAccountDeletion) throw new Error("account-deletion-recovery-unavailable");
        await options.recoverAccountDeletion(signed.playerSigned);
        return true;
      }
      /** Provides identity behavior. */
      const identity = await backend.exchangeIdentity(signed.playerSigned);
      if (identity.status === "account-deleted") {
        identityTombstoned = true;
        return true;
      }
      firebaseUid = identity.uid;
      await authenticateFirebase(identity.customToken);
      return Boolean(await options.onAuthenticated?.());
    };
    /** Provides identity deleted behavior. */
    const identityDeleted = options.withIdentityOperation
      ? await options.withIdentityOperation(authenticateIdentity)
      : await authenticateIdentity();
    if (identityDeleted) {
      if (identityTombstoned) await options.onIdentityDeleted?.(signed.playerSigned);
      return {status: "account-deleted"};
    }
    reportJestLoadingProgress(platform, phaseProgress[4]);

    /** Provides reconcile behavior. */
    const reconcile = () => purchases.reconcile(signed.player.playerId);
    /** Provides recovered behavior. */
    const recovered = options.withAccountOperation ? await options.withAccountOperation(reconcile) : await reconcile();
    if (recovered.status !== "success") return recovered;

    reportJestLoadingProgress(platform, phaseProgress[5]);
    if (!firebaseUid) throw new Error("jest-firebase-uid-missing");
    keepHeartbeatAlive = true;
    return {
      status: "success",
      value: {
        firebaseUid,
        player: signed.player,
        profile,
        entryIntent,
        preferences,
        playerData,
        firebaseAuthenticated: true,
      },
    };
  } catch (error) {
    captureBrowserException(error, {component: "jest_startup"});
    return {status: "retryable-failure", message: error instanceof Error ? error.message : String(error)};
  } finally {
    if (!keepHeartbeatAlive) {
      if (heartbeatTimer !== undefined) stopJestLoadingHeartbeat(platform, heartbeatTimer);
      if (sdkInitialized) exposeJestStartupFailure(platform);
    }
  }
}

/** Provides mark jest playable behavior. */
export function markJestPlayable(platform: JestPlatformPort) {
  stopJestLoadingHeartbeat(platform);
  platform.setLoadingProgress(100);
  platform.markGameLoaded();
}
