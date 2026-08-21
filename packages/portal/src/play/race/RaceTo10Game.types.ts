import type {GameToHostMessage} from "@qwordly/core/bridge";
import type {ListRaceCategoriesResponse, RaceLocale} from "@qwordly/core/race";
import type {
  ContextBoardCapability,
  MatchmakingCapability,
  NativeSocialCapability,
  OverlayCapability,
  TournamentCapability,
} from "../../platform/types";

/** Inputs required by the server-authoritative Race to 10 coordinator. */
export type RaceTo10GameProps = Readonly<{
  locale: RaceLocale;
  challengeId?: string;
  openInbox?: boolean;
  coins: number;
  postToHost: (message: GameToHostMessage) => void;
  onClose: () => void;
  initialCategories?: ListRaceCategoriesResponse["categories"];
  nativeSocial?: NativeSocialCapability;
  matchmaking?: MatchmakingCapability;
  playerOverlay?: OverlayCapability;
  platformPlayerId?: string;
  tournaments?: TournamentCapability;
  contextBoard?: ContextBoardCapability;
}>;

/** Stable empty category list used as the default prop value. */
export const EMPTY_RACE_CATEGORIES: ListRaceCategoriesResponse["categories"] = [];
