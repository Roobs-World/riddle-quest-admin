import {LiveRaceChallengeSchema, LiveRaceViewSchema, RetireLiveRaceJoinSchema} from "@riddle-quest/core/race";
export {LIVE_RACE_LOBBY_KEY} from "./liveRaceLobbyHint";

/** Optional raw persistence for an acknowledged account-owned lobby. */
export type LiveRaceLobbyStorage = {
  /** Undefined means storage is unavailable. */ read: () => string | null | undefined;
  /** Reports durable acceptance of serialized bytes. */ write: (value: string) => boolean;
  /** Removes only a caller-verified revision. */ remove: () => boolean;
};
/** Targets supply browser storage or a hydrated native storage bridge. */
const unpersisted: LiveRaceLobbyStorage = {read: () => null, write: () => false, remove: () => false};

/** Strict resumable private-lobby metadata copied from the challenge contract. */
const PrivateLobby = LiveRaceChallengeSchema.pick({challengeId: true, categoryId: true, locale: true, expiresAtMs: true}).strict();
/** Strict public-seat metadata keyed by its server-issued ticket. */
const PublicLobby = PrivateLobby.omit({challengeId: true}).extend({ticketId: LiveRaceViewSchema.shape.ticketId}).strict();
/** Account-generation field that prevents hints from selecting another account seat. */
const owner = {ownerId: RetireLiveRaceJoinSchema.shape.expectedOwnerId.unwrap()};
/** Validated stored selection, including its owning account. */
const Lobby = PrivateLobby.extend(owner).or(PublicLobby.extend(owner));
/** Stored private or public selection inferred from the runtime schema. */
type Lobby = ReturnType<typeof Lobby.parse>;
/** Acknowledged lobby metadata accepted by the account-scoped writer. */
type LobbySelection = ReturnType<typeof PrivateLobby.parse> | ReturnType<typeof PublicLobby.parse>;

/** This hint selects an owned lobby; authenticated server reads still decide whether it exists. */
export function readLiveRaceLobby(ownerId?: string, locale?: string, storage: LiveRaceLobbyStorage = unpersisted, now = Date.now): Lobby | null {
  if (!ownerId) return null;
  /** Untrusted storage value captured for validation and conditional cleanup. */
  const raw = storage.read();
  if (!raw) return null;
  try {
    /** Bounded schema-validated hint checked for owner, locale, and expiry. */
    const saved = raw.length <= 1024 ? Lobby.safeParse(JSON.parse(raw)) : null;
    if (saved?.success && saved.data.ownerId === ownerId && (!locale || saved.data.locale === locale) &&
      saved.data.expiresAtMs > now()) return saved.data;
  } catch { /* Malformed or expired hints cannot select a server seat. */ }
  if (storage.read() === raw) storage.remove();
  return null;
}

/** Only acknowledged lobbies are stored, and a competing visit revokes this writer. */
export function createLiveRaceLobbyStorage(ownerId?: string, storage: LiveRaceLobbyStorage = unpersisted, now = Date.now) {
  /** Last observed storage value; another tab changing it revokes this writer. */
  let observed = storage.read();
  return {
    /** Stores an acknowledged lobby only while this writer still owns the observed value. */
    save(lobby: LobbySelection) {
      if (!ownerId || observed === undefined || storage.read() !== observed) return;
      /** Serialized acknowledged lobby with its account owner attached. */
      const raw = JSON.stringify({...lobby, ownerId});
      if (raw !== observed && storage.write(raw)) observed = raw;
    },
    /** Removes only the matching account-owned lobby without overwriting another tab. */
    clear(lobbyId?: string) {
      if (!ownerId || !observed || storage.read() !== observed) return;
      /** Current account-owned hint checked before removing a selected lobby. */
      const saved = readLiveRaceLobby(ownerId, undefined, storage, now);
      if (saved && (!lobbyId || ("challengeId" in saved ? saved.challengeId : saved.ticketId) === lobbyId) && storage.read() === observed &&
        storage.remove()) observed = null;
    },
  };
}
