import type {JestPlayerData} from "./types";

/** Keeps same-player client progress across startup while retaining the newly hydrated authority profile. */
export function reconcileJestPlayerProjection(previous: JestPlayerData | null, incoming: JestPlayerData | null): JestPlayerData | null {
  if (!previous) return incoming;
  /** Earlier accepted checkpoint can be newer than a provider read taken while its write is pending. */
  const local = previous.activeGame;
  /** Provider checkpoint remains preferred when it represents a different issued session. */
  const loaded = incoming?.activeGame;
  if (local === undefined || local === loaded) return incoming;
  /** Explicit completion clears supersede older stored games; newer issued checkpoints still win. */
  const retain = local === null
    ? loaded != null && previous.updatedAt >= loaded.savedAt
    : loaded == null || (local.riddleId === loaded.riddleId && local.sessionToken === loaded.sessionToken && local.savedAt >= loaded.savedAt);
  if (!retain) return incoming;
  return {...(incoming ?? {schemaVersion: 1, updatedAt: previous.updatedAt}), activeGame: local};
}
