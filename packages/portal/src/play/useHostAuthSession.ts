import {useCallback, useEffect, useMemo, useState} from "react";
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
  applyCoinBalance: (coins?: number) => void;
  /** Replaces the current profile after an authoritative refresh. */
  replaceProfile: (profile: BridgeProfile | null) => void;
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
  /** User representation enriched only with target registration state. */
  const bridgeUser = useMemo(
    () => (snapshot.user ? {...snapshot.user, platformRegistered} : null),
    [platformRegistered, snapshot.user],
  );

  useEffect(
    () =>
      auth.subscribe((nextSnapshot) => {
        setSnapshot(restoreProfileWhileServerLoads(nextSnapshot, initialProfile ?? undefined));
      }),
    [initialProfile, auth],
  );

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
  const applyCoinBalance = useCallback((coins?: number) => {
    if (typeof coins !== "number") return;
    setSnapshot((current) =>
      current.profile ? {...current, profile: {...current.profile, coins}} : current,
    );
  }, []);

  /** Replaces the current profile while preserving the subscribed user. */
  const replaceProfile = useCallback((profile: BridgeProfile | null) => {
    setSnapshot((current) => ({...current, profile}));
  }, []);

  return {snapshot, bridgeUser, applyCoinBalance, replaceProfile};
}
