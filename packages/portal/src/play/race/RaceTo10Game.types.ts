import type {GameToHostMessage} from "@qwordly/core/bridge";
import type {ReactNode} from "react";
import type {LiveRaceView, ListRaceCategoriesResponse, RaceLocale} from "@qwordly/core/race";
import type {
  ContextBoardCapability,
  MatchmakingCapability,
  NativeSocialCapability,
  OverlayCapability,
  TournamentCapability,
} from "../../platform/types";

/** Inputs required by the server-authoritative Race to 10 coordinator. */
export type RaceTo10GameProps = Readonly<{
  /** Stores locale. */
  locale: RaceLocale;
  /** Stores challenge id. */
  challengeId?: string;
  /** Stores open inbox. */
  openInbox?: boolean;
  /** Incoming native tournament language; ignored without the target tournament capability. */
  tournamentLocale?: RaceLocale;
  /** Stores coins. */
  coins: number;
  /** Authenticated game account that owns persisted race runs. */
  ownerId?: string;
  /** Stores post to host. */
  postToHost: (message: GameToHostMessage) => void | Promise<void>;
  /** Stores on close. */
  onClose: () => void;
  /** Stores initial categories. */
  initialCategories?: ListRaceCategoriesResponse["categories"];
  /** Target-owned navigation shown only while choosing a live match. */
  introNavigation?: ReactNode;
  /** Target-owned effect after a validated terminal live snapshot; never score authority. */
  onLiveResult?: (view: LiveRaceView) => void;
  /** Stores native social. */
  nativeSocial?: NativeSocialCapability;
  /** Stores matchmaking. */
  matchmaking?: MatchmakingCapability;
  /** Stores player overlay. */
  playerOverlay?: OverlayCapability;
  /** Stores platform player id. */
  platformPlayerId?: string;
  /** Stores tournaments. */
  tournaments?: TournamentCapability;
  /** Stores context board. */
  contextBoard?: ContextBoardCapability;
}>;

/** Stable empty category list used as the default prop value. */
export const EMPTY_RACE_CATEGORIES: ListRaceCategoriesResponse["categories"] = [];
