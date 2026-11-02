import type {BridgeRiddle} from "@riddle-quest/core/bridge";
import type {AuthSnapshot, CompletionResult, HostServices, WebGameMode} from "@riddle-quest/hosted/hostTypes";
import {createInitialGameSession, gameSessionReducer} from "@riddle-quest/hosted/play/gameSession";
import {capturePendingBase, clearPendingGuessJournal, pendingPlayScope, writePendingGuessJournal, type PendingGuessJournal, type QueuedGuess} from "@riddle-quest/hosted/play/pendingGuessJournal";
import {readPendingGuessJournal} from "@riddle-quest/hosted/play/readPendingGuessJournal";
import {deleteYouTubeAnswerLetter, insertYouTubeAnswerText} from "@riddle-quest/solo";
import type {AndroidPendingPlayStorage} from "./pendingPlayStorage";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
/** Positional colour of one accepted letter, matching the shared single-player feedback names. */
export type HostedFeedback = "green" | "yellow" | "red";
/** One accepted guess as the server scored it. */
export type HostedGuessRow = Readonly<{
  /** Submitted letters in slot order. */
  letters: readonly string[];
  /** Positional colours. */
  feedback: readonly HostedFeedback[];
}>;
/** Stable notice codes the screen localizes. */
export type HostedGameNotice = "answer-incomplete" | "insufficient-coins" | "operation-failed" | "service-unavailable";
/** Observable state of one hosted Classic or Daily session. */
export type HostedGameState =
  | {
      /** The session is loading or reloading. */
      kind: "loading";
    }
  | {
      /** No puzzle can be played right now. */
      kind: "unavailable";
      /** Why: today's Daily is done, or the load failed. */
      code: "daily-completed" | "load-failed";
    }
  | {
      /** A puzzle is active. */
      kind: "playing";
      /** Server-issued riddle. */
      riddle: BridgeRiddle;
      /** Accepted guesses so far. */
      rows: readonly HostedGuessRow[];
      /** Draft letters merged with revealed hints. */
      displayLetters: readonly string[];
      /** Slot the next typed letter fills. */
      activeSlot: number;
      /** Slots locked by purchased hints. */
      hintedSlots: readonly number[];
      /** Server-counted attempts. */
      attempts: number;
      /** Whether the paid extra attempt is being offered. */
      awaitingContinue: boolean;
      /** Whether the extra attempt has already been used. */
      hasUsedContinue: boolean;
      /** Whether a server operation is in flight. */
      busy: boolean;
      /** Latest notice for the screen. */
      notice: HostedGameNotice | null;
    }
  | {
      /** The server confirmed the outcome. */
      kind: "complete";
      /** Completed riddle. */
      riddle: BridgeRiddle;
      /** Accepted guesses. */
      rows: readonly HostedGuessRow[];
      /** Confirmed rewards. */
      result: CompletionResult;
    };
/** Optional device adapters for {@link useHostedGame}. */
export type HostedGameOptions = Readonly<{
  /** Provisional Play journal; without it drafts and in-flight guesses live only in memory. */
  journal?: AndroidPendingPlayStorage;
}>;
/** Controller returned by {@link useHostedGame}. */
export type HostedGameController = Readonly<{
  /** Current session state. */
  state: HostedGameState;
  /** Latest account snapshot from the shared services. */
  account: AuthSnapshot;
  /** Inserts committed text into the draft. */
  insertText: (text: string) => void;
  /** Deletes the active draft letter. */
  backspace: () => void;
  /** Moves the cursor to a slot. */
  setActiveSlot: (index: number) => void;
  /** Submits the draft to the server. */
  submit: () => void;
  /** Buys a hint letter. */
  hint: () => void;
  /** Buys the extra attempt. */
  buyContinue: () => void;
  /** Declines the extra attempt and settles the loss. */
  finish: () => void;
  /** Skips the current Classic riddle for coins. */
  skip: () => void;
  /** Loads the next puzzle, or retries after a failure. */
  next: () => void;
}>;
/** The active-puzzle variant of {@link HostedGameState}. */
type PlayingState = Extract<HostedGameState, PlayingTag>;
/** Discriminant of the active-puzzle variant. */
type PlayingTag = {
  /** Variant tag. */
  kind: "playing";
};
/** Error shape carrying a stable host or callable code. */
type CodedError = {
  /** Stable code. */
  code: unknown;
};
/** Reads a stable error code when one is attached. */
const errorCode = (error: unknown): string =>
  typeof error === "object" && error !== null && "code" in error ? String((error as CodedError).code) : "";
/** Global shape exposing the optional Web Crypto UUID generator. */
type RandomUuidHost = {
  /** Web Crypto, when the runtime provides it. */
  crypto?: {
    /** Generates a version 4 UUID. */
    randomUUID?: () => string;
  };
};
/** Builds a request identity accepted by the backend's replay-safe schemas. */
export const createHostedRequestId = (prefix: string): string => {
  /** Host crypto when the runtime provides it. */
  const webCrypto = (globalThis as RandomUuidHost).crypto;
  if (webCrypto && typeof webCrypto.randomUUID === "function") return `${prefix}-${webCrypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
};
/** Rows recovered from an issued riddle's accepted guesses. */
const recoveredRows = (riddle: BridgeRiddle): HostedGuessRow[] =>
  (riddle.acceptedGuesses ?? []).map((guess) => ({
    letters: guess.feedback.map((cell) => cell.letter),
    feedback: guess.feedback.map((cell) => cell.status),
  }));
/** Hint letters recovered from an issued riddle. */
const recoveredHints = (riddle: BridgeRiddle): Map<number, string> =>
  new Map((riddle.revealedHints ?? []).map((hint) => [hint.index, hint.letter]));
/** Merges typed letters with hint letters. */
const project = (draft: readonly string[], hints: Map<number, string>, length: number): string[] =>
  Array.from({length}, (_, index) => hints.get(index) ?? draft[index] ?? "");
/** First slot without a hint or letter. */
const firstEditable = (letters: readonly string[], hints: Map<number, string>): number => {
  /** Index of the first open slot, or the end. */
  const open = letters.findIndex((letter, index) => !hints.has(index) && !letter);
  return open >= 0 ? open : Math.max(0, letters.length - 1);
};
/** Whether a failed delivery may be retried with the same request id later. */
const retryable = (error: unknown): boolean => {
  /** Stable code when the host attached one. */
  const code = errorCode(error);
  return code === "" || code === "unavailable" || code === "deadline-exceeded" || code === "internal";
};
/** Whether a journal belongs to the issued question. */
const sameRound = (recorded: BridgeRiddle, riddle: BridgeRiddle): boolean =>
  recorded.riddleId === riddle.riddleId && recorded.sessionToken === riddle.sessionToken && recorded.gameMode === riddle.gameMode;
/** Builds the shared journal record for the issued question from the reducer's confirmed base. */
const journalFor = (scope: string, riddle: BridgeRiddle, queue: QueuedGuess[], draft: readonly string[], slot: number): PendingGuessJournal => ({
  version: 1,
  scope,
  riddle,
  confirmedClassicIndex: riddle.index ?? 0,
  base: capturePendingBase(gameSessionReducer(createInitialGameSession(), {type: "loadRiddle", riddle})),
  successors: [],
  queue,
  draft: Array.from({length: riddle.answerLength}, (_, index) => draft[index] ?? ""),
  draftActiveSlotIndex: slot,
});
/** Maps a thrown host error to a notice code. */
const noticeFor = (error: unknown): HostedGameNotice => {
  /** Stable code when the host attached one. */
  const code = errorCode(error);
  if (code === "deadline-exceeded" || code === "unavailable") return "service-unavailable";
  if (code === "failed-precondition" || code === "resource-exhausted") return "insufficient-coins";
  return "operation-failed";
};
/**
 * Drives one server-authoritative Classic or Daily session through the shared host services.
 *
 * @remarks
 * Every material transition (guess, hint, continue, skip, completion) is a
 * backend call; this hook only keeps the draft and the server's accepted facts.
 */
export function useHostedGame(services: HostServices, mode: WebGameMode, locale: string, options: HostedGameOptions = {}): HostedGameController {
  /** Session state. */
  const [state, setState] = useState<HostedGameState>({kind: "loading"});
  /** Latest account snapshot. */
  const [account, setAccount] = useState<AuthSnapshot>({user: null, profile: null});
  /** Latest account snapshot for callbacks. */
  const accountRef = useRef<AuthSnapshot>({user: null, profile: null});
  /** Journal storage, when the device provides one. */
  const journal = options.journal;
  /** Journal scope for the signed-in account and locale, once known. */
  const scopeRef = useRef<string | null>(null);
  /** Guess sent but not yet confirmed; redelivered with the same request id. */
  const pendingRef = useRef<QueuedGuess | null>(null);
  /** Draft letters by slot. */
  const draftRef = useRef<string[]>([]);
  /** Revealed hints by slot. */
  const hintsRef = useRef(new Map<number, string>());
  /** Cursor slot. */
  const slotRef = useRef(0);
  /** Whether a server call is running. */
  const busyRef = useRef(false);
  /** Whether the hook is mounted. */
  const mounted = useRef(true);
  /** Increments when a new load supersedes older responses. */
  const generation = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(
    () =>
      services.auth.subscribe((snapshot) => {
        accountRef.current = snapshot;
        setAccount(snapshot);
      }),
    [services],
  );
  /** Journals the draft and any unconfirmed guess for the issued question. */
  const record = useCallback(
    (riddle: BridgeRiddle) => {
      if (!journal || !scopeRef.current) return;
      writePendingGuessJournal(journalFor(scopeRef.current, riddle, pendingRef.current ? [pendingRef.current] : [], draftRef.current, slotRef.current), journal, true);
    },
    [journal],
  );
  /** Clears the journal once the question is settled or left. */
  const forget = useCallback(() => {
    pendingRef.current = null;
    if (journal && scopeRef.current) clearPendingGuessJournal(scopeRef.current, journal);
  }, [journal]);

  /** Publishes the playing state from the current refs. */
  const publish = useCallback((riddle: BridgeRiddle, rows: readonly HostedGuessRow[], patch: Partial<PlayingState> = {}) => {
    /** Projected letters. */
    const displayLetters = project(draftRef.current, hintsRef.current, riddle.answerLength);
    setState((current) => ({
      kind: "playing",
      riddle,
      rows,
      displayLetters,
      activeSlot: slotRef.current,
      hintedSlots: [...hintsRef.current.keys()],
      attempts: current.kind === "playing" ? current.attempts : riddle.attemptsUsed,
      awaitingContinue: current.kind === "playing" ? current.awaitingContinue : riddle.awaitingContinue,
      hasUsedContinue: current.kind === "playing" ? current.hasUsedContinue : riddle.hasUsedContinue,
      busy: busyRef.current,
      notice: current.kind === "playing" ? current.notice : null,
      ...patch,
    }));
  }, []);
  /** Reads the journal for the issued question, discarding one left by another question. */
  const recover = useCallback(
    async (riddle: BridgeRiddle): Promise<PendingGuessJournal | null> => {
      /** Signed-in account owning the journal. */
      const user = accountRef.current.user;
      scopeRef.current = user ? pendingPlayScope(user.uid, user.accountGeneration, locale) : null;
      if (!journal || !scopeRef.current) return null;
      await journal.hydrate(scopeRef.current);
      /** Validated journal for this account and locale. */
      const recorded = readPendingGuessJournal(scopeRef.current, journal);
      if (recorded && sameRound(recorded.riddle, riddle)) return recorded;
      if (recorded) clearPendingGuessJournal(scopeRef.current, journal);
      return null;
    },
    [journal, locale],
  );
  /** Redelivers the journaled guess once the restored question is on screen. */
  const redeliverRef = useRef<() => void>(() => undefined);
  /** Loads the current puzzle for the mode. */
  const load = useCallback(() => {
    /** Load generation that owns the response. */
    const token = ++generation.current;
    setState({kind: "loading"});
    void services
      .loadRiddle({gameMode: mode, locale, authoritative: mode === "classic"})
      .then(async (riddle) => {
        /** Journal left by an interrupted session on this question. */
        const recorded = await recover(riddle);
        if (!mounted.current || token !== generation.current) return;
        hintsRef.current = recoveredHints(riddle);
        draftRef.current = (recorded?.draft ?? []).map((letter, index) => (hintsRef.current.has(index) ? "" : letter));
        /** Letters as restored. */
        const letters = project(draftRef.current, hintsRef.current, riddle.answerLength);
        slotRef.current =
          recorded?.draftActiveSlotIndex !== undefined && !hintsRef.current.has(recorded.draftActiveSlotIndex)
            ? recorded.draftActiveSlotIndex
            : firstEditable(letters, hintsRef.current);
        pendingRef.current = recorded?.queue[0] ?? null;
        busyRef.current = false;
        setState({
          kind: "playing",
          riddle,
          rows: recoveredRows(riddle),
          displayLetters: letters,
          activeSlot: slotRef.current,
          hintedSlots: [...hintsRef.current.keys()],
          attempts: riddle.attemptsUsed,
          awaitingContinue: riddle.awaitingContinue,
          hasUsedContinue: riddle.hasUsedContinue,
          busy: false,
          notice: null,
        });
        if (pendingRef.current) redeliverRef.current();
      })
      .catch((error: unknown) => {
        if (!mounted.current || token !== generation.current) return;
        setState({kind: "unavailable", code: errorCode(error) === "daily-completed" ? "daily-completed" : "load-failed"});
      });
  }, [locale, mode, recover, services]);
  useEffect(load, [load]);

  /** Runs one server operation against the active riddle with busy and notice bookkeeping. */
  const operate = useCallback(
    (operation: (riddle: BridgeRiddle, rows: readonly HostedGuessRow[]) => Promise<void>) => {
      setState((current) => {
        if (current.kind !== "playing" || busyRef.current) return current;
        busyRef.current = true;
        /** Generation that owns the operation. */
        const token = generation.current;
        void operation(current.riddle, current.rows)
          .catch((error: unknown) => {
            if (mounted.current && token === generation.current) {
              setState((latest) => (latest.kind === "playing" ? {...latest, notice: noticeFor(error)} : latest));
            }
          })
          .finally(() => {
            busyRef.current = false;
            if (mounted.current && token === generation.current) {
              setState((latest) => (latest.kind === "playing" ? {...latest, busy: false} : latest));
            }
          });
        return {...current, busy: true, notice: null};
      });
    },
    [],
  );
  /** Settles the riddle with the server and shows the confirmed outcome. */
  const complete = useCallback(
    async (riddle: BridgeRiddle, rows: readonly HostedGuessRow[]) => {
      /** Confirmed completion. */
      const result = await services.completeGame({riddleId: riddle.riddleId, gameMode: riddle.gameMode, sessionToken: riddle.sessionToken});
      forget();
      if (mounted.current) setState({kind: "complete", riddle, rows, result});
    },
    [forget, services],
  );
  /** Edits the draft and republishes. */
  const edit = useCallback(
    (change: (current: PlayingState) => void) => {
      setState((current) => {
        if (current.kind !== "playing" || current.awaitingContinue) return current;
        change(current);
        /** Editing the answer cancels redelivery of the unconfirmed guess. */
        pendingRef.current = null;
        record(current.riddle);
        return {
          ...current,
          displayLetters: project(draftRef.current, hintsRef.current, current.riddle.answerLength),
          activeSlot: slotRef.current,
        };
      });
    },
    [record],
  );
  /** Delivers the draft, or redelivers the journaled guess, with one replay-safe request id. */
  const submit = useCallback(
    () =>
      operate(async (riddle, rows) => {
        /** Letters as the player sees them. */
        const letters = project(draftRef.current, hintsRef.current, riddle.answerLength);
        if (!pendingRef.current && letters.some((letter) => !letter)) {
          setState((latest) => (latest.kind === "playing" ? {...latest, notice: "answer-incomplete"} : latest));
          return;
        }
        /** Replay-safe id for a new delivery. */
        const requestId = createHostedRequestId("guess");
        /** Guess to deliver: the journaled one when it exists, otherwise the current draft. */
        const queued: QueuedGuess = pendingRef.current ?? {
          message: {
            type: "game:submitGuess",
            requestId,
            payload: {riddleId: riddle.riddleId, gameMode: riddle.gameMode, sessionToken: riddle.sessionToken, guess: letters.join(""), requestId},
          },
          attempts: rows.length + 1,
          isCorrect: false,
          gameOver: false,
          canContinue: false,
          feedback: [],
        };
        pendingRef.current = queued;
        record(riddle);
        /** Server-scored guess. */
        let result;
        try {
          result = await services.submitGuess(queued.message.payload);
        } catch (error) {
          if (!retryable(error)) {
            pendingRef.current = null;
            record(riddle);
          }
          throw error;
        }
        pendingRef.current = null;
        /** Rows including this guess. */
        const nextRows = [...rows, {letters: result.feedback.map((cell) => cell.letter), feedback: result.feedback.map((cell) => cell.status)}];
        draftRef.current = [];
        slotRef.current = firstEditable(project([], hintsRef.current, riddle.answerLength), hintsRef.current);
        if (result.gameOver || result.isCorrect) {
          await complete(riddle, nextRows);
          return;
        }
        record(riddle);
        publish(riddle, nextRows, {attempts: result.attempts, awaitingContinue: result.canContinue === true});
      }),
    [complete, operate, publish, record, services],
  );
  redeliverRef.current = submit;

  return useMemo<HostedGameController>(
    () => ({
      state,
      account,
      insertText: (text) =>
        edit((current) => {
          /** Edited draft. */
          const next = insertYouTubeAnswerText(
            {letters: draftRef.current, activeSlotIndex: slotRef.current},
            text,
            current.riddle.answerLength,
            [...hintsRef.current.keys()],
            locale,
          );
          draftRef.current = next.letters;
          slotRef.current = next.activeSlotIndex;
        }),
      backspace: () =>
        edit((current) => {
          /** Edited draft. */
          const next = deleteYouTubeAnswerLetter({letters: draftRef.current, activeSlotIndex: slotRef.current}, current.riddle.answerLength, [
            ...hintsRef.current.keys(),
          ]);
          draftRef.current = next.letters;
          slotRef.current = next.activeSlotIndex;
        }),
      setActiveSlot: (index) =>
        edit(() => {
          if (!hintsRef.current.has(index)) slotRef.current = index;
        }),
      submit,
      hint: () =>
        operate(async (riddle, rows) => {
          /** Purchased hint. */
          const hint = await services.requestHint({
            riddleId: riddle.riddleId,
            gameMode: riddle.gameMode,
            sessionToken: riddle.sessionToken,
            requestId: createHostedRequestId("hint"),
            currentAttempt: project(draftRef.current, hintsRef.current, riddle.answerLength),
          });
          if (!hint) return;
          hintsRef.current = new Map(hintsRef.current).set(hint.index, hint.revealedLetter);
          if (slotRef.current === hint.index) slotRef.current = firstEditable(project(draftRef.current, hintsRef.current, riddle.answerLength), hintsRef.current);
          record(riddle);
          publish(riddle, rows);
        }),
      buyContinue: () =>
        operate(async (riddle, rows) => {
          await services.spendCoins({
            reason: "continue",
            gameMode: riddle.gameMode,
            riddleId: riddle.riddleId,
            sessionToken: riddle.sessionToken,
            requestId: createHostedRequestId("continue"),
          });
          publish(riddle, rows, {awaitingContinue: false, hasUsedContinue: true});
        }),
      finish: () => operate((riddle, rows) => complete(riddle, rows)),
      skip: () =>
        operate(async (riddle) => {
          await services.skipRiddle({riddleId: riddle.riddleId, gameMode: riddle.gameMode, sessionToken: riddle.sessionToken, requestId: createHostedRequestId("skip")});
          forget();
          load();
        }),
      next: load,
    }),
    [account, complete, edit, forget, load, locale, operate, publish, record, services, state, submit],
  );
}
