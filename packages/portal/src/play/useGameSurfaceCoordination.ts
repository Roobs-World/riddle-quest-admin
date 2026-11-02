import type {RaceLocale} from "@riddle-quest/core/race";
import {useCallback, useEffect, useState} from "react";
import {trackScreen} from "../analytics/events";
import {resolveActivityPresence} from "../presence/activityPresence";
import type {ActivePresenceState} from "../presence/PlatformPresenceSession";
import type {GameSessionState} from "./gameSessionTypes";
import {isBlockingGameModal} from "./gameSession";
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
  /** Incoming tournament destination, filtered by the target capability. */
  initialRaceTournamentLocale?: RaceLocale;
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
  /** Locale of the undismissed incoming target tournament destination. */
  raceTournamentLocale?: RaceLocale;
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
  initialRaceTournamentLocale,
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
  const [raceOpen, setRaceOpenState] = useState(Boolean((initialRaceChallengeId || initialRaceInbox || initialRaceLobby || initialRaceTournamentLocale) && raceEnabled));
  /** Consume the incoming destination when its journey is dismissed. */
  const entryKey = JSON.stringify([initialRaceChallengeId ?? null, initialRaceInbox, initialRaceLobby ?? false, initialRaceTournamentLocale ?? null]);
  /** Remembers the exact incoming destination dismissed during this mounted visit. */
  const [dismissedEntry, setDismissedEntry] = useState<string | null>(null);
  /** Whether the incoming entry differs from the player's dismissed destination. */
  const entryAvailable = dismissedEntry !== entryKey;
  /** Tracks dismissal of this incoming destination when the player closes multiplayer. */
  const setRaceOpen = useCallback((open: boolean) => {
    if (!open) setDismissedEntry(entryKey);
    setRaceOpenState(open);
  }, [entryKey]);
  /** Whether guidance currently owns interaction above the game. */
  const [guidanceActive, setGuidanceActive] = useState(false);
  /** Whether a playable riddle is present beneath overlays. */
  const hasActiveRiddle = Boolean(session.riddle);
  /** Whether a modal currently owns the overlay surface. */
  const modalOpen = isBlockingGameModal(session.modal);

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
    if (!raceEnabled) setRaceOpenState(false);
    else if (entryAvailable && (initialRaceChallengeId || initialRaceInbox || initialRaceLobby || initialRaceTournamentLocale)) setRaceOpenState(true);
  }, [initialRaceChallengeId, initialRaceInbox, initialRaceLobby, initialRaceTournamentLocale, raceEnabled, entryAvailable]);

  return {raceLocale, raceEnabled, raceOpen, setRaceOpen, raceChallengeId: entryAvailable ? initialRaceChallengeId : undefined,
    raceInbox: entryAvailable && initialRaceInbox, raceTournamentLocale: entryAvailable ? initialRaceTournamentLocale : undefined,
    guidanceActive, setGuidanceActive};
}
