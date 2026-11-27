import {createContext, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode} from "react";
import {useTranslator} from "../../localization/browser/i18n";
import type {PlayerSettingsActionsCapability} from "../contracts/playerSettingsActions";

const PlayerSettingsActionsContext = createContext<PlayerSettingsActionsCapability | null>(null);

/** Only an owning target supplies its optional native Settings actions. */
export function PlayerSettingsActionsProvider({capability, children}: {
  capability?: PlayerSettingsActionsCapability | null;
  children: ReactNode;
}) {
  return <PlayerSettingsActionsContext.Provider value={capability ?? null}>
    {children}
  </PlayerSettingsActionsContext.Provider>;
}

function AvailablePlayerSettingsActions({capability}: {capability: PlayerSettingsActionsCapability}) {
  const tr = useTranslator();
  const snapshot = useSyncExternalStore(capability.subscribe, capability.getSnapshot, capability.getSnapshot);
  const [notice, setNotice] = useState<"error" | "unavailable" | "unsaved" | null>(null);
  const owner = useRef<AbortController | null>(null);
  useLayoutEffect(() => {
    const current = new AbortController();
    owner.current = current;
    setNotice(null);
    return () => {current.abort(); if (owner.current === current) owner.current = null;};
  }, [capability]);
  useEffect(() => {void capability.refresh();}, [capability]);

  const request = async (actionId: string) => {
    const current = owner.current;
    if (!current || snapshot.pendingAction) return;
    setNotice(null);
    const result = await capability.run(actionId, current.signal);
    if (owner.current !== current) return;
    if (result === "error" || result === "unavailable" || result === "unsaved") setNotice(result);
  };

  return <>
    {snapshot.actions.map(action => <button
      key={action.id}
      type="button"
      className="settings-row"
      disabled={snapshot.pendingAction !== null}
      aria-busy={snapshot.pendingAction === action.id}
      onClick={() => void request(action.id)}
    >
      <span>{tr(action.labelKey)}</span>
      <strong aria-hidden="true">›</strong>
    </button>)}
    {notice && <p role="status">{tr(notice === "unsaved" ? "GameScreenAlerts.PROGRESS_UNSAVED_MESSAGE" :
      notice === "unavailable" ? "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE" : "ErrorMessages.GENERIC_UNEXPECTED_ERROR")}</p>}
  </>;
}

/** Unsupported targets render no controls and never import a provider SDK. */
export function PlayerSettingsActions() {
  const capability = useContext(PlayerSettingsActionsContext);
  return capability ? <AvailablePlayerSettingsActions capability={capability} /> : null;
}
