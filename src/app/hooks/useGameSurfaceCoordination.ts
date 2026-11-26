import {useCallback, useEffect, useRef, useState} from "react";
import {trackEvent, trackScreen} from "../../observability/analytics/events";
import {resolveActivityPresence} from "../../presence/activityPresence";
import type {ActivePresenceState} from "../../presence/PlatformPresenceSession";
import type {GameSessionState} from "../../gameplay/session/gameSessionTypes";
import {isBlockingGameModal} from "../../gameplay/session/gameSession";
import {isSupportedLocale, type Locale} from "../../localization/browser/i18n";
import {isRaceHarness} from "../../races/browser/policy/raceFeatureFlag";

/** Session fields that determine the active presentation surface. */
type SurfaceSession = Pick<GameSessionState, "gameMode" | "locale" | "modal" | "riddle">;

/** Configuration owned by the game-surface coordination module. */
type GameSurfaceCoordinationOptions = Readonly<{
  /** Current reducer state relevant to surface selection. */
  session: SurfaceSession;
  /** Whether multiplayer is enabled by the host build. */
  raceFeatureEnabled: boolean;
  /** Challenge deep link that opens multiplayer immediately when eligible. */
  initialRaceChallengeId?: string;
  /** Whether the multiplayer inbox should open immediately when eligible. */
  initialRaceInbox: boolean;
  /** Whether an invitation should open the multiplayer lobby. */
  initialRaceLobby?: boolean;
  /** Receives target-neutral presence derived from the active surface. */
  onPresenceStateChange?: (state: ActivePresenceState) => void;
}>;

/** Surface state and explicit transitions consumed by the game frame. */
export type GameSurfaceCoordination = Readonly<{
  /** Supported locale passed to multiplayer content. */
  raceLocale?: Locale;
  /** Whether multiplayer is eligible in the current target and locale. */
  raceEnabled: boolean;
  /** Whether the multiplayer surface is currently open. */
  raceOpen: boolean;
  /** Undismissed incoming destinations. */
  raceChallengeId?: string;
  /** Whether the undismissed incoming destination opens multiplayer Activity. */
  raceInbox: boolean;
  /** Opens or closes the multiplayer surface. */
  setRaceOpen: (open: boolean) => void;
  /** Whether onboarding guidance currently owns interaction. */
  guidanceActive: boolean;
  /** Updates whether onboarding guidance owns interaction. */
  setGuidanceActive: (active: boolean) => void;
}>;

/** Owns overlay selection, multiplayer eligibility, analytics, and presence projection. */
export function useGameSurfaceCoordination({
  session,
  raceFeatureEnabled,
  initialRaceChallengeId,
  initialRaceInbox,
  initialRaceLobby,
  onPresenceStateChange,
}: GameSurfaceCoordinationOptions): GameSurfaceCoordination {
  /** Supported multiplayer locale derived from host initialization. */
  const raceLocale = isSupportedLocale(session.locale) ? session.locale : undefined;
  /** Whether the current build, locale, and optional harness permit multiplayer. */
  const raceEnabled =
    raceLocale !== undefined &&
    raceLocale === "en" &&
    (raceFeatureEnabled || isRaceHarness(typeof window === "undefined" ? "" : window.location.search));
  /** Whether multiplayer currently owns the primary game surface. */
  const [raceOpen, setRaceOpenState] = useState(Boolean((initialRaceChallengeId || initialRaceInbox || initialRaceLobby) && raceEnabled));
  /** Consume the incoming destination when its journey is dismissed. */
  const entryKey = JSON.stringify([initialRaceChallengeId ?? null, initialRaceInbox, initialRaceLobby ?? false]);
  /** Remembers the exact incoming destination dismissed during this mounted visit. */
  const [dismissedEntry, setDismissedEntry] = useState<string | null>(null);
  /** Whether the incoming entry differs from the player's dismissed destination. */
  const entryAvailable = dismissedEntry !== entryKey;
  /** Tracks dismissal of this incoming destination when the player closes multiplayer. */
  const setRaceOpen = useCallback((open: boolean) => {
    trackEvent(open ? "multiplayer_opened" : "multiplayer_closed");
    if (!open) setDismissedEntry(entryKey);
    setRaceOpenState(open);
  }, [entryKey]);
  /** Whether guidance currently owns interaction above the game. */
  const [guidanceActive, setGuidanceActive] = useState(false);
  /** Whether a playable riddle is present beneath overlays. */
  const hasActiveRiddle = Boolean(session.riddle);
  /** Whether a modal currently owns the overlay surface. */
  const modalOpen = isBlockingGameModal(session.modal);

  /** Mode changes describe deliberate navigation separately from screen views. */
  const previousMode = useRef(session.gameMode);
  useEffect(() => {
    if (previousMode.current === session.gameMode) return;
    previousMode.current = session.gameMode;
    trackEvent("game_mode_selected", {game_mode: session.gameMode});
  }, [session.gameMode]);

  const previousModal = useRef<typeof session.modal>(undefined);
  useEffect(() => {
    if (previousModal.current === session.modal) return;
    previousModal.current = session.modal;
    if (session.modal) trackEvent("modal_opened", {modal: session.modal});
  }, [session.modal]);

  useEffect(() => {
    /** Stable analytics name for the currently visible surface. */
    const screen = raceOpen
      ? "multiplayer"
      : guidanceActive
        ? "guidance"
        : session.modal
          ? `modal_${session.modal}`
          : session.riddle
            ? `game_${session.gameMode}`
            : "game_loading";
    trackScreen(screen, {game_mode: raceOpen ? "race" : session.gameMode});
  }, [guidanceActive, raceOpen, session.gameMode, session.modal, session.riddle]);

  useEffect(() => {
    onPresenceStateChange?.(resolveActivityPresence({raceOpen, hasRiddle: hasActiveRiddle, modalOpen}));
  }, [hasActiveRiddle, modalOpen, onPresenceStateChange, raceOpen]);

  useEffect(() => {
    if (!raceEnabled) setRaceOpenState(false);
    else if (entryAvailable && (initialRaceChallengeId || initialRaceInbox || initialRaceLobby)) setRaceOpenState(true);
  }, [initialRaceChallengeId, initialRaceInbox, initialRaceLobby, raceEnabled, entryAvailable]);

  return {raceLocale, raceEnabled, raceOpen, setRaceOpen, raceChallengeId: entryAvailable ? initialRaceChallengeId : undefined,
    raceInbox: entryAvailable && initialRaceInbox,
    guidanceActive, setGuidanceActive};
}
