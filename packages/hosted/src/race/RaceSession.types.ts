import type {GameToHostMessage} from "@riddle-quest/core/bridge";
import type {ScoredGuess} from "@riddle-quest/core/game";
import type {RaceEntryResponse, ListRaceCategoriesResponse, PublishRaceChallengeResponse, RaceAnalyticsEventName, RaceChallengePreview, RaceInboxItem, RaceLocale, RaceOutcome, RaceRunView} from "@riddle-quest/core/race";
import type {RacePlayClock} from "./RacePlay";
import type {RaceMatchFailure} from "@riddle-quest/core/race";
import type {RaceDraftStorage} from "./logic/raceDraftStorage";
import type {RaceRecoveryPersistence} from "./logic/raceRecoveryStorage";
import type {MatchmakingCapability} from "./matchmaking";
import type {RaceOperation} from "./logic/raceOperations";

/** Screens in one player-owned Race Session. */
export type RaceStage = "categories" | "challenge" | "inbox" | "tournaments" | "countdown" | "racing" | "result";
/** Inputs whose replacement invalidates the entire Race Session. */
export type RaceSessionEntry = Readonly<{
  /** Account owning the attempt and resume hint. */ ownerId?: string;
  /** Content language for all session commands. */ locale: RaceLocale;
  /** Incoming challenge intent. */ challengeId?: string;
  /** Initial activity-screen intent. */ openInbox?: boolean;
  /** Incoming tournament language; provider capabilities are checked before entering. */ tournamentLocale?: RaceLocale;
  /** Previously validated lobby catalog. */ initialCategories?: ListRaceCategoriesResponse["categories"];
}>;
/** Stable observable state; protocol refs and provisional checkpoints remain private. */
export type RaceSessionState = Readonly<{
  /** Current screen. */ stage: RaceStage;
  /** Attempted challenge. */ activeChallengeId?: string;
  /** Typed challenge/invitation readiness. */ entryStatus: RaceEntryResponse | null;
  /** Latest challenge preview. */ challenge: RaceChallengePreview | null;
  /** Latest catalog. */ categories: ListRaceCategoriesResponse["categories"];
  /** Latest activity results. */ inboxItems: RaceInboxItem[];
  /** Run owned by this session. */ run: RaceRunView | null;
  /** Projected or authoritative outcome. */ outcome: RaceOutcome | null;
  /** Monotonic receipt anchor for the run. */ receivedAtMs: number;
  /** Locally displayed time. */ adjustedNow: number;
  /** Current answer draft. */ currentLetters: string[];
  /** Selected editable slot. */ activeSlotIndex: number;
  /** Scored guess history for the displayed riddle. */ raceGuesses: ScoredGuess[];
  /** Transient answer feedback. */ feedback: "correct" | "incorrect" | null;
  /** Translation key for the transient penalty. */ penaltyFlash: string | null;
  /** Existing translated key for a recoverable player-facing error. */ error: string | null;
  /** Translation key for completed safety action. */ safetyNotice: string | null;
  /** Rival targeted by the current safety receipt. */ safetyTargetUserId: string | null;
  /** Current correlated host operation. */ pending: RaceOperation | null;
  /** Minimum-duration guess loader. */ raceGuessLoading: boolean;
  /** Whether projected successor input is editable. */ allowTypingWhilePending: boolean;
  /** Uncertain gameplay delivery must reconcile before another mutation. */ requiresRunRefresh: boolean;
  /** Numbered countdown or Go. */ countdown: number;
  /** Preparation progress. */ loadingProgress: number;
  /** Completion indicator has finished its display interval. */ countdownReady: boolean;
  /** Close intent retained until preparation or abandonment settles. */ closeAfterStart: boolean;
  /** Active-run quit confirmation. */ quitConfirmationOpen: boolean;
  /** Deferred publication intent. */ publishRequested: boolean;
  /** Confirmed publication. */ published: PublishRaceChallengeResponse | null;
  /** Provider discovery in flight. */ findingOpponent: boolean;
  /** Distinguishes search recovery from unrelated lobby operation errors. */ matchSearchStatus: "idle" | "searching" | "matched" | "empty" | "failed";
  /** Validated search failure and prescribed recovery. */ matchFailure: RaceMatchFailure | null;
  /** Monotonic retry delay has elapsed and recovery is permitted. */ matchRetryReady: boolean;
}>;
/** Side effects delivered only after validated session transitions. */
export type RaceSessionEffect =
  | {
    /** Effect kind. */ kind: "close"}
  | {
    /** Effect kind. */ kind: "outcome";
    /** Confirmed completion. */ outcome: RaceOutcome}
  | {
    /** Effect kind. */ kind: "publication";
    /** Confirmed publication. */ publication: PublishRaceChallengeResponse;
    /** Queued share intent. */ share: boolean}
  | {
    /** Effect kind. */ kind: "analytics";
    /** Schema-constrained event. */ event: RaceAnalyticsEventName;
    /** Event parameters. */ params: Record<string, string | number | boolean>};
/** Real host, persistence and browser clocks have deterministic adapters in tests. */
export type RaceSessionOptions = {
  /** Bridge delivery may complete synchronously or reject through its promise. */ postToHost: (message: GameToHostMessage) => void | Promise<void>;
  /** Optional browser effects cannot reject an accepted authority response. */ effect?: (effect: RaceSessionEffect) => void | Promise<void>;
  /** Monotonic timer adapter. */ clock?: RacePlayClock;
  /** Polling jitter adapter, bounded by the session policy. */ random?: () => number;
  /** Mutation/correlation receipt factory. */ requestId?: (operation: string) => string;
  /** Current authenticated recorded-match adapter, resolved again after reload. */ getMatchmaking?: () => MatchmakingCapability | undefined;
  /** Wall clock for bounded local retention and retry-delay recovery. */ wallNow?: () => number;
  /** Optional bounded unsent-input cache; never scoring or run authority. */ draftStorage?: RaceDraftStorage;
  /** Minimal owner-bound journey journal. */ recovery?: RaceRecoveryPersistence;
  /** Account-bound resume adapter. */ persistence?: {
    /** Reads an owned hint; undefined means storage could not be observed. */ read: (ownerId?: string) => string | null | undefined;
    /** Stores an authority-issued run. */ save: (ownerId: string | undefined, runId: string) => void;
    /** Clears the expected owned run without deleting a newer hint. */ clear: (ownerId?: string, runId?: string) => void;
  };
};
