import type {RaceMatchResponse, RaceMatchRequest, RaceMatchFailure, RaceLocale} from "@riddle-quest/core/race";

/** Expected provider outcomes shared by hosted target adapters. */
export type PlatformResult<T> =
  | {
      /** Stores status. */
      status: "success"; /** Stores value. */
      /** Stores value. */
      value: T;
    }
  | {
      /** Stores status. */
      status: "cancelled";
    }
  | {
      /** Stores status. */
      status: "retryable-failure"; /** Stores message. */
      /** Stores message. */
      message: string;
    }
  | {
      /** Stores status. */
      status: "terminal-failure"; /** Stores message. */
      /** Stores message. */
      message: string;
    }
  | {
      /** Stores status. */
      status: "unavailable"; /** Stores message. */
      /** Stores message. */
      message: string;
    };

/** Provider-wide, server-authoritative offline opponent selection. */
export type MatchmakingResult = PlatformResult<RaceMatchResponse> & {
  /** Optional for legacy adapters; new adapters preserve the structured recovery policy. */
  failure?: RaceMatchFailure;
};

/** Provider-wide, server-authoritative offline opponent selection. */
export type MatchmakingCapability = {
  /** Authenticated live PvP transport, only on supported targets. */
  live?: import("@riddle-quest/core/race").LiveRaceCapability;
  /**
   * Finds an identity-minimized offline opponent through the authoritative backend.
   *
   * @param input - Locale, category preference, and optional retry correlation.
   */
  find(input: RaceMatchRequest | RaceLocale): Promise<MatchmakingResult>;
};

