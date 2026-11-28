import type {PlatformResult} from "../../../../../src/platform/contracts/capabilities";
import type {FacebookInstantSdk} from "../fbinstant";
import {runFacebookSdkDialog} from "../FacebookSdkDialogGate";

export type FacebookNativeSocialSnapshot = Readonly<{
  loading: boolean;
  pending: "leave-context" | "join-room" | null;
  error: boolean;
  canLeaveContext: boolean;
  canJoinRoom: boolean;
}>;

export type FacebookNativeSocial = {
  getSnapshot(): FacebookNativeSocialSnapshot;
  subscribe(listener: () => void): () => void;
  refresh(): Promise<void>;
  leaveContext(signal?: AbortSignal): Promise<PlatformResult<void>>;
  joinRoom(signal?: AbortSignal): Promise<PlatformResult<void>>;
  retire(): void;
};

const empty: FacebookNativeSocialSnapshot = {
  loading: false, pending: null, error: false, canLeaveContext: false, canJoinRoom: false,
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

/** Native room and solo actions reconcile through the existing context coordinator. */
export function createFacebookNativeSocial({sdk, isActive, synchronizeContext, onContextChange}: {
  sdk: FacebookInstantSdk;
  isActive: () => boolean;
  /** Must reconcile the SDK's resulting context with the existing authoritative coordinator. */
  synchronizeContext: () => Promise<void>;
  onContextChange?: (listener: () => void) => () => void;
}): FacebookNativeSocial | undefined {
  let supported: Set<string>;
  try {supported = new Set(sdk.getSupportedAPIs());} catch {return undefined;}
  const context = sdk.context;
  const switchContext = supported.has("context.switchAsync") && typeof context?.switchAsync === "function"
    ? context.switchAsync.bind(context) : undefined;
  const getRoom = supported.has("room.getCurrentMatchAsync") && typeof sdk.room?.getCurrentMatchAsync === "function"
    ? sdk.room.getCurrentMatchAsync.bind(sdk.room) : undefined;
  if (!switchContext) return undefined;
  let retired = false, revision = 0;
  let room: RoomDestination | null = null;
  let snapshot: FacebookNativeSocialSnapshot = empty;
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
    publish({...snapshot, loading: true, error: false, canLeaveContext: Boolean(initialContext), canJoinRoom: false});
    const [currentRoom] = await Promise.allSettled([readRoom()]);
    if (!current() || request !== revision) return;
    if (contextId() !== initialContext) {void refresh(); return;}
    room = currentRoom.status === "fulfilled" ? currentRoom.value : null;
    publish({...snapshot, loading: false,
      canJoinRoom: Boolean(room && room.contextId !== initialContext),
      error: currentRoom.status === "rejected"});
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
        try {await operation(admit);} catch (error) {
          failure = {error};
        }
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
    publish({...snapshot, canLeaveContext: Boolean(contextId()), canJoinRoom: false});
    if (listeners.size && !snapshot.pending) void refresh();
  });
  return {
    getSnapshot: () => snapshot,
    subscribe: listener => {listeners.add(listener); return () => {listeners.delete(listener);};},
    refresh,
    leaveContext: signal => run("leave-context", contextId() ? admit => admit(() => switchContext("SOLO")) : undefined, signal),
    joinRoom: signal => {
      const selected = room;
      return run("join-room", selected ? async admit => {
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
