import {createContext, useContext, useLayoutEffect, useRef, useState, useSyncExternalStore, type PropsWithChildren} from "react";
import {useLocale, useTranslator} from "../../../../../src/localization/browser/i18n";
import type {FacebookSessionScore} from "./FacebookSessionScore";

const SessionScoreContext = createContext<FacebookSessionScore | undefined>(undefined);

export function FacebookSessionScoreProvider({capability, children}: PropsWithChildren<{capability?: FacebookSessionScore}>) {
  return <SessionScoreContext.Provider value={capability}>{children}</SessionScoreContext.Provider>;
}

function AvailableSessionScoreAction({capability}: {capability: FacebookSessionScore}) {
  const tr = useTranslator();
  const locale = useLocale();
  const snapshot = useSyncExternalStore(capability.subscribe, capability.getSnapshot, capability.getSnapshot);
  const surface = useRef<AbortController | null>(null);
  const [failed, setFailed] = useState(false);
  useLayoutEffect(() => {
    const current = new AbortController();
    surface.current = current;
    setFailed(false);
    void capability.refresh();
    return () => {current.abort(); if (surface.current === current) surface.current = null;};
  }, [capability, locale]);
  const request = async (action: "score" | "group" | "choose") => {
    const current = surface.current;
    if (!current || snapshot.pending) return;
    setFailed(false);
    const result = action === "score" ? await capability.publish(current.signal) :
      await capability.startPrivateTournament({chooseGroup: action === "choose", signal: current.signal});
    if (surface.current !== current || current.signal.aborted) return;
    setFailed(result.status !== "success" && result.status !== "cancelled");
  };
  if (!snapshot.available && !snapshot.privateAvailable && !snapshot.chooseGroupAvailable && !snapshot.pending && !failed && !snapshot.privateOutcome) return null;
  return <div className="race-hub-social-actions">
    {snapshot.available && <button type="button" disabled={snapshot.pending} aria-busy={snapshot.pending} onClick={() => void request("score")}>
      {tr("RaceTo10.FACEBOOK_SHARE_SESSION_SCORE")}
    </button>}
    {snapshot.privateAvailable && <button type="button" disabled={snapshot.pending} aria-busy={snapshot.pending} onClick={() => void request("group")}>
      {tr("RaceTo10.FACEBOOK_START_GROUP_TOURNAMENT")}
    </button>}
    {snapshot.chooseGroupAvailable && <button type="button" disabled={snapshot.pending} aria-busy={snapshot.pending} onClick={() => void request("choose")}>
      {tr("RaceTo10.FACEBOOK_CHOOSE_GROUP_TOURNAMENT")}
    </button>}
    {(snapshot.privateAvailable || snapshot.chooseGroupAvailable) && <p>{tr("RaceTo10.FACEBOOK_GROUP_TOURNAMENT_NOTICE")}</p>}
    {snapshot.privateOutcome === "uncertain" ? <p className="race-error" role="status">{tr("RaceTo10.FACEBOOK_GROUP_TOURNAMENT_UNCERTAIN")}</p> :
      snapshot.privateOutcome === "incompatible" ? <p className="race-error" role="status">{tr("RaceTo10.FACEBOOK_GROUP_TOURNAMENT_INCOMPATIBLE")}</p> :
        failed && <p className="race-error" role="status">{tr("RaceTo10.ERROR_GENERIC")}</p>}
  </div>;
}

/** The Facebook race lobby owns the action lifetime; starting a race aborts preparation. */
export function FacebookSessionScoreActions() {
  const capability = useContext(SessionScoreContext);
  return capability ? <AvailableSessionScoreAction capability={capability} /> : null;
}
