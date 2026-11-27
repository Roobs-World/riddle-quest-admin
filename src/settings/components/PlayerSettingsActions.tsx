import {createContext, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode} from "react";
import {useTranslator} from "../../localization/browser/i18n";
import type {PlayerSettingsAction, PlayerSettingsActionsCapability} from "../contracts/playerSettingsActions";

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

const ACTION_LABELS = {
  "create-shortcut": "Settings.ADD_SHORTCUT_BUTTON",
  "follow-community": "Settings.FOLLOW_COMMUNITY_BUTTON",
  "join-community": "Settings.JOIN_COMMUNITY_BUTTON",
  "privacy-policy": "Settings.PRIVACY_BUTTON",
  "terms-of-use": "Settings.TERMS_BUTTON",
  quit: "Settings.QUIT_GAME_BUTTON",
} satisfies Record<PlayerSettingsAction, string>;

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

  const request = async (action: PlayerSettingsAction) => {
    const current = owner.current;
    if (!current || snapshot.pendingAction) return;
    setNotice(null);
    const result = await capability.run(action, current.signal);
    if (owner.current !== current) return;
    if (result === "error" || result === "unavailable" || result === "unsaved") setNotice(result);
  };

  return <>
    {snapshot.actions.map(action => <button
      key={action}
      type="button"
      className="settings-row"
      disabled={snapshot.pendingAction !== null}
      aria-busy={snapshot.pendingAction === action}
      onClick={() => void request(action)}
    >
      <span>{tr(ACTION_LABELS[action])}</span>
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
