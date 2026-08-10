import type {JestBackendPort} from "./backend";
import type {JestPurchaseCoordinator} from "./purchases";
import type {JestPlatformPort, JestSession, PlatformResult} from "./types";

/** Provides phase progress behavior. */
const phaseProgress = [5, 15, 28, 42, 58, 72, 88] as const;
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

/** Starts jest session. */
export async function startJestSession(
  platform: JestPlatformPort,
  backend: JestBackendPort,
  purchases: JestPurchaseCoordinator,
  authenticateFirebase: (customToken: string) => Promise<void>,
  onProgress?: (update: JestStartupUpdate) => void,
  options: {initializationTimeoutMs?: number} = {},
): Promise<PlatformResult<JestSession>> {
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  try {
    const initializationTimeoutMs = options.initializationTimeoutMs ?? JEST_SDK_INIT_TIMEOUT_MS;
    let initializationTimeout: ReturnType<typeof setTimeout>;
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
    platform.setLoadingProgress(phaseProgress[0]);
    onProgress?.({stage: "player", progress: phaseProgress[1]});
    heartbeat = setInterval(() => platform.setLoadingProgress(phaseProgress[0]), 10_000);
    platform.setLoadingProgress(phaseProgress[1]);
    const signedPromise = platform.getPlayerSigned();
    const entryIntent = platform.getEntryIntent();
    const preferences = platform.readPreferences();
    const playerDataPromise = platform.readPlayerData();
    const [signed, playerData] = await Promise.all([signedPromise, playerDataPromise]);
    let profile: JestSession["profile"] = null;

    if (signed.player.registered) {
      platform.setLoadingProgress(phaseProgress[2]);
      onProgress?.({stage: "progress", progress: phaseProgress[2]});
      profile = await platform.getProfile();
    }

    platform.setLoadingProgress(phaseProgress[3]);
    onProgress?.({stage: "game", progress: phaseProgress[3]});
    const identity = await backend.exchangeIdentity(signed.playerSigned);
    await authenticateFirebase(identity.customToken);
    platform.setLoadingProgress(phaseProgress[4]);

    const recovered = await purchases.reconcile(signed.player.playerId);
    if (recovered.status !== "success") return recovered;

    platform.setLoadingProgress(phaseProgress[5]);
    return {
      status: "success",
      value: {player: signed.player, profile, entryIntent, preferences, playerData, firebaseAuthenticated: true},
    };
  } catch (error) {
    return {status: "retryable-failure", message: error instanceof Error ? error.message : String(error)};
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
}

/** Provides mark jest playable behavior. */
export function markJestPlayable(platform: JestPlatformPort) {
  platform.setLoadingProgress(100);
  platform.markGameLoaded();
}
