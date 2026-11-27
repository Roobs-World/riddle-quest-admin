import type {PlatformResult} from "../../../../../src/platform/contracts/capabilities";
import type {FacebookInstantSdk} from "../fbinstant";
import {runFacebookSdkDialog} from "../FacebookSdkDialogGate";

export type FacebookNativeTournament = Readonly<{
  id: string;
  title: string | null;
  endsAtMs: number;
}>;

export type FacebookNativeSocialSnapshot = Readonly<{
  loading: boolean;
  pending: "create-context" | "leave-context" | "join-tournament" | "join-room" | null;
  error: boolean;
  connectedPlayers: number | null;
  contextPlayers: number | null;
  canCreateContext: boolean;
  canLeaveContext: boolean;
  canListTournaments: boolean;
  canJoinTournament: boolean;
  canJoinRoom: boolean;
  tournaments: readonly FacebookNativeTournament[];
}>;

export type FacebookNativeSocial = {
  getSnapshot(): FacebookNativeSocialSnapshot;
  subscribe(listener: () => void): () => void;
  refresh(): Promise<void>;
  createContext(signal?: AbortSignal): Promise<PlatformResult<void>>;
  leaveContext(signal?: AbortSignal): Promise<PlatformResult<void>>;
  joinTournament(id: string, signal?: AbortSignal): Promise<PlatformResult<void>>;
  joinRoom(signal?: AbortSignal): Promise<PlatformResult<void>>;
  retire(): void;
};

const empty: FacebookNativeSocialSnapshot = {
  loading: false, pending: null, error: false, connectedPlayers: null, contextPlayers: null,
  canCreateContext: false, canLeaveContext: false, canListTournaments: false, canJoinTournament: false, canJoinRoom: false, tournaments: [],
};
const validId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9._:-]{1,256}$/u.test(value);

async function readWithinDeadline<Value>(operation: Promise<Value>): Promise<Value> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => reject(new Error("facebook-native-read-timeout")), 8000);
    })]);
  } finally {if (timeout !== undefined) clearTimeout(timeout);}
}

type RoomDestination = {id: string; contextId: string};
function roomDestination(value: unknown): RoomDestination | null {
  if (value === null) return null;
  if (!value || typeof value !== "object" || !("getID" in value) || typeof value.getID !== "function" ||
      !("getContextID" in value) || typeof value.getContextID !== "function") throw new Error("facebook-room-invalid");
  const id: unknown = value.getID(), contextId: unknown = value.getContextID();
  if (!validId(id) || !validId(contextId)) throw new Error("facebook-room-invalid");
  return {id, contextId};
}

/** Meta-owned identities remain at this boundary; the game receives aggregate counts only. */
function playerCount(value: unknown): number {
  if (!Array.isArray(value)) throw new Error("facebook-native-players-invalid");
  const ids = new Set<string>();
  for (const player of value) {
    if (!player || typeof player !== "object" || !("getID" in player) || typeof player.getID !== "function") continue;
    const id: unknown = player.getID();
    if (validId(id)) ids.add(id);
  }
  return ids.size;
}

function tournamentList(value: unknown, now: number): FacebookNativeTournament[] {
  if (!Array.isArray(value)) throw new Error("facebook-native-tournaments-invalid");
  const tournaments = new Map<string, FacebookNativeTournament>();
  for (const tournament of value) {
    if (!tournament || typeof tournament !== "object" ||
        !("getID" in tournament) || typeof tournament.getID !== "function" ||
        !("getEndTime" in tournament) || typeof tournament.getEndTime !== "function") continue;
    try {
      const id: unknown = tournament.getID(), seconds: unknown = tournament.getEndTime();
      if (!validId(id) || typeof seconds !== "number" || !Number.isSafeInteger(seconds * 1000) || seconds * 1000 <= now) continue;
      const title: unknown = "getTitle" in tournament && typeof tournament.getTitle === "function" ? tournament.getTitle() : null;
      tournaments.set(id, {id, endsAtMs: seconds * 1000,
        title: typeof title === "string" ? title.replace(/[\u0000-\u001f\u007f]/gu, "").trim().slice(0, 120) || null : null});
    } catch { /* A malformed native listing cannot hide the remaining usable tournaments. */ }
  }
  return [...tournaments.values()].sort((a, b) => a.endsAtMs - b.endsAtMs).slice(0, 50);
}

/** Optional native discovery never supplies an official score, race membership or economy grant. */
export function createFacebookNativeSocial({sdk, isActive, synchronizeContext, onContextChange, now = Date.now}: {
  sdk: FacebookInstantSdk;
  isActive: () => boolean;
  /** Must reconcile the SDK's resulting context with the existing authoritative coordinator. */
  synchronizeContext: () => Promise<void>;
  onContextChange?: (listener: () => void) => () => void;
  now?: () => number;
}): FacebookNativeSocial | undefined {
  let supported: Set<string>;
  try {supported = new Set(sdk.getSupportedAPIs());} catch {return undefined;}
  const context = sdk.context, tournament = sdk.tournament;
  const getConnected = supported.has("player.getConnectedPlayersAsync") && typeof sdk.player.getConnectedPlayersAsync === "function"
    ? sdk.player.getConnectedPlayersAsync.bind(sdk.player) : undefined;
  const getPlayers = supported.has("context.getPlayersAsync") && typeof context?.getPlayersAsync === "function"
    ? context.getPlayersAsync.bind(context) : undefined;
  const create = supported.has("context.createAsync") && typeof context?.createAsync === "function"
    ? context.createAsync.bind(context) : undefined;
  const switchContext = supported.has("context.switchAsync") && typeof context?.switchAsync === "function"
    ? context.switchAsync.bind(context) : undefined;
  const list = supported.has("tournament.getTournamentsAsync") && typeof tournament?.getTournamentsAsync === "function"
    ? tournament.getTournamentsAsync.bind(tournament) : undefined;
  const join = supported.has("tournament.joinAsync") && typeof tournament?.joinAsync === "function"
    ? tournament.joinAsync.bind(tournament) : undefined;
  const getRoom = supported.has("room.getCurrentMatchAsync") && typeof sdk.room?.getCurrentMatchAsync === "function"
    ? sdk.room.getCurrentMatchAsync.bind(sdk.room) : undefined;
  if (!getConnected && !getPlayers && !create && !switchContext && !list && !getRoom) return undefined;
  let retired = false, revision = 0;
  let room: RoomDestination | null = null;
  let snapshot: FacebookNativeSocialSnapshot = {...empty, canCreateContext: Boolean(create), canListTournaments: Boolean(list), canJoinTournament: Boolean(join)};
  const listeners = new Set<() => void>();
  const current = () => !retired && isActive();
  const publish = (next: FacebookNativeSocialSnapshot) => {
    if (!current()) return;
    snapshot = next;
    listeners.forEach(listener => listener());
  };
  const contextId = () => {
    try {return context?.getID() ?? null;} catch {return null;}
  };
  const readRoom = async () => {
    if (!getRoom) return null;
    try {return roomDestination(await readWithinDeadline(getRoom()));} catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "LIVE_MATCH_NOT_FOUND") return null;
      throw error;
    }
  };
  const refresh = async () => {
    if (!current() || snapshot.pending) return;
    const request = ++revision, initialContext = contextId();
    room = null;
    publish({...snapshot, loading: true, error: false, connectedPlayers: null, contextPlayers: null, tournaments: [],
      canLeaveContext: Boolean(switchContext && initialContext), canJoinRoom: false});
    const [connected, players, tournaments, currentRoom] = await Promise.allSettled([
      getConnected ? readWithinDeadline(Promise.resolve().then(getConnected).then(playerCount)) : Promise.resolve(null),
      getPlayers && initialContext ? readWithinDeadline(Promise.resolve().then(getPlayers).then(playerCount)) : Promise.resolve(null),
      list ? readWithinDeadline(Promise.resolve().then(list).then(value => tournamentList(value, now()))) : Promise.resolve([]),
      readRoom(),
    ]);
    if (!current() || request !== revision) return;
    if (contextId() !== initialContext) {void refresh(); return;}
    room = currentRoom.status === "fulfilled" ? currentRoom.value : null;
    publish({...snapshot, loading: false,
      connectedPlayers: connected.status === "fulfilled" ? connected.value : null,
      contextPlayers: players.status === "fulfilled" ? players.value : null,
      tournaments: tournaments.status === "fulfilled" ? tournaments.value : [],
      canJoinRoom: Boolean(switchContext && room && room.contextId !== initialContext),
      error: connected.status === "rejected" || players.status === "rejected" || tournaments.status === "rejected" || currentRoom.status === "rejected"});
  };
  type AdmitMutation = (mutation: () => Promise<void>) => Promise<void>;
  const run = async (pending: NonNullable<FacebookNativeSocialSnapshot["pending"]>,
    operation: ((admit: AdmitMutation) => Promise<void>) | undefined, signal?: AbortSignal): Promise<PlatformResult<void>> => {
    if (signal?.aborted) return {status: "cancelled"};
    if (!current() || snapshot.pending || !operation) return {status: "unavailable", message: "facebook-native-social-unavailable"};
    ++revision;
    publish({...snapshot, loading: false, pending, error: false});
    try {
      const result = await runFacebookSdkDialog(sdk, async () => {
        // The dialog guard can await native surface cleanup before calling us.
        if (!current() || signal?.aborted) return {status: "cancelled"};
        let admitted = false;
        const admit: AdmitMutation = mutation => {
          if (!current() || signal?.aborted) throw Object.assign(new Error("facebook-native-action-retired"), {code: "USER_CANCELLED"});
          admitted = true;
          return mutation();
        };
        let failure: {error: unknown} | undefined;
        try {await operation(admit);} catch (error) {failure = {error};}
        if (!current()) return {status: "cancelled"};
        // Once admitted, retain the original SDK operation and reconcile its actual outcome,
        // even when the initiating panel has gone away. Only feedback is retired.
        if (admitted) await synchronizeContext();
        if (!current() || signal?.aborted) return {status: "cancelled"};
        if (failure) throw failure.error;
        return {status: "success", value: undefined};
      });
      return signal?.aborted ? {status: "cancelled"} : result;
    } catch (error) {
      if (!current() || signal?.aborted) return {status: "cancelled"};
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      if (code === "USER_INPUT" || code === "USER_CANCELLED") return {status: "cancelled"};
      publish({...snapshot, error: true});
      return {status: "retryable-failure", message: "facebook-native-social-failed"};
    } finally {
      if (current()) {publish({...snapshot, pending: null}); void refresh();}
    }
  };
  const stopContext = onContextChange?.(() => {
    if (!current()) return;
    ++revision;
    room = null;
    publish({...snapshot, contextPlayers: null, canLeaveContext: Boolean(switchContext && contextId()), canJoinRoom: false});
    if (listeners.size && !snapshot.pending) void refresh();
  });
  return {
    getSnapshot: () => snapshot,
    subscribe: listener => {listeners.add(listener); return () => {listeners.delete(listener);};},
    refresh,
    createContext: signal => run("create-context", create ? admit => admit(() => create()) : undefined, signal),
    leaveContext: signal => run("leave-context", switchContext && contextId() ? admit => admit(() => switchContext("SOLO")) : undefined, signal),
    joinTournament: (id, signal) => {
      const selected = snapshot.tournaments.find(item => item.id === id && item.endsAtMs > now());
      return run("join-tournament", selected && join ? admit => {
        if (selected.endsAtMs <= now()) throw new Error("facebook-native-tournament-expired");
        return admit(() => join(selected.id));
      } : undefined, signal);
    },
    joinRoom: signal => {
      const selected = room;
      return run("join-room", selected && switchContext ? async admit => {
        const latest = await readRoom();
        if (!current() || latest?.id !== selected.id || latest.contextId !== selected.contextId) {
          throw new Error("facebook-room-changed");
        }
        await admit(() => switchContext(selected.contextId));
      } : undefined, signal);
    },
    retire: () => {
      retired = true; ++revision; stopContext?.(); room = null; snapshot = empty;
      listeners.forEach(listener => listener()); listeners.clear();
    },
  };
}
