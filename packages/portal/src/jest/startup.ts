import type {JestBackendPort} from "./backend";
import type {JestPurchaseCoordinator} from "./purchases";
import type {JestPlatformPort, JestSession, PlatformResult} from "./types";

const phaseProgress = [5, 15, 28, 42, 58, 72, 88] as const;

export async function startJestSession(
  platform: JestPlatformPort,
  backend: JestBackendPort,
  purchases: JestPurchaseCoordinator,
  authenticateFirebase: (customToken: string) => Promise<void>,
): Promise<PlatformResult<JestSession>> {
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  try {
    const initialized = await platform.init();
    if (initialized.status !== "success") return initialized;
    platform.setLoadingProgress(phaseProgress[0]);
    heartbeat = setInterval(() => platform.setLoadingProgress(phaseProgress[0]), 10_000);
    platform.setLoadingProgress(phaseProgress[1]);
    const signed = await platform.getPlayerSigned();
    const entryIntent = platform.getEntryIntent();
    platform.setLoadingProgress(phaseProgress[2]);
    const identity = await backend.exchangeIdentity(signed.playerSigned);
    await authenticateFirebase(identity.customToken);
    platform.setLoadingProgress(phaseProgress[3]);
    const recovered = await purchases.reconcile(signed.player.playerId);
    if (recovered.status !== "success") return recovered;
    platform.setLoadingProgress(phaseProgress[4]);
    const preferences = platform.readPreferences();
    const profile = await platform.getProfile();
    platform.setLoadingProgress(phaseProgress[5]);
    return {status: "success", value: {player: signed.player, profile, entryIntent, preferences, firebaseAuthenticated: true}};
  } catch (error) {
    return {status: "retryable-failure", message: error instanceof Error ? error.message : String(error)};
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
}

export function markJestPlayable(platform: JestPlatformPort) {
  platform.setLoadingProgress(100);
  platform.markGameLoaded();
}
