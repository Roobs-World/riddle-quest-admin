import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {BridgeProfile, HostToGameMessage} from "@qwordly/core/bridge";
import {restoreProfileWhileServerLoads} from "../platform/playerData";
import {createRequestId} from "./requestIds";
import type {AuthSnapshot, HostServices} from "./types";

/** Configuration owned by the authenticated host-session module. */
type HostAuthSessionOptions = Readonly<{
  /** Target-neutral host services providing the authentication subscription. */
  services: Pick<HostServices, "auth">;
  /** Profile restored from target persistence while the server profile loads. */
  initialProfile?: BridgeProfile | null;
  /** Registration state, absent when the target has no account-upgrade flow. */
  platformRegistered?: boolean;
  /** Persists authoritative profile changes through the active target adapter. */
  onProfileChange?: (profile: BridgeProfile) => void;
  /** Delivers authentication state to the embedded game. */
  postToGame: (message: HostToGameMessage) => void;
}>;

/** Authenticated state and explicit mutations consumed by host modules. */
export type HostAuthSession = Readonly<{
  /** Latest user and authoritative or temporarily restored profile. */
  snapshot: AuthSnapshot;
  /** User projected with the active target's registration state. */
  bridgeUser: AuthSnapshot["user"];
  /** Applies an authoritative balance when one was returned. */
  applyCoinBalance: (coins?: number, ownerId?: string) => void;
  /** Replaces the current profile after an authoritative refresh. */
  replaceProfile: (profile: BridgeProfile | null, ownerId?: string) => void;
  /** Checks the subscription owner immediately, independently of React render timing. */
  ownsAccount: (ownerId: string) => boolean;
  /** Captures one subscription account visit, including same-UID replacement detection. */
  captureAccount: (ownerId?: string) => () => boolean;
}>;

/** Owns authenticated host state, persistence, and game-bridge synchronization. */
export function useHostAuthSession({
  services,
  initialProfile,
  platformRegistered,
  onProfileChange,
  postToGame,
}: HostAuthSessionOptions): HostAuthSession {
  /** Auth lifetime is independent of reconstructed commerce and capability wrappers. */
  const auth = services.auth;
  /** Latest authentication snapshot supplied by the active target adapter. */
  const [snapshot, setSnapshot] = useState<AuthSnapshot>({user: null, profile: initialProfile ?? null});
  /** Subscription ownership changes before queued React state is committed. */
  const currentAccount = useRef<{
    /** Identity adapter responsible for the current subscription. */ auth: typeof auth;
    /** Most recently subscribed UID, absent when signed out or disposed. */ uid: string | undefined;
  }>({auth, uid: undefined});
  /** Retired providers and unrendered account replacements cannot accept reward callbacks. */
  const ownsAccount = useCallback((ownerId: string) => currentAccount.current.auth === auth && currentAccount.current.uid === ownerId, [auth]);
  /** Retains one account visit rather than only comparing a possibly reused UID. */
  const captureAccount = useMemo(() => {
    /** Profile-only notifications retain this identity; account changes replace it. */
    const selected = currentAccount.current;
    return (ownerId?: string) => () => ownerId !== undefined && currentAccount.current === selected && selected.auth === auth && selected.uid === ownerId;
  }, [auth, currentAccount.current]);
  /** User representation enriched only with target registration state. */
  const bridgeUser = useMemo(
    () => (snapshot.user ? {...snapshot.user, platformRegistered} : null),
    [platformRegistered, snapshot.user],
  );

  useEffect(() => {
    /** Retired subscription callbacks cannot restore an old account. */
    let active = true;
    currentAccount.current = {auth, uid: undefined};
    /** Subscribe only once per identity adapter/restored-profile lifetime. */
    const unsubscribe = auth.subscribe((nextSnapshot) => {
      if (!active) return;
      if (currentAccount.current.auth !== auth || currentAccount.current.uid !== nextSnapshot.user?.uid) currentAccount.current = {auth, uid: nextSnapshot.user?.uid};
      setSnapshot(restoreProfileWhileServerLoads(nextSnapshot, initialProfile ?? undefined));
    });
    return () => {
      active = false;
      if (currentAccount.current.auth === auth) currentAccount.current = {auth, uid: undefined};
      unsubscribe();
    };
  }, [initialProfile, auth]);

  useEffect(() => {
    if (snapshot.user && snapshot.profile) onProfileChange?.(snapshot.profile);
  }, [onProfileChange, snapshot.profile, snapshot.user]);

  useEffect(() => {
    postToGame({
      type: "host:authState",
      requestId: createRequestId("auth"),
      payload: {...snapshot, user: bridgeUser},
    });
  }, [bridgeUser, postToGame, snapshot]);

  /** Applies a server-returned balance without manufacturing a missing profile. */
  const applyCoinBalance = useCallback((coins?: number, ownerId?: string) => {
    if (typeof coins !== "number") return;
    setSnapshot((current) =>
      (ownerId === undefined || current.user?.uid === ownerId) && current.profile ? {...current, profile: {...current.profile, coins}} : current,
    );
  }, []);

  /** Replaces the current profile while preserving the subscribed user. */
  const replaceProfile = useCallback((profile: BridgeProfile | null, ownerId?: string) => {
    setSnapshot((current) => ownerId === undefined || current.user?.uid === ownerId ? {...current, profile} : current);
  }, []);

  return {snapshot, bridgeUser, applyCoinBalance, replaceProfile, ownsAccount, captureAccount};
}
