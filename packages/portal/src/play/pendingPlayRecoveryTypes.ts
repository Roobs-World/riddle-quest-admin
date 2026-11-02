import type {Dispatch, MutableRefObject} from "react";
import type {BridgeRiddle, GameToHostMessage} from "@qwordly/core/bridge";
import type {SavedGame} from "../platform/types";
import type {GameSessionAction, GameSessionState} from "@qwordly/hosted/play/gameSessionTypes";
import type {GameFeedbackKind} from "./game/hooks/useGameAudio";

/** Host sender captured by a committed account visit. */
type PostToHost = (message: GameToHostMessage) => void;
export type {PendingPlayClock, PendingPlayRecoveryAdapters} from "@qwordly/hosted/play/pendingPlayAdapters";
import type {PendingPlayRecoveryAdapters} from "@qwordly/hosted/play/pendingPlayAdapters";
/** Stable adapters, rendered state and host sender for one recovery coordinator. */
export type RecoveryOptions = {
  /** Stable storage and time adapters for the mounted recovery owner. */
  adapters?: PendingPlayRecoveryAdapters;
  /** Stores state. */
  state: GameSessionState;
  /** Stores state ref. */
  stateRef: MutableRefObject<GameSessionState>;
  /** Stores restored game. */
  restoredGame?: SavedGame | null;
  /** Stores dispatch. */
  dispatch: Dispatch<GameSessionAction>;
  /** Stores post to host. */
  postToHost: PostToHost;
  /** Stores play feedback. */
  playFeedback: (kind: GameFeedbackKind) => void;
};

/** Correlates an in-flight answer with its issued question and confirmed row count. */
export type PendingAnswer = {
    /** Stores riddle id. */
    riddleId: string;
    /** Stores guess. */
    guess: string;
    /** Stores request id. */
    requestId: string;
    /** Confirmed row count before sending this guess. */
    guesses: number;
  };

/** Binds a restored draft to its question and the render preceding restoration. */
export type RestoredJournal = {
    /** Account generation and locale owning the restored segment. */ scope: string;
    /** Issued question whose draft was restored. */ sessionToken: string;
    /** Exact loaded host riddle distinguishes a refreshed same-session reconcile reply. */ riddle: BridgeRiddle;
    /** Render preceding restoration must not overwrite its durable draft. */ before: GameSessionState;
  };

/** Binds one explicit extra-attempt Submit click to its paid receipt. */
export type ContinueSubmit = {
    /** Committed account and sender lifetime admitting the click. */ owner: object;
    /** Account generation and language owning the answer. */ scope: string;
    /** Paid Continue request whose accepted receipt permits delivery. */ requestId: string;
    /** Authority-issued question owning this answer. */ sessionToken: string;
    /** Editing the answer cancels automatic delivery. */ guess: string;
    /** Only a validated successful Continue receipt admits the answer. */ status: "waiting" | "accepted";
  };

/** Allows one successor load after the exact Skip receipt settles. */
export type SkipLoad = {
    /** Accepted paid request. */
    requestId: string;
    /** Question being left behind. */
    sessionToken: string;
    /** Issued predecessor bounds the accepted successor index. */
    riddle: BridgeRiddle;
  };

/** Names the speculative successor owned by one paid Skip. */
export type SkipPreview = {
    /** Request that loaded the provisional successor. */ requestId: string;
    /** Session being skipped. */ sessionToken: string;
  };

/** Holds a confirmed successor until its predecessor's Skip settles. */
export type EarlySkipLoad = {
    /** Paid Skip request awaiting confirmation. */ requestId: string;
    /** Server-confirmed successor. */ riddle: BridgeRiddle;
    /** Issued predecessor used to recheck ownership when the paid receipt arrives. */ origin: BridgeRiddle;
  };

/** Correlates a fallback answer when durable journalling is unavailable. */
export type DirectGuess = {
    /** Correlated fallback request. */ requestId: string;
    /** Account generation and content locale at submission. */ scope: string | null;
    /** Authority-issued question at submission. */ sessionToken: string;
  };

/** Pins one committed account and sender visit for stale-callback rejection. */
export type DeliveryOwner = {
    /** Scope admitted by this commit. */
    scope: string | null;
    /** The sender identity also retires a same-scope writer before layout cleanup. */
    postToHost: PostToHost;
  };
