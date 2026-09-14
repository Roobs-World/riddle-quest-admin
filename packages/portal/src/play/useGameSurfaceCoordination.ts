import {useEffect, useState} from "react";
import {trackScreen} from "../analytics/events";
import {resolveActivityPresence} from "../presence/activityPresence";
import type {ActivePresenceState} from "../presence/PlatformPresenceSession";
import type {GameSessionState} from "./gameSessionTypes";
import {isSupportedLocale, type Locale} from "./i18n";
import {isRaceHarness} from "./race/logic/raceFeatureFlag";

/** Session fields that determine the active presentation surface. */
type SurfaceSession = Pick<GameSessionState, "gameMode" | "locale" | "modal" | "riddle">;

/** Configuration owned by the game-surface coordination module. */
type GameSurfaceCoordinationOptions = Readonly<{
  /** Current reducer state relevant to surface selection. */
  session: SurfaceSession;
  /** Whether multiplayer is enabled by the host build. */
  raceFeatureEnabled: boolean;
  /** Locale eligibility policy supplied by the active target. */
  raceLocalePolicy: "english-only" | "all";
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
  raceLocalePolicy,
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
    (raceLocalePolicy === "all" || raceLocale === "en") &&
    (raceFeatureEnabled || isRaceHarness(typeof window === "undefined" ? "" : window.location.search));
  /** Whether multiplayer currently owns the primary game surface. */
  const [raceOpen, setRaceOpen] = useState(Boolean((initialRaceChallengeId || initialRaceInbox || initialRaceLobby) && raceEnabled));
  /** Whether guidance currently owns interaction above the game. */
  const [guidanceActive, setGuidanceActive] = useState(false);
  /** Whether a playable riddle is present beneath overlays. */
  const hasActiveRiddle = Boolean(session.riddle);
  /** Whether a modal currently owns the overlay surface. */
  const modalOpen = Boolean(session.modal);

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
    trackScreen(screen, {game_mode: session.gameMode});
  }, [guidanceActive, raceOpen, session.gameMode, session.modal, session.riddle]);

  useEffect(() => {
    onPresenceStateChange?.(resolveActivityPresence({raceOpen, hasRiddle: hasActiveRiddle, modalOpen}));
  }, [hasActiveRiddle, modalOpen, onPresenceStateChange, raceOpen]);

  useEffect(() => {
    if (!raceEnabled) setRaceOpen(false);
    else if (initialRaceChallengeId || initialRaceInbox || initialRaceLobby) setRaceOpen(true);
  }, [initialRaceChallengeId, initialRaceInbox, initialRaceLobby, raceEnabled]);

  return {raceLocale, raceEnabled, raceOpen, setRaceOpen, guidanceActive, setGuidanceActive};
}
