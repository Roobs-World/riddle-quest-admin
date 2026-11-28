import {createContext, useContext, useLayoutEffect, useRef, useState, useSyncExternalStore, type PropsWithChildren} from "react";
import {tr} from "../../../../../src/localization/browser/i18n";
import type {PlatformResult} from "../../../../../src/platform/contracts/capabilities";
import type {FacebookNativeSocial} from "./FacebookNativeSocial";

const FacebookNativeSocialContext = createContext<FacebookNativeSocial | undefined>(undefined);

export function FacebookNativeSocialProvider({capability, children}: PropsWithChildren<{capability?: FacebookNativeSocial}>) {
  return <FacebookNativeSocialContext.Provider value={capability}>{children}</FacebookNativeSocialContext.Provider>;
}

/** Facebook context actions share the ordinary multiplayer controls. */
export function FacebookNativeSocialActions() {
  const capability = useContext(FacebookNativeSocialContext);
  return capability ? <AvailableNativeSocialActions capability={capability} /> : null;
}

function AvailableNativeSocialActions({capability}: {capability: FacebookNativeSocial}) {
  const snapshot = useSyncExternalStore(capability.subscribe, capability.getSnapshot, capability.getSnapshot);
  const [actionNotice, setActionNotice] = useState<"error" | "unavailable" | null>(null);
  const owner = useRef<FacebookNativeSocial | null>(capability);
  const pendingAction = useRef<AbortController | null>(null);
  useLayoutEffect(() => {
    owner.current = capability;
    setActionNotice(null);
    void capability.refresh();
    return () => {owner.current = null; pendingAction.current?.abort(); pendingAction.current = null;};
  }, [capability]);
  const busy = snapshot.loading || snapshot.pending !== null;
  const run = async (operation: (signal: AbortSignal) => Promise<PlatformResult<void>>) => {
    if (owner.current !== capability || busy || pendingAction.current) return;
    const controller = new AbortController();
    pendingAction.current = controller;
    setActionNotice(null);
    try {
      const result = await operation(controller.signal);
      if (owner.current === capability && !controller.signal.aborted) {
        setActionNotice(result.status === "success" || result.status === "cancelled" ? null :
          result.status === "unavailable" ? "unavailable" : "error");
      }
    } catch {
      if (owner.current === capability && !controller.signal.aborted) setActionNotice("error");
    } finally {if (pendingAction.current === controller) pendingAction.current = null;}
  };
  return <>
    {snapshot.canLeaveContext && <button type="button" disabled={busy} aria-busy={snapshot.pending === "leave-context"}
      onClick={() => void run(capability.leaveContext)}>{tr("RaceTo10.FACEBOOK_LEAVE_CONTEXT")}</button>}
    {snapshot.canJoinRoom && <button type="button" disabled={busy} aria-busy={snapshot.pending === "join-room"}
      onClick={() => void run(capability.joinRoom)}>{tr("RaceTo10.FACEBOOK_JOIN_ROOM")}</button>}
    {snapshot.loading && <p role="status">{tr("RaceTo10.RESULTS_LOADING")}</p>}
    {actionNotice === "unavailable" && <p className="race-error" role="status">{tr("ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE")}</p>}
    {(snapshot.error || actionNotice === "error") && <p className="race-error" role="alert">{tr("RaceTo10.ERROR_GENERIC")}</p>}
  </>;
}
