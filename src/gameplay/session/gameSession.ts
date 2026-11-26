import {computeLetterStates} from "../rules/computeLetterStates";
import {computeFeedback} from "../rules/computeFeedback";
import {lowerCaseGraphemes, splitGraphemes} from "../input/graphemes";
import {type Feedback, type ScoredGuess} from "../contracts/scoring";
import type {BridgeRiddle, BridgeProfile} from "../../platform/bridge/messages";
import type {GameModal, GameSessionAction, GameSessionState, PendingGuessState} from "./gameSessionTypes";
import {predictCompletionAchievementIds} from "./completion/predictCompletionAchievements";
import {getConfirmedRiddleOutcome} from "./completion/ConfirmedRiddleOutcome";
import {isSingleAnswerCell} from "./answerCell";
import {markHintPreviewIntent, rejectHintPreview} from "./hintPreview";
import {parseCompletionRewardBreakdown} from "../../progression/rewards/completionRewardBreakdown";
import {createRequestId} from "./requestIds";
import {cacheLeaderboardPage, getFreshLeaderboardPage} from "../../leaderboards/browser/leaderboardCache";

export type {GameModal, GameSessionAction, GameSessionState, PendingGuessState} from "./gameSessionTypes";

/** Player-owned utility pages remain open while an authoritative question changes underneath them. */
const questionIndependentModals = new Set<GameModal>([
  "profile", "settings", "instructions", "credits", "about", "statistics",
  "achievements", "ranks", "leaderboard", "shop", "treasure", "username",
]);

/** Creates initial game session. */
export const createInitialGameSession = (): GameSessionState => ({
  draftRevision: {origin: createRequestId("draft"), sequence: 0},
  initialized: false,
  paused: false,
  locale: "en",
  gameMode: "classic",
  user: null,
  profile: null,
  pendingCoinSpend: null,
  products: [],
  leaderboard: [],
  leaderboardType: "xp",
  leaderboardPage: 0,
  leaderboardNextCursor: null,
  leaderboardCache: {},
  leaderboardLoading: false,
  leaderboardRequestId: null,
  leaderboardLoadError: false,
  riddle: null,
  canRestoreCheckpoint: false,
  currentLetters: [],
  activeSlotIndex: 0,
  hintRevealedIndices: [],
  guesses: [],
  guessPending: false,
  pendingGuessState: null,
  pendingHintState: null,
  engineSnapshot: null,
  modal: null,
  shopReturnModal: null,
  // The game must never start in the muted state. The mute control persists
  // changes after startup through setPlayerMuted.
  muted: false,
  notice: null,
  lastRewards: null,
  optimisticAchievementIds: [],
  auxiliaryFanfare: null,
  lastOutcome: null,
  completionAcknowledged: false,
  letterStates: {},
});

/** Normalizes input letter. */
const normalizeInputLetter = (letter: string, locale: string): string | null => {
  /** Provides graphemes behavior. */
  const graphemes = splitGraphemes(letter.trim());
  return graphemes[0]?.toLocaleUpperCase(locale) ?? null;
};

/** Runs profile coins. */
const withProfileCoins = (profile: BridgeProfile | null, coins?: number): BridgeProfile | null => {
  if (coins === undefined || !profile) {
    return profile;
  }

  return {...profile, coins};
};

/** Keeps a pending deduction visible while unrelated profile refreshes arrive. */
const preservePendingCoins = (state: GameSessionState, profile: BridgeProfile | null): BridgeProfile | null =>
  state.pendingCoinSpend ? withProfileCoins(profile, state.profile?.coins) : profile;

/** Compares issued content and authority state without depending on transferred object or key order. */
const sameIssuedRiddle = (first: BridgeRiddle | null, second: BridgeRiddle): boolean => {
  if (!first) return false;
  if (first === second) return true;
  if (first.sessionToken !== second.sessionToken || first.riddleId !== second.riddleId ||
    first.gameMode !== second.gameMode || first.index !== second.index || first.text !== second.text ||
    first.answerLength !== second.answerLength || first.attemptsUsed !== second.attemptsUsed ||
    first.hasUsedContinue !== second.hasUsedContinue || first.awaitingContinue !== second.awaitingContinue ||
    first.evaluation?.answer !== second.evaluation?.answer || first.evaluation?.locale !== second.evaluation?.locale) return false;
  /** Missing and empty hint/history lists carry the same authority state. */
  const hints = first.revealedHints ?? [];
  /** Transferred hint locks must still have identical positions and letters. */
  const nextHints = second.revealedHints ?? [];
  if (hints.length !== nextHints.length || hints.some(hint =>
    !nextHints.some(next => hint.index === next.index && hint.letter === next.letter))) return false;
  /** Complete accepted feedback must match before a current draft can survive a refresh. */
  const history = first.acceptedGuesses ?? [];
  /** Fresh accepted attempts still require the normal authoritative rebuild. */
  const nextHistory = second.acceptedGuesses ?? [];
  return history.length === nextHistory.length && history.every((row, index) =>
    row.attempt === nextHistory[index].attempt && row.feedback.length === nextHistory[index].feedback.length &&
    row.feedback.every((cell, position) => cell.letter === nextHistory[index].feedback[position].letter &&
      cell.status === nextHistory[index].feedback[position].status));
};

/** Account-owned guesses, rewards and session tokens cannot migrate through an identity notification. */
const resetAccountProgress = (state: GameSessionState): GameSessionState => ({
  ...createInitialGameSession(),
  initialized: state.initialized,
  paused: state.paused,
  locale: state.locale,
  gameMode: state.gameMode,
  products: state.products,
  muted: state.muted,
  leaderboardType: state.leaderboardType,
});

/** UID and creation generation together identify one gameplay account. */
const sameGameAccount = (first: GameSessionState["user"], second: GameSessionState["user"]): boolean =>
  first?.uid === second?.uid && first?.accountGeneration === second?.accountGeneration;

const clearLeaderboard = (): Pick<GameSessionState,
  "leaderboard" | "leaderboardPage" | "leaderboardNextCursor" | "leaderboardCache" |
  "leaderboardLoading" | "leaderboardRequestId" | "leaderboardLoadError"
> => ({
  leaderboard: [],
  leaderboardPage: 0,
  leaderboardNextCursor: null,
  leaderboardCache: {},
  leaderboardLoading: false,
  leaderboardRequestId: null,
  leaderboardLoadError: false,
});

/** Computes states. */
const computeStates = (guesses: ScoredGuess[], locale: string): Record<string, Feedback> => {
  return computeLetterStates(guesses.map(row => ({...row, guess: row.guess.map(letter => letter.toLocaleLowerCase(locale))})));
};

/** Purchased hint symbols remain known when guess history or a recovery checkpoint changes. */
const withConfirmedHintFeedback = (state: GameSessionState): GameSessionState => {
  /** Copy only when confirmed knowledge is absent from the current keyboard projection. */
  let letterStates = state.letterStates;
  for (const index of state.hintRevealedIndices) {
    if (index === state.pendingHintState?.index) continue;
    /** A locked slot without a glyph cannot establish keyboard knowledge. */
    const letter = state.currentLetters[index];
    if (!letter) continue;
    /** Immutable content locale owns the hinted symbol's keyboard identity. */
    const key = letter.toLocaleLowerCase(state.riddle?.evaluation?.locale ?? state.locale);
    if (letterStates[key] === "green") continue;
    if (letterStates === state.letterStates) letterStates = {...letterStates};
    letterStates[key] = "green";
  }
  return letterStates === state.letterStates ? state : {...state, letterStates};
};

/** Validates completion presentation before persisted metadata reaches UI effects or input gates. */
const hasUsablePendingMetadata = (base: PendingGuessState, state: GameSessionState): boolean => {
  /** Achievement lists are iterated by recovery capture and completion presentation. */
  const ids = (value: unknown): boolean => Array.isArray(value) && value.every(id => typeof id === "string");
  /** Economy presentation uses finite, nonnegative integer amounts and counters. */
  const amount = (value: unknown): boolean => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  /** Utility pages and the known gameplay dialogs are the only restorable modal discriminators. */
  const modal = base.modal === null || questionIndependentModals.has(base.modal) ||
    ["hint", "skip", "reward"].includes(base.modal) ||
    (base.modal === "victory" && base.lastOutcome?.kind === "win") ||
    (base.modal === "continue" && base.engineSnapshot?.attemptsUsed === 5 &&
      !base.engineSnapshot.gameOver && !base.engineSnapshot.hasUsedContinue);
  /** A saved outcome must identify this issued question, never a foreign completion. */
  const outcome = base.lastOutcome;
  /** Rewards remain a presentation record; grant authority stays with the host. */
  const rewards = base.lastRewards;
  return modal && typeof base.completionAcknowledged === "boolean" && ids(base.optimisticAchievementIds) &&
    (outcome === null ? !base.engineSnapshot?.gameOver : Boolean(outcome &&
      base.engineSnapshot?.gameOver === true && outcome.attempts === base.engineSnapshot.attemptsUsed &&
      typeof outcome.id === "string" && outcome.id.length > 0 &&
      (outcome.kind === "win" || outcome.kind === "loss") && outcome.riddleId === state.riddle?.riddleId &&
      outcome.sessionToken === state.riddle?.sessionToken && outcome.gameMode === state.riddle?.gameMode &&
      Number.isSafeInteger(outcome.attempts) && outcome.attempts >= 1 && outcome.attempts <= 6 &&
      outcome.isCorrect === (outcome.kind === "win"))) &&
    (rewards === null || Boolean(rewards && amount(rewards.coinsEarned) && ids(rewards.newlyUnlockedAchievementIds) &&
      (rewards.rewardBreakdown === undefined || parseCompletionRewardBreakdown(rewards.rewardBreakdown, rewards.coinsEarned)) &&
      [rewards.totalCoins, rewards.newXp, rewards.newLevel, rewards.newWinStreak].every(value => value === undefined || amount(value)) &&
      (rewards.leveledUp === undefined || typeof rewards.leveledUp === "boolean")));
};

/** Checks persisted board data before any scored row reaches feedback computation or rendering. */
const hasUsablePendingPresentation = (base: PendingGuessState, width: number, locale: string): boolean => {
  /** Saved cells may be empty only in the current, unsubmitted row. */
  const cells = (value: unknown, allowEmpty: boolean): boolean => Array.isArray(value) && value.length === width &&
    value.every(letter => (allowEmpty && letter === "") || isSingleAnswerCell(letter, locale));
  /** Feedback must remain aligned with each complete scored word. */
  const rows = (value: unknown): boolean => Array.isArray(value) && value.length <= 6 && value.every(row =>
    row && cells(row.guess, false) && Array.isArray(row.feedback) && row.feedback.length === width &&
    row.feedback.every((status: unknown) => status === "green" || status === "yellow" || status === "red"));
  return Boolean(base && cells(base.currentLetters, true) && rows(base.guesses) &&
    Number.isInteger(base.activeSlotIndex) && base.activeSlotIndex >= 0 && base.activeSlotIndex < width &&
    (base.engineSnapshot === null || (base.engineSnapshot && rows(base.engineSnapshot.guesses) &&
      Number.isSafeInteger(base.engineSnapshot.attemptsUsed) && base.engineSnapshot.attemptsUsed >= 0 &&
      base.engineSnapshot.attemptsUsed <= 6 && typeof base.engineSnapshot.hasUsedContinue === "boolean" &&
      typeof base.engineSnapshot.gameOver === "boolean")));
};

/** Restores only checkpoint-owned presentation; serialized extras cannot replace host or lifecycle ownership. */
const restorePendingPresentation = (state: GameSessionState, base: PendingGuessState): GameSessionState => {
  /** Keyboard knowledge is derived from validated rows instead of trusting an independent persisted map. */
  const {currentLetters, activeSlotIndex, guesses, engineSnapshot, modal, lastOutcome,
    completionAcknowledged, lastRewards, optimisticAchievementIds} = base;
  /** Rollback retains the accepted input's ordering when available. */
  const draftRevision = base.draftRevision ?? state.draftRevision;
  return {...state, draftRevision, currentLetters, activeSlotIndex, guesses, engineSnapshot, modal, lastOutcome,
    completionAcknowledged, lastRewards, optimisticAchievementIds,
    letterStates: computeStates(guesses, state.riddle?.evaluation?.locale ?? state.locale)};
};

/** Restores the visible round while keeping the paid Continue round's existing row reset. */
const recoveredGuesses = (riddle: BridgeRiddle): ScoredGuess[] | undefined =>
  riddle.acceptedGuesses?.filter(({attempt}) => !riddle.hasUsedContinue || attempt > 5)
    .map(({feedback}) => ({guess: feedback.map(({letter}) => letter), feedback: feedback.map(({status}) => status)}));

/** Provides first editable slot behavior. */
const firstEditableSlot = (letters: string[], locked: number[], start = 0): number => {
  for (let offset = 0; offset < letters.length; offset += 1) {
    /** Provides index behavior. */
    const index = (start + offset) % letters.length;
    if (!locked.includes(index) && !letters[index]) {
      return index;
    }
  }
  return Math.max(0, Math.min(start, letters.length - 1));
};

/** Provides previous editable slot behavior. */
const previousEditableSlot = (letters: string[], locked: number[], start: number): number | null => {
  for (let index = Math.min(start, letters.length - 1); index >= 0; index -= 1) {
    if (!locked.includes(index) && letters[index]) {
      return index;
    }
  }
  for (let index = letters.length - 1; index > start; index -= 1) {
    if (!locked.includes(index) && letters[index]) {
      return index;
    }
  }
  return null;
};

/** Resets attempt letters. */
const resetAttemptLetters = (state: GameSessionState): string[] =>
  state.riddle
    ? Array.from({length: state.riddle.answerLength}, (_, index) =>
        state.hintRevealedIndices.includes(index) ? (state.currentLetters[index] ?? "") : "",
      )
    : [];

/** Checks the current attempt budget, including only an already-granted Continue. */
export const hasRemainingGuessAttempts = (state: GameSessionState): boolean => {
  if (!state.riddle) return false;
  /** Projected attempts take precedence while their authoritative replies are pending. */
  const attemptsUsed = state.engineSnapshot?.attemptsUsed ?? state.riddle.attemptsUsed;
  /** A purchased Continue extends the same question's budget by one attempt. */
  const hasUsedContinue = state.engineSnapshot?.hasUsedContinue ?? state.riddle.hasUsedContinue;
  return attemptsUsed < 5 + Number(hasUsedContinue);
};

/** Whether a scored nonterminal guess permits drafting while confirmation is in flight. */
export const canDraftWhileConfirming = (state: GameSessionState): boolean =>
  Boolean(state.pendingGuessState && state.engineSnapshot && !state.engineSnapshot.gameOver &&
    hasRemainingGuessAttempts(state));

/** Automatic reward tabs leave gameplay available beneath them. */
export const isBlockingGameModal = (modal: GameModal): boolean => modal !== null && modal !== "reward";

/** Shared edit policy for physical keys, the on-screen keyboard, and slot selection. */
export const canEditCurrentGuess = (state: GameSessionState): boolean =>
  Boolean(hasRemainingGuessAttempts(state) && !isBlockingGameModal(state.modal) && !state.paused && !state.engineSnapshot?.gameOver &&
    (!state.guessPending || canDraftWhileConfirming(state)));

/** Provides game session reducer behavior. */
const reduceGameSession = (state: GameSessionState, action: GameSessionAction): GameSessionState => {
  switch (action.type) {
    case "hostInit": {
      /** Initialization can also arrive while recovering an account replacement. */
      const current = sameGameAccount(state.user, action.user) ? state : resetAccountProgress(state);
      return {
        ...current,
        initialized: true,
        locale: action.locale,
        gameMode: action.gameMode,
        user: action.user,
        profile: preservePendingCoins(current, action.profile),
        products: action.products,
      };
    }
    case "authState": {
      /** The same account used by the current operation. */
      const sameAccount = sameGameAccount(state.user, action.user);
      /** The same ranking used by the current operation. */
      const sameRanking = state.profile?.xp === action.profile?.xp &&
        state.profile?.level === action.profile?.level &&
        state.profile?.wins === action.profile?.wins &&
        state.profile?.multiplayerWins === action.profile?.multiplayerWins &&
        state.profile?.bestStreak === action.profile?.bestStreak &&
        state.profile?.username === action.profile?.username &&
        state.profile?.avatarUrl === action.profile?.avatarUrl;
      return {
        ...(sameAccount ? state : resetAccountProgress(state)),
        user: action.user,
        profile: sameAccount ? preservePendingCoins(state, action.profile) : action.profile,
        pendingCoinSpend: sameAccount ? state.pendingCoinSpend : null,
        ...(!sameAccount || !sameRanking ? clearLeaderboard() : {}),
      };
    }
    case "loadRiddle": {
      // Background or late host loads must not replace a completed question before
      // the player has dismissed its victory and achievement sequence.
      if (state.modal === "victory" && state.lastOutcome?.kind === "win") return state;
      if (action.preserveUnchanged && sameIssuedRiddle(state.riddle, action.riddle)) {
        /** Profile refreshes still apply without briefly clearing the board and restoring a checkpoint. */
        const profile = action.profile === undefined ? state.profile : preservePendingCoins(state, action.profile);
        /** Successful ordinary reloads retain the existing notice policy. */
        const notice = action.preserveNotice ? state.notice : null;
        return profile === state.profile && notice === state.notice && state.gameMode === action.riddle.gameMode
          ? state : {...state, gameMode: action.riddle.gameMode, profile, notice};
      }
      /** Host-accepted terminal progress survives absent, stale or unrelated provider checkpoints. */
      const confirmedOutcome = getConfirmedRiddleOutcome(action.riddle);
      /** Provides snapshot behavior. */
      const snapshot = {
        guesses: recoveredGuesses(action.riddle) ?? [],
        attemptsUsed: action.riddle.attemptsUsed,
        hasUsedContinue: action.riddle.hasUsedContinue,
        gameOver: Boolean(confirmedOutcome),
      };
      /** Server-owned paid hint locks survive missing or other-language provider checkpoints. */
      const hints = action.riddle.revealedHints ?? [];
      /** Grapheme cells preserve the issued answer shape and purchased hint locks. */
      const letters = Array.from({length: action.riddle.answerLength}, () => "");
      for (const hint of hints) letters[hint.index] = hint.letter;
      return withConfirmedHintFeedback({
        ...state,
        riddle: action.riddle,
        canRestoreCheckpoint: true,
        gameMode: action.riddle.gameMode,
        profile: action.profile === undefined ? state.profile : preservePendingCoins(state, action.profile),
        currentLetters: letters,
        activeSlotIndex: firstEditableSlot(letters, hints.map(({index}) => index)),
        hintRevealedIndices: hints.map(({index}) => index),
        guesses: snapshot.guesses,
        guessPending: false,
        pendingGuessState: null,
        pendingHintState: null,
        engineSnapshot: snapshot,
        modal: confirmedOutcome?.kind === "win" ? "victory" : questionIndependentModals.has(state.modal) ? state.modal
          : action.riddle.awaitingContinue ? "continue" : null,
        notice: action.preserveNotice ? state.notice : null,
        lastOutcome: confirmedOutcome,
        completionAcknowledged: false,
        lastRewards: null,
        optimisticAchievementIds: [],
        auxiliaryFanfare: null,
        letterStates: computeStates(snapshot.guesses, action.riddle.evaluation?.locale ?? state.locale),
      });
    }
    case "typeLetter": {
      if (!canEditCurrentGuess(state)) {
        return state;
      }
      /** Provides letter behavior. */
      const letter = normalizeInputLetter(action.letter, state.riddle?.evaluation?.locale ?? state.locale);
      if (!letter || state.hintRevealedIndices.includes(state.activeSlotIndex)) {
        return state;
      }
      /** Provides current letters behavior. */
      const currentLetters = [...state.currentLetters];
      currentLetters[state.activeSlotIndex] = letter;
      return {
        ...state,
        canRestoreCheckpoint: false,
        currentLetters,
        pendingHintState: markHintPreviewIntent(state.pendingHintState),
        activeSlotIndex: firstEditableSlot(
          currentLetters,
          state.hintRevealedIndices,
          (state.activeSlotIndex + 1) % currentLetters.length,
        ),
        notice: null,
      };
    }
    case "backspace": {
      if (!canEditCurrentGuess(state)) return state;
      /** Provides target behavior. */
      const target =
        !state.hintRevealedIndices.includes(state.activeSlotIndex) && state.currentLetters[state.activeSlotIndex]
          ? state.activeSlotIndex
          : previousEditableSlot(state.currentLetters, state.hintRevealedIndices, state.activeSlotIndex - 1);
      if (target === null) {
        return state;
      }
      /** Provides current letters behavior. */
      const currentLetters = [...state.currentLetters];
      currentLetters[target] = "";
      return {...state, canRestoreCheckpoint: false, currentLetters, activeSlotIndex: target,
        pendingHintState: markHintPreviewIntent(state.pendingHintState), notice: null};
    }
    case "selectSlot":
      if (
        !canEditCurrentGuess(state) ||
        !state.riddle ||
        action.index < 0 ||
        action.index >= state.riddle.answerLength ||
        state.hintRevealedIndices.includes(action.index)
      ) {
        return state;
      }
      return {...state, canRestoreCheckpoint: false, activeSlotIndex: action.index,
        pendingHintState: markHintPreviewIntent(state.pendingHintState)};
    case "guessRequested":
      if (!state.riddle || !hasRemainingGuessAttempts(state) || state.engineSnapshot?.gameOver ||
        (state.guessPending && !canDraftWhileConfirming(state)) ||
        state.currentLetters.some((letter) => !letter)) return state;
      if (state.riddle.evaluation) {
        /** Canonical scoring input preloaded with this riddle. */
        const {answer, locale} = state.riddle.evaluation;
        /** Submitted letters normalized using the content locale. */
        const guess = lowerCaseGraphemes(state.currentLetters.join("").trim(), locale).join("");
        /** Canonical answer normalized exactly as on the server. */
        const normalizedAnswer = lowerCaseGraphemes(answer.trim(), locale).join("");
        if (splitGraphemes(normalizedAnswer, locale).length !== state.riddle.answerLength) {
          return {...state, canRestoreCheckpoint: false, guessPending: true, notice: null};
        }
        /** Predicted attempt number; the server remains authoritative. */
        const attempts = (state.engineSnapshot?.attemptsUsed ?? 0) + 1;
        /** Immediate presentation result for the submitted answer. */
        const isCorrect = guess === normalizedAnswer;
        /** Whether server confirmation will be needed before offering a continue. */
        const canContinue = !isCorrect && attempts === 5 && !state.engineSnapshot?.hasUsedContinue;
        /** Predicted terminal state, excluding the paid-continue boundary. */
        const gameOver = isCorrect || (!canContinue && attempts >= 5 + (state.engineSnapshot?.hasUsedContinue ? 1 : 0));
        /** Immediate presentation before server confirmation. */
        const preview = gameSessionReducer({...state, pendingGuessState: null, guessPending: false}, {
          type: "guessResolved",
          feedback: {guess: splitGraphemes(guess, locale), feedback: computeFeedback(guess, normalizedAnswer)},
          attempts,
          isCorrect,
          canContinue,
          gameOver,
        });
        /** Confirmed gameplay fields retained for rejection or reconciliation. */
        const {currentLetters, activeSlotIndex, guesses, engineSnapshot, modal, lastOutcome, completionAcknowledged,
          letterStates, profile, lastRewards, optimisticAchievementIds, draftRevision} = state;
        return {
          ...preview,
          guessPending: true,
          pendingGuessState: state.pendingGuessState ?? {
            currentLetters, activeSlotIndex, guesses, engineSnapshot, modal, lastOutcome, completionAcknowledged,
            letterStates, profile, lastRewards, optimisticAchievementIds, draftRevision,
          },
        };
      }
      return {...state, canRestoreCheckpoint: false, guessPending: true, notice: null};
    case "guessPreviewConfirmed":
      return {...state, guessPending: false, pendingGuessState: null};
    case "restoreQueuedGuesses": {
      if (!state.riddle) return state;
      /** Corrupt presentation never retires the separately retained delivery receipts. */
      const usableBase = hasUsablePendingPresentation(action.base, state.riddle.answerLength, state.locale) &&
        hasUsablePendingMetadata(action.base, state) &&
        (!state.riddle.hasUsedContinue || action.base.engineSnapshot?.hasUsedContinue === true);
      // Pending-play receipts may settle after the host has already supplied their terminal history.
      if (getConfirmedRiddleOutcome(state.riddle)) return state;
      /** Journal gameplay is recoverable; its older profile must not replace the current host profile. */
      let restored: GameSessionState = {...(usableBase ? restorePendingPresentation(state, action.base) : state), profile: state.profile,
        guessPending: false, pendingGuessState: null, canRestoreCheckpoint: false};
      for (const [index, guess] of action.guesses.entries()) {
        /** The restored board already owns these attempt slots; delivery still retries the original receipt. */
        if (action.guessAttempts?.[index] !== undefined &&
          action.guessAttempts[index]! <= (restored.engineSnapshot?.attemptsUsed ?? 0)) continue;
        /** The letters used by the current operation. */
        const letters = splitGraphemes(guess, state.riddle.evaluation?.locale).map((letter) => letter.toLocaleUpperCase(state.riddle?.evaluation?.locale ?? state.locale));
        if (letters.length !== state.riddle.answerLength || restored.engineSnapshot?.gameOver) return state;
        restored = gameSessionReducer({...restored, currentLetters: letters}, {type: "guessRequested"});
      }
      if (action.draft.length === state.riddle.answerLength &&
        action.draft.every(letter => letter === "" || isSingleAnswerCell(letter, state.locale)) && !restored.engineSnapshot?.gameOver) {
        /** Legacy journals retain letters but omit the draft's selection. */
        const savedSlot = action.draftActiveSlotIndex;
        /** Editable selection is reconciled with authoritative purchased hint locks. */
        const activeSlotIndex = savedSlot !== undefined && Number.isInteger(savedSlot) &&
          savedSlot >= 0 && savedSlot < action.draft.length && !restored.hintRevealedIndices.includes(savedSlot)
          ? savedSlot
          : firstEditableSlot(action.draft, restored.hintRevealedIndices);
        restored = {...restored, currentLetters: action.draft, activeSlotIndex};
      }
      if (!restored.engineSnapshot?.gameOver && state.riddle.revealedHints?.length) {
        /** Current host hint letters remain authoritative even when the retained draft predates their purchase. */
        const currentLetters = [...restored.currentLetters];
        for (const hint of state.riddle.revealedHints) currentLetters[hint.index] = hint.letter;
        restored = {...restored,currentLetters,activeSlotIndex: state.hintRevealedIndices.includes(restored.activeSlotIndex)
          ? firstEditableSlot(currentLetters,state.hintRevealedIndices) : restored.activeSlotIndex};
      }
      // A saved gameplay checkpoint cannot dismiss a utility page opened since it was captured.
      return withConfirmedHintFeedback(questionIndependentModals.has(state.modal) ? {...restored, modal: state.modal} : restored);
    }
    case "restoreConfirmedRiddle": {
      // A rollback's older issued copy cannot reopen this already confirmed terminal round.
      if (state.riddle && getConfirmedRiddleOutcome(state.riddle) &&
        state.riddle.riddleId === action.riddle.riddleId && state.riddle.sessionToken === action.riddle.sessionToken &&
        state.riddle.gameMode === action.riddle.gameMode) return state;
      /** The loaded used by the current operation. */
      const loaded = gameSessionReducer(state, {type: "loadRiddle", riddle: action.riddle});
      if (loaded.riddle && (getConfirmedRiddleOutcome(loaded.riddle) ||
        !hasUsablePendingPresentation(action.base, loaded.riddle.answerLength, loaded.locale) ||
        !hasUsablePendingMetadata(action.base, loaded))) return loaded;
      return withConfirmedHintFeedback({...restorePendingPresentation(loaded, action.base), profile: loaded.profile, guessPending: false, pendingGuessState: null,
        canRestoreCheckpoint: false,
        currentLetters: action.base.currentLetters.map((letter, index) => loaded.hintRevealedIndices.includes(index)
          ? loaded.currentLetters[index] : letter),
        activeSlotIndex: loaded.hintRevealedIndices.includes(action.base.activeSlotIndex)
          ? loaded.activeSlotIndex : action.base.activeSlotIndex,
        modal: questionIndependentModals.has(state.modal) ? state.modal : action.base.modal,
        notice: null, lastRewards: null});
    }
    case "guessCheckpointAdvanced": {
      if (!state.pendingGuessState) return state;
      /** The checkpoint used by the current operation. */
      const checkpoint = gameSessionReducer({
        ...state, ...state.pendingGuessState, guessPending: false, pendingGuessState: null,
        draftRevision: state.pendingGuessState.draftRevision ?? state.draftRevision,
      }, {type: "guessResolved", feedback: action.feedback, attempts: action.attempts,
        isCorrect: action.isCorrect, gameOver: action.gameOver, canContinue: action.canContinue});
      /** The destructured result used by the current operation. */
      const {currentLetters, activeSlotIndex, guesses, engineSnapshot, modal, lastOutcome,
        completionAcknowledged, letterStates, profile, lastRewards, optimisticAchievementIds, draftRevision} = checkpoint;
      return {...state, pendingGuessState: {currentLetters, activeSlotIndex, guesses, engineSnapshot,
        modal, lastOutcome, completionAcknowledged, letterStates, profile, lastRewards, optimisticAchievementIds, draftRevision}};
    }
    case "guessFailed":
      return {...state, ...state.pendingGuessState, guessPending: false, pendingGuessState: null};
    case "guessResolved": {
      /** Preserve a next-answer draft typed while the prior row was being confirmed. */
      const draft = canDraftWhileConfirming(state) && !action.gameOver && !action.canContinue
        ? {currentLetters: state.currentLetters, activeSlotIndex: state.activeSlotIndex}
        : null;
      // Replace only speculative gameplay, preserving non-outcome surfaces opened in the meantime.
      if (state.pendingGuessState) state = {
        ...state,
        canRestoreCheckpoint: false, ...state.pendingGuessState,
        modal: state.lastOutcome ? state.pendingGuessState.modal : state.modal,
        pendingGuessState: null,
      };
      if (!state.riddle) return state;
      if (action.attempts <= (state.engineSnapshot?.attemptsUsed ?? 0)) {
        return {...state, ...draft, guessPending: false, pendingGuessState: null, notice: null};
      }
      /** Provides guesses behavior. */
      const guesses = [...state.guesses, action.feedback];
      /** Indicates whether is terminal. */
      const isTerminal = action.gameOver;
      /** Provides modal behavior. */
      const modal = action.isCorrect ? "victory" : action.canContinue ? "continue" : state.modal;
      /** Provides next letters behavior. */
      const nextLetters = resetAttemptLetters(state);
      /** Provides snapshot behavior. */
      const snapshot = {
        guesses,
        attemptsUsed: action.attempts,
        hasUsedContinue: state.engineSnapshot?.hasUsedContinue ?? false,
        gameOver: isTerminal,
      };
      /** Unlocks that can be presented without waiting for the reward transaction. */
      const optimisticAchievementIds = isTerminal
        ? predictCompletionAchievementIds(state.profile, {
            gameMode: state.riddle.gameMode,
            isCorrect: action.isCorrect,
            attempts: action.attempts,
            gameOver: true,
          })
        : [];
      /** Local profile projection used by achievements UI and provider cache. */
      const profile = optimisticAchievementIds.length > 0 && state.profile
        ? {...state.profile, achievements: [...new Set([...state.profile.achievements, ...optimisticAchievementIds])]}
        : state.profile;

      return withConfirmedHintFeedback({
        ...state,
        canRestoreCheckpoint: false,
        profile,
        currentLetters: draft?.currentLetters ?? nextLetters,
        activeSlotIndex: draft?.activeSlotIndex ?? firstEditableSlot(nextLetters, state.hintRevealedIndices),
        guesses,
        guessPending: false,
        pendingGuessState: null,
        engineSnapshot: snapshot,
        modal,
        notice: null,
        lastOutcome: isTerminal
          ? {
              id: `${state.riddle.sessionToken}-${action.isCorrect ? "win" : "loss"}-${action.attempts}`,
              kind: action.isCorrect ? "win" : "loss",
              riddleId: state.riddle.riddleId,
              gameMode: state.riddle.gameMode,
              sessionToken: state.riddle.sessionToken,
              attempts: action.attempts,
              isCorrect: action.isCorrect,
            }
          : state.lastOutcome,
        completionAcknowledged: isTerminal ? false : state.completionAcknowledged,
        optimisticAchievementIds,
        lastRewards: optimisticAchievementIds.length > 0
          ? {coinsEarned: 0, newlyUnlockedAchievementIds: optimisticAchievementIds}
          : state.lastRewards,
        letterStates: computeStates(guesses, state.riddle?.evaluation?.locale ?? state.locale),
      });
    }
    case "previewHint": {
      if (!state.riddle || state.pendingHintState || state.hintRevealedIndices.includes(action.index) ||
        !Number.isInteger(action.index) || action.index < 0 || action.index >= state.riddle.answerLength ||
        !isSingleAnswerCell(action.letter, state.riddle.evaluation?.locale ?? state.locale)) return state;
      /** Draft containing the provisional hint letter. */
      const nextLetters = [...state.currentLetters];
      /** Draft letter replaced by the provisional hint. */
      const previousLetter = nextLetters[action.index] ?? "";
      nextLetters[action.index] = action.letter.toLocaleUpperCase(state.riddle?.evaluation?.locale ?? state.locale);
      /** Hint positions including the provisional reveal. */
      const hintRevealedIndices = [...state.hintRevealedIndices, action.index].sort((a, b) => a - b);
      /** Automatic hint selection does not count as a later player cursor choice. */
      const activeSlotIndex = firstEditableSlot(nextLetters, hintRevealedIndices, action.index + 1);
      return {...state, currentLetters: nextLetters, hintRevealedIndices,
        activeSlotIndex,
        pendingHintState: {index: action.index, previousLetter, previousActiveSlotIndex: state.activeSlotIndex,
          hasPlayerIntent: false}};
    }
    case "rejectHint": {
      return rejectHintPreview(state);
    }
    case "applyHint": {
      if (state.pendingHintState) state = gameSessionReducer(state, {type: "rejectHint"});
      if (!state.riddle || !Number.isInteger(action.index) || action.index < 0 || action.index >= state.riddle.answerLength ||
        !isSingleAnswerCell(action.letter, state.riddle.evaluation?.locale ?? state.locale)) {
        return state;
      }
      /** Provides next letters behavior. */
      const nextLetters = [...state.currentLetters];
      while (nextLetters.length <= action.index) {
        nextLetters.push("");
      }
      /** Immutable evaluation repairs old default-cased receipts without altering their grant or identity. */
      const historicalDottedI = state.riddle.evaluation?.locale === "tr" && action.letter === "I" &&
        splitGraphemes(state.riddle.evaluation.answer.trim(), "tr")[action.index]?.toLocaleLowerCase("tr") === "i";
      nextLetters[action.index] = (historicalDottedI ? "İ" : action.letter).toLocaleUpperCase(state.riddle.evaluation?.locale ?? state.locale);
      /** Provides hint revealed indices behavior. */
      const hintRevealedIndices = [...new Set([...state.hintRevealedIndices, action.index])].sort(
        (left, right) => left - right,
      );
      return {
        ...state,
        currentLetters: nextLetters.slice(0, state.riddle.answerLength),
        activeSlotIndex: firstEditableSlot(nextLetters, hintRevealedIndices, action.index + 1),
        hintRevealedIndices,
        letterStates: {...state.letterStates,
          [nextLetters[action.index].toLocaleLowerCase(state.riddle.evaluation?.locale ?? state.locale)]: "green"},
        profile: withProfileCoins(state.profile, action.newCoins),
        pendingHintState: null,
        notice: null,
      };
    }
    case "coinsUpdated":
      return {...state, profile: withProfileCoins(state.profile, action.newCoins)};
    case "previewCoinSpend":
      if (state.pendingCoinSpend || !state.profile || !Number.isInteger(action.amount) ||
        action.amount <= 0 || state.profile.coins < action.amount) return state;
      if (action.reason === "continue" && (!state.riddle || !state.engineSnapshot ||
        state.engineSnapshot.attemptsUsed !== 5 || state.engineSnapshot.gameOver ||
        state.engineSnapshot.hasUsedContinue)) return state;
      {
        /** Gameplay checkpoint restored if the provisional Continue is rejected. */
        const continueState = action.reason === "continue" ? {
          draftRevision: state.draftRevision,
          currentLetters: state.currentLetters, activeSlotIndex: state.activeSlotIndex,
          guesses: state.guesses, engineSnapshot: state.engineSnapshot, modal: state.modal,
          lastOutcome: state.lastOutcome, completionAcknowledged: state.completionAcknowledged,
          letterStates: state.letterStates, profile: state.profile, lastRewards: state.lastRewards,
          optimisticAchievementIds: state.optimisticAchievementIds,
        } : undefined;
        /** Session with the local charge and, for Continue, immediate extra attempt. */
        const charged = {...state, profile: withProfileCoins(state.profile, state.profile.coins - action.amount),
          pendingCoinSpend: {requestId: action.requestId, previousCoins: state.profile.coins,
            continueState, sessionToken: continueState ? state.riddle?.sessionToken : undefined}};
        if (!continueState) return charged;
        /** Recovery grants the attempt before restoring letters typed during the interrupted charge. */
        const continued = gameSessionReducer(charged, {type: "continueGranted"});
        if (!action.draft || action.draft.length !== state.riddle?.answerLength ||
          !action.draft.every(letter => letter === "" || isSingleAnswerCell(letter, state.riddle?.evaluation?.locale ?? state.locale))) return continued;
        /** Paid hint positions remain authoritative when the interrupted Continue restores its draft. */
        const currentLetters = action.draft.map((letter, index) => continued.hintRevealedIndices.includes(index)
          ? continued.currentLetters[index] : letter);
        /** Previously selected editable slot in the continued-attempt draft. */
        const savedSlot = action.draftActiveSlotIndex;
        /** Valid restored selection, or the first slot that remains editable. */
        const activeSlotIndex = savedSlot !== undefined && Number.isInteger(savedSlot) &&
          savedSlot >= 0 && savedSlot < action.draft.length && !continued.hintRevealedIndices.includes(savedSlot)
          ? savedSlot : firstEditableSlot(currentLetters, continued.hintRevealedIndices);
        return {...continued, currentLetters, activeSlotIndex, draftRevision: action.draftRevision ?? continued.draftRevision};
      }
    case "confirmCoinSpend":
      if (state.pendingCoinSpend?.requestId !== action.requestId) return state;
      return {...state, profile: withProfileCoins(state.profile, action.newCoins), pendingCoinSpend: null};
    case "rejectCoinSpend":
      if (state.pendingCoinSpend?.requestId !== action.requestId) return state;
      {
        /** Only an unconfirmed Continue on the original round may restore its older gameplay checkpoint. */
        const checkpoint = state.pendingCoinSpend.continueState;
        /** New host grants, advanced history and terminal proofs outrank the rejected local preview. */
        const canRollback = checkpoint && state.riddle &&
          state.riddle.sessionToken === state.pendingCoinSpend.sessionToken && !state.riddle.hasUsedContinue &&
          !getConfirmedRiddleOutcome(state.riddle) &&
          state.riddle.attemptsUsed <= (checkpoint.engineSnapshot?.attemptsUsed ?? 0);
        /** Balance rejection remains separate from the freshness of the displayed round. */
        let restored = {...(canRollback ? restorePendingPresentation(state, checkpoint) : state),
          profile: withProfileCoins(state.profile, state.pendingCoinSpend.previousCoins), pendingCoinSpend: null};
        if (canRollback) {
          /** Preserve purchased glyphs that arrived from the host after the checkpoint was captured. */
          const currentLetters = [...restored.currentLetters];
          for (const hint of state.riddle!.revealedHints ?? []) currentLetters[hint.index] = hint.letter;
          restored = {...restored, currentLetters,
            activeSlotIndex: restored.hintRevealedIndices.includes(restored.activeSlotIndex)
              ? firstEditableSlot(currentLetters, restored.hintRevealedIndices) : restored.activeSlotIndex,
            modal: questionIndependentModals.has(state.modal) ? state.modal : restored.modal};
        }
        return withConfirmedHintFeedback(restored);
      }
    case "leaderboardRequested": {
      const page = action.page ?? 0;
      const samePage = state.leaderboardType === action.leaderboardType && state.leaderboardPage === page;
      return {
        ...state,
        leaderboardType: action.leaderboardType,
        leaderboardPage: page,
        leaderboard: samePage ? state.leaderboard : [],
        leaderboardNextCursor: samePage ? state.leaderboardNextCursor : null,
        leaderboardLoading: true,
        leaderboardRequestId: action.requestId ?? null,
        leaderboardLoadError: false,
      };
    }
    case "leaderboardPageSelected": {
      const cached = state.leaderboardCache[action.leaderboardType]?.[action.page];
      if (!cached) return state;
      return {
        ...state,
        leaderboardType: action.leaderboardType,
        leaderboardPage: action.page,
        leaderboard: cached.entries,
        leaderboardNextCursor: cached.nextCursor,
        leaderboardLoading: false,
        leaderboardRequestId: null,
        leaderboardLoadError: false,
      };
    }
    case "leaderboardLoaded":
      if (action.requestId && (!state.leaderboardLoading || state.leaderboardRequestId !== action.requestId)) return state;
      return {
        ...state,
        leaderboardType: action.leaderboardType,
        leaderboard: action.entries,
        leaderboardNextCursor: action.nextCursor ?? null,
        leaderboardCache: cacheLeaderboardPage(state.leaderboardCache, action.leaderboardType, state.leaderboardPage, {
          entries: action.entries,
          nextCursor: action.nextCursor ?? null,
          loadedAt: Date.now(),
        }),
        leaderboardLoading: false,
        leaderboardLoadError: false,
        leaderboardRequestId: null,
      };
    case "leaderboardLoadFailed":
      if (action.requestId && (!state.leaderboardLoading || state.leaderboardRequestId !== action.requestId)) return state;
      return {...state, leaderboardLoading: false, leaderboardLoadError: true, leaderboardRequestId: null};
    case "profileUpdated":
      return {...state, profile: preservePendingCoins(state, action.profile), ...clearLeaderboard()};
    case "completionReward":
      /** Keep server replayed unlocks from reopening an already-shown fanfare after loading another riddle. */
      const authoritativeAchievementIds = action.reward.newlyUnlockedAchievementIds.filter(
        (id) => !state.profile?.achievements.includes(id) || state.optimisticAchievementIds.includes(id),
      );
      return {
        ...state,
        lastRewards: {
          ...action.reward,
          newlyUnlockedAchievementIds: [
            ...state.optimisticAchievementIds,
            ...authoritativeAchievementIds.filter(id => !state.optimisticAchievementIds.includes(id)),
          ],
        },
        profile: state.profile
          ? {...state.profile, achievements: [...new Set([
              ...state.profile.achievements,
              ...action.reward.newlyUnlockedAchievementIds,
            ])]}
          : state.profile,
        optimisticAchievementIds: [],
        ...clearLeaderboard(),
      };
    case "completionAcknowledged":
      return {...state, completionAcknowledged: true};
    case "showAuxiliaryFanfare":
      return {...state, auxiliaryFanfare: action.fanfare, modal: "reward"};
    case "restoreSession":
      // Journal recovery and player edits outrank an older provider or retained checkpoint.
      if (!state.canRestoreCheckpoint || !state.riddle || action.riddleId !== state.riddle.riddleId ||
        action.sessionToken !== state.riddle.sessionToken || state.guessPending || state.lastOutcome ||
        (state.engineSnapshot?.attemptsUsed ?? 0) > state.riddle.attemptsUsed ||
        // A provider save may predate the replayed Continue grant for this session.
        (state.engineSnapshot?.hasUsedContinue && !state.riddle.hasUsedContinue) ||
        action.currentLetters.length !== state.riddle.answerLength) {
        return state;
      }
      {
        /** Provides guesses behavior. */
        const guesses = recoveredGuesses(state.riddle) ?? action.guesses.slice(0, state.riddle.attemptsUsed);
        /** Completion intent must still belong to the loaded round and its accepted attempt count. */
        const outcome = action.pendingOutcome;
        /** Provider completion intent cannot cross a round, mode or accepted attempt count. */
        const matchingOutcome = outcome?.riddleId === state.riddle.riddleId &&
          outcome.sessionToken === state.riddle.sessionToken && outcome.gameMode === state.riddle.gameMode &&
          outcome.attempts === state.riddle.attemptsUsed && action.engineSnapshot.gameOver;
        /** Eligible terminal intent remains deliverable using the original completion identity. */
        const pendingOutcome = getConfirmedRiddleOutcome(state.riddle) ??
          (matchingOutcome && outcome.kind === "loss" && !outcome.isCorrect &&
            state.riddle.awaitingContinue && !state.riddle.hasUsedContinue ? outcome : null);
        /** Provides awaiting continue behavior. */
        const awaitingContinue = state.riddle.awaitingContinue && !pendingOutcome;
        /** Accepted history proves whether a newer server attempt consumed the saved draft. */
        const locale = state.riddle.evaluation?.locale ?? state.locale;
        /** Latest canonical word owns the newly accepted attempt. */
        const acceptedGuess = guesses.at(-1);
        /** Older matching drafts must not become a second unsent copy of an accepted word. */
        const consumedDraft = Boolean(state.riddle.acceptedGuesses?.length &&
          action.engineSnapshot.attemptsUsed < state.riddle.attemptsUsed && acceptedGuess &&
          lowerCaseGraphemes(action.currentLetters.join(""), locale).join("") ===
          lowerCaseGraphemes(acceptedGuess.guess.join(""), locale).join(""));
        /** Consumed drafts clear editable cells while preserving purchased letters. */
        const currentLetters = awaitingContinue
          ? Array.from({length: state.riddle.answerLength}, () => "")
          : consumedDraft ? action.currentLetters.map((letter, index) =>
            action.hintRevealedIndices.includes(index) ? letter : "") : action.currentLetters;
        /** Provider snapshots may predate a paid hint; issued locks always take precedence. */
        const restoredLetters = [...currentLetters];
        /** Unique paid hint positions combine provider and authoritative recovery. */
        const hintIndices = [...new Set([...action.hintRevealedIndices,
          ...(state.riddle.revealedHints ?? []).map(({index}) => index)])];
        for (const hint of state.riddle.revealedHints ?? []) restoredLetters[hint.index] = hint.letter;
        /** Editable selection is reconciled with authoritative purchased hint locks. */
        const activeSlotIndex = consumedDraft || hintIndices.includes(action.activeSlotIndex)
          ? firstEditableSlot(restoredLetters, hintIndices) : action.activeSlotIndex;
        return withConfirmedHintFeedback({
          ...state,
          canRestoreCheckpoint: false,
          currentLetters: restoredLetters,
          activeSlotIndex: awaitingContinue ? 0 : activeSlotIndex,
          hintRevealedIndices: hintIndices,
          guesses,
          guessPending: false,
          pendingGuessState: null,
          engineSnapshot: {
            guesses,
            attemptsUsed: state.riddle.attemptsUsed,
            hasUsedContinue: state.riddle.hasUsedContinue,
            gameOver: Boolean(pendingOutcome),
          },
          modal: pendingOutcome ? pendingOutcome.kind === "win" ? "victory" : null : awaitingContinue ? "continue" : state.modal,
          lastOutcome: pendingOutcome,
          completionAcknowledged: false,
          letterStates: computeStates(guesses, state.riddle?.evaluation?.locale ?? state.locale),
        });
      }
    case "continueGranted": {
      if (!state.engineSnapshot) return state;
      /** Provides snapshot behavior. */
      const snapshot = {
        ...state.engineSnapshot,
        guesses: [],
        hasUsedContinue: true,
        gameOver: false,
      };
      /** Provides next letters behavior. */
      const nextLetters = resetAttemptLetters(state);
      return withConfirmedHintFeedback({
        ...state,
        guesses: snapshot.guesses,
        guessPending: false,
        pendingGuessState: null,
        engineSnapshot: snapshot,
        currentLetters: nextLetters,
        activeSlotIndex: firstEditableSlot(nextLetters, state.hintRevealedIndices),
        modal: null,
        notice: null,
        letterStates: {},
      });
    }
    case "declineContinue":
      if (state.modal !== "continue" || !state.riddle || !state.engineSnapshot) {
        return state;
      }
      return {
        ...state,
        modal: null,
        engineSnapshot: {...state.engineSnapshot, gameOver: true},
        lastOutcome: {
          id: `${state.riddle.sessionToken}-loss-${state.engineSnapshot.attemptsUsed}`,
          kind: "loss",
          riddleId: state.riddle.riddleId,
          gameMode: state.riddle.gameMode,
          sessionToken: state.riddle.sessionToken,
          attempts: state.engineSnapshot.attemptsUsed,
          isCorrect: false,
        },
        completionAcknowledged: false,
      };
    case "openModal": {
      // A delayed fifth-guess acknowledgement must not reopen a consumed Continue offer.
      if (action.modal === "continue" && state.engineSnapshot?.hasUsedContinue) return state;
      if (state.guessPending &&
        ((!canDraftWhileConfirming(state) && (action.modal === "hint" || action.modal === "skip")) ||
          (action.modal === "skip" && state.gameMode === "challenge"))) {
        return state;
      }
      const shopReturnModal = action.modal === "shop"
        ? state.modal === "profile" ? "profile" : state.modal === "shop" ? state.shopReturnModal : null
        : null;
      if (action.modal === "leaderboard") {
        const cached = getFreshLeaderboardPage(state.leaderboardCache, state.leaderboardType, state.leaderboardPage);
        return {...state, modal: action.modal, shopReturnModal,
          leaderboard: cached?.entries ?? [],
          leaderboardNextCursor: cached?.nextCursor ?? null,
          leaderboardLoading: !cached,
          leaderboardLoadError: false};
      }
      return {...state, modal: action.modal, shopReturnModal};
    }
    case "closeModal":
      return {
        ...state,
        // Commerce dismissal does not decide an unresolved paid-continue boundary.
        modal: (state.modal === "shop" || state.modal === "reward") && state.shopReturnModal
          ? state.shopReturnModal : state.riddle && !state.lastOutcome && state.engineSnapshot?.attemptsUsed === 5 &&
          !state.engineSnapshot.hasUsedContinue && !state.engineSnapshot.gameOver ? "continue" : null,
        shopReturnModal: null,
        auxiliaryFanfare: state.modal === "reward" ? null : state.auxiliaryFanfare,
      };
    case "setNotice":
      return {...state, notice: action.notice};
    case "toggleMute":
      return {...state, muted: !state.muted};
    case "pause":
      return {...state, paused: true};
    case "resume":
      return {...state, paused: false};
    default:
      action satisfies never;
      return state;
  }
};

/** Advances input ordering without using wall clocks or presentation-only renders. */
export const gameSessionReducer = (state: GameSessionState, action: GameSessionAction): GameSessionState => {
  /** Rejected actions and presentation updates keep their existing input revision. */
  let next = reduceGameSession(state, action);
  if (next === state) return state;
  if (next.shopReturnModal && next.modal !== "shop" && next.modal !== "reward")
    next = {...next, shopReturnModal: null};
  if ((action.type === "restoreSession" || action.type === "restoreQueuedGuesses") && action.draftRevision)
    return {...next, draftRevision: action.draftRevision};
  if (action.type !== "typeLetter" && action.type !== "backspace" && action.type !== "selectSlot") return next;
  if (next.draftRevision !== state.draftRevision ||
    (next.activeSlotIndex === state.activeSlotIndex && next.currentLetters.length === state.currentLetters.length &&
      next.currentLetters.every((letter, index) => letter === state.currentLetters[index]))) return next;
  return {...next, draftRevision: {...state.draftRevision,
    sequence: Math.min(Number.MAX_SAFE_INTEGER, state.draftRevision.sequence + 1)}};
};

/** Gets current guess value. */
export const getCurrentGuessValue = (state: GameSessionState): string => {
  return lowerCaseGraphemes(state.currentLetters.join(""), state.riddle?.evaluation?.locale ?? state.locale).join("");
};
