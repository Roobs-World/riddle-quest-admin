import {createContext, useContext, useLayoutEffect, useRef, useState, useSyncExternalStore, type PropsWithChildren} from "react";
import {tr} from "../../../../../src/localization/browser/i18n";
import type {PlatformResult} from "../../../../../src/platform/contracts/capabilities";
import type {FacebookNativeSocial} from "./FacebookNativeSocial";

const FacebookNativeSocialContext = createContext<FacebookNativeSocial | undefined>(undefined);

export function FacebookNativeSocialProvider({capability, children}: PropsWithChildren<{capability?: FacebookNativeSocial}>) {
  return <FacebookNativeSocialContext.Provider value={capability}>{children}</FacebookNativeSocialContext.Provider>;
}

/** Native social discovery stays inside the Facebook race lobby and exposes no profile data. */
export function FacebookNativeSocialPanel() {
  const capability = useContext(FacebookNativeSocialContext);
  return capability ? <AvailableNativeSocialPanel key="facebook-native-social" capability={capability} /> : null;
}

function AvailableNativeSocialPanel({capability}: {capability: FacebookNativeSocial}) {
  const snapshot = useSyncExternalStore(capability.subscribe, capability.getSnapshot, capability.getSnapshot);
  const [actionError, setActionError] = useState(false);
  const owner = useRef<FacebookNativeSocial | null>(capability);
  const pendingAction = useRef<AbortController | null>(null);
  const details = useRef<HTMLDetailsElement>(null);
  useLayoutEffect(() => {
    owner.current = capability;
    return () => {owner.current = null; pendingAction.current?.abort(); pendingAction.current = null;};
  }, [capability]);
  const busy = snapshot.loading || snapshot.pending !== null;
  const run = async (operation: (signal: AbortSignal) => Promise<PlatformResult<void>>) => {
    if (owner.current !== capability || !details.current?.open || pendingAction.current) return;
    const controller = new AbortController();
    pendingAction.current = controller;
    setActionError(false);
    try {
      const result = await operation(controller.signal);
      if (owner.current === capability && !controller.signal.aborted && details.current?.open) {
        setActionError(result.status !== "success" && result.status !== "cancelled");
      }
    } catch {
      if (owner.current === capability && !controller.signal.aborted && details.current?.open) setActionError(true);
    } finally {if (pendingAction.current === controller) pendingAction.current = null;}
  };
  return <details ref={details} className="race-panel facebook-native-social" onToggle={event => {
    if (event.currentTarget.open) {setActionError(false); void capability.refresh();}
    else pendingAction.current?.abort();
  }}>
    <summary onClick={() => {if (details.current?.open) pendingAction.current?.abort();}}>{tr("RaceTo10.FACEBOOK_SOCIAL")}</summary>
    <div aria-busy={busy}>
      {snapshot.connectedPlayers !== null && <p>{tr("RaceTo10.FACEBOOK_FRIEND_COUNT", {count: snapshot.connectedPlayers})}</p>}
      {snapshot.contextPlayers !== null && <p>{tr("RaceTo10.FACEBOOK_CONTEXT_COUNT", {count: snapshot.contextPlayers})}</p>}
      <div className="race-hub-social-actions">
        {snapshot.canCreateContext && <button type="button" disabled={busy} onClick={() => void run(capability.createContext)}>
          {tr("RaceTo10.FACEBOOK_CREATE_CONTEXT")}
        </button>}
        {snapshot.canLeaveContext && <button type="button" disabled={busy} onClick={() => void run(capability.leaveContext)}>
          {tr("RaceTo10.FACEBOOK_LEAVE_CONTEXT")}
        </button>}
        {snapshot.canJoinRoom && <button type="button" disabled={busy} onClick={() => void run(capability.joinRoom)}>
          {tr("RaceTo10.FACEBOOK_JOIN_ROOM")}
        </button>}
      </div>
      {snapshot.canListTournaments && <section aria-labelledby="facebook-native-tournaments-title">
        <h2 id="facebook-native-tournaments-title">{tr("RaceTo10.FACEBOOK_TOURNAMENTS")}</h2>
        {!snapshot.loading && snapshot.tournaments.length === 0 && <p>{tr("RaceTo10.RESULTS_EMPTY")}</p>}
        <ul>{snapshot.tournaments.map((tournament, index) => <li key={tournament.id}>
          <span>{tournament.title ?? tr("RaceTo10.FACEBOOK_TOURNAMENT_NUMBER", {number: index + 1})}</span>
          {snapshot.canJoinTournament && <button type="button" disabled={busy} onClick={() => void run(signal => capability.joinTournament(tournament.id, signal))}>
            {tr("RaceTo10.FACEBOOK_JOIN_TOURNAMENT")}
          </button>}
        </li>)}</ul>
      </section>}
      {snapshot.loading && <p role="status">{tr("RaceTo10.RESULTS_LOADING")}</p>}
      {(snapshot.error || actionError) && <p className="race-error" role="alert">{tr("RaceTo10.ERROR_GENERIC")}</p>}
      <button type="button" disabled={busy} className="race-secondary" onClick={() => {setActionError(false); void capability.refresh();}}>
        {tr("RaceTo10.FACEBOOK_REFRESH")}
      </button>
    </div>
  </details>;
}
