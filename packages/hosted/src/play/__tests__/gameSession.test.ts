import {describe, expect, it} from "@jest/globals";
import type {BridgeRiddle} from "@qwordly/core/bridge";
import type {SavedGame} from "../savedGame";
import {
  createInitialGameSession,
  canEditCurrentGuess,
  gameSessionReducer,
  getCurrentGuessValue,
  type GameSessionAction,
  type GameSessionState,
} from "../gameSession";
import {createSavedGame} from "../GameSessionCheckpoints";
import type {PendingGuessState} from "../gameSessionTypes";

it("starts with sound enabled when no sound preference is saved", () => {
  expect(createInitialGameSession().muted).toBe(false);
});

/** Provides riddle behavior. */
const riddle = {
  riddleId: "classic-1",
  sessionToken: "00000000-0000-4000-8000-000000000001",
  text: "What has keys but cannot open doors?",
  answerLength: 5,
  gameMode: "classic" as const,
  index: 1,
  attemptsUsed: 0,
  hasUsedContinue: false,
  awaitingContinue: false,
};

/** Provides reduce behavior. */
const reduce = (state: GameSessionState, action: GameSessionAction) => gameSessionReducer(state, action);

/** Resolves guess. */
const resolveGuess = (
  state: GameSessionState,
  guess: string,
  attempts: number,
  {isCorrect = false, gameOver = false, canContinue = false} = {},
) =>
  reduce(reduce(state, {type: "guessRequested"}), {
    type: "guessResolved",
    feedback: {
      guess: [...guess.toUpperCase()],
      feedback: [...guess].map(() => (isCorrect ? ("green" as const) : ("red" as const))),
    },
    attempts,
    isCorrect,
    gameOver,
    canContinue,
  });

describe("game session reducer", () => {
  it.each([null, "reward", "shop", "victory"] as const)(
    "allows answer input beneath automatic rewards but respects blocking dialogs (%s)", modal => {
      /** Loaded puzzle whose editing policy follows its active surface. */
      const state = {...reduce(createInitialGameSession(), {type: "loadRiddle", riddle}), modal};
      expect(canEditCurrentGuess(state)).toBe(modal === null || modal === "reward");
      expect(reduce(state, {type: "typeLetter", letter: "P"}).currentLetters[0]).toBe(
        modal === null || modal === "reward" ? "P" : "",
      );
    },
  );
  it("keeps a purchase reward from unlocking an exhausted attempt until Continue is granted", () => {
    /** Issued question stopped at its unpaid Continue boundary. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: {
      ...riddle, attemptsUsed: 5, awaitingContinue: true, evaluation: {answer: "piano", locale: "en"},
    }});
    state = reduce(state, {type: "openModal", modal: "shop"});
    state = reduce(state, {type: "showAuxiliaryFanfare", fanfare: {
      id: "purchase-at-continue", kind: "purchase", coinsAwarded: 250, totalCoins: 500, achievementIds: [],
    }});
    expect(state.modal).toBe("reward");
    expect(canEditCurrentGuess(state)).toBe(false);
    expect(reduce(state, {type: "typeLetter", letter: "P"}).currentLetters).toEqual(["", "", "", "", ""]);
    /** A retained full draft cannot bypass the same attempt boundary through submission. */
    const blocked = reduce({...state, currentLetters: [..."PIANO"]}, {type: "guessRequested"});
    expect(blocked.engineSnapshot?.attemptsUsed).toBe(5);
    expect(blocked.lastOutcome).toBeNull();
    expect(blocked.guessPending).toBe(false);

    state = reduce(state, {type: "closeModal"});
    expect(state.modal).toBe("continue");
    state = reduce(state, {type: "continueGranted"});
    expect(canEditCurrentGuess(state)).toBe(true);
    for (const letter of "PIANO") state = reduce(state, {type: "typeLetter", letter});
    state = reduce(state, {type: "guessRequested"});
    expect(state.modal).toBe("victory");
    expect(state.lastOutcome).toEqual(expect.objectContaining({kind: "win", attempts: 6}));
    expect(state.guessPending).toBe(true);
    state = reduce(state, {type: "guessResolved", attempts: 6, isCorrect: true, gameOver: true, canContinue: false,
      feedback: {guess: [..."piano"], feedback: ["green", "green", "green", "green", "green"]}});
    expect(state.guesses).toHaveLength(1);
    expect(state.guessPending).toBe(false);
    expect(state.lastOutcome).toEqual(expect.objectContaining({kind: "win", attempts: 6}));
  });
  it.each(["profile", "settings", "instructions", "credits", "about", "statistics",
    "achievements", "ranks", "leaderboard", "shop", "treasure", "username"] as const)(
    "keeps %s open when journal restoration or rollback replaces gameplay", (modal) => {
      /** Gameplay captured before the player opened a utility page. */
      const initial = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});
      /** Gameplay fields owned by the pre-modal pending journal. */
      const {currentLetters, activeSlotIndex, guesses, engineSnapshot, lastOutcome,
        completionAcknowledged, letterStates, profile, lastRewards, optimisticAchievementIds} = initial;
      /** Journal snapshot replacing gameplay without changing utility-page ownership. */
      const base: PendingGuessState = {currentLetters, activeSlotIndex, guesses, engineSnapshot,
        modal: null, lastOutcome, completionAcknowledged, letterStates, profile,
        lastRewards, optimisticAchievementIds};
      /** Current utility page that recovery must keep open. */
      const open = reduce(initial, {type: "openModal", modal});
      /** Queued guesses restored while retaining the active utility page. */
      const restored = reduce(open, {type: "restoreQueuedGuesses", base, guesses: [], draft: ["P", "", "", "", ""]});
      expect(restored.modal).toBe(modal);
      expect(restored.currentLetters).toEqual(["P", "", "", "", ""]);
      /** Authority-issued replacement prompt for rollback. */
      const replacement = {...riddle, riddleId: "confirmed-replacement", sessionToken: "confirmed-session-replacement"};
      /** Confirmed prompt restored without closing the current utility page. */
      const rolledBack = reduce(open, {type: "restoreConfirmedRiddle", riddle: replacement, base});
      expect(rolledBack.riddle).toEqual(replacement);
      expect(rolledBack.modal).toBe(modal);
      expect(reduce(rolledBack, {type: "closeModal"}).modal).toBeNull();
    },
  );
  it.each([false, true])("keeps current host hint letters when restoring an older draft (valid width=%s)", validWidth => {
    /** Older gameplay checkpoint predates the host's hint grant. */
    const prior = reduce(createInitialGameSession(), {type: "loadRiddle",riddle: {...riddle,evaluation: {answer: "clock",locale: "en"}}});
    /** Journal owns gameplay fields but cannot remove a newly confirmed hint. */
    const base = {currentLetters: prior.currentLetters,activeSlotIndex: prior.activeSlotIndex,guesses: prior.guesses,
      engineSnapshot: prior.engineSnapshot,modal: prior.modal,lastOutcome: prior.lastOutcome,
      completionAcknowledged: prior.completionAcknowledged,letterStates: prior.letterStates,
      profile: prior.profile,lastRewards: prior.lastRewards,optimisticAchievementIds: prior.optimisticAchievementIds};
    /** Current authoritative load contains the purchased hint before journal restoration. */
    let state = reduce(prior, {type: "loadRiddle",riddle: {...riddle,evaluation: {answer: "clock",locale: "en"},revealedHints: [{index: 2,letter: "o"}]}});
    state = reduce(state, {type: "restoreQueuedGuesses",base,guesses: [],draft: validWidth ? ["C", "L", "X", "", ""] : [],draftActiveSlotIndex: 2});
    expect(state.currentLetters).toEqual(validWidth ? ["C", "L", "o", "", ""] : ["", "", "o", "", ""]);
    expect(state.hintRevealedIndices).toEqual([2]);
    expect(state.activeSlotIndex).not.toBe(2);
    state = reduce(state, {type: "selectSlot",index: 2});
    state = reduce(state, {type: "typeLetter",letter: "Z"});
    expect(state.currentLetters[2]).toBe("o");
  });

  it.each([false, true])("rolls back rejected gameplay without replacing the acknowledged host profile (profile available=%s)", available => {
    /** Current server profile includes the completed predecessor's balance and progression. */
    const profile = {username: "Current",coins: 325,level: 3,xp: 510,winStreak: 2,
      gamesPlayed: 8,wins: 6,achievements: ["first_win"],classicIndex: 2};
    /** Successor loaded under the current host profile before rejection. */
    let state = reduce(createInitialGameSession(), {type: "hostInit",locale: "en",gameMode: "classic",
      user: {uid: "player",isAnonymous: false},products: [],profile: available ? profile : null});
    state = reduce(state, {type: "loadRiddle",riddle});
    /** Old gameplay base is valid for rollback, while its profile is no longer current. */
    const base = {currentLetters: state.currentLetters,activeSlotIndex: state.activeSlotIndex,guesses: state.guesses,
      engineSnapshot: state.engineSnapshot,modal: state.modal,lastOutcome: state.lastOutcome,
      completionAcknowledged: state.completionAcknowledged,letterStates: state.letterStates,
      profile: {...profile,username: "Older",coins: 300,xp: 420,gamesPlayed: 7,wins: 5,classicIndex: 1},
      lastRewards: state.lastRewards,optimisticAchievementIds: state.optimisticAchievementIds};
    state = reduce(state, {type: "restoreConfirmedRiddle",riddle,base});
    expect(state.profile).toEqual(available ? profile : null);
    expect(state.currentLetters).toEqual(Array(5).fill(""));
    expect(state.guesses).toEqual([]);
  });

  it.each([false, true])("restores journal gameplay without replacing the host profile (profile available=%s)", available => {
    /** Newer host profile carries the acknowledged predecessor's balance and progress. */
    const profile = {username: "Current", coins: 325, level: 3, xp: 510, winStreak: 2,
      gamesPlayed: 8, wins: 6, achievements: ["first_win"], classicIndex: 2};
    /** Actual next-question reducer state is loaded before applying the retained journal. */
    let state = reduce(createInitialGameSession(), {type: "hostInit",locale: "en",gameMode: "classic",
      user: {uid: "player",isAnonymous: false},products: [],profile: available ? profile : null});
    state = reduce(state, {type: "loadRiddle",riddle: {...riddle,index: 2,evaluation: {answer: "clock",locale: "en"}}});
    /** Older journal still owns its draft and rows, but cannot replace authoritative profile fields. */
    const base = {currentLetters: state.currentLetters,activeSlotIndex: state.activeSlotIndex,guesses: state.guesses,
      engineSnapshot: state.engineSnapshot,modal: state.modal,lastOutcome: state.lastOutcome,
      completionAcknowledged: state.completionAcknowledged,letterStates: state.letterStates,
      profile: {...profile,username: "Older",coins: 300,xp: 420,gamesPlayed: 7,wins: 5,classicIndex: 1},
      lastRewards: state.lastRewards,optimisticAchievementIds: state.optimisticAchievementIds};
    state = reduce(state, {type: "restoreQueuedGuesses",base,guesses: ["ZZZZZ"],draft: ["C", "L", "", "", ""],draftActiveSlotIndex: 2});
    expect(state.profile).toEqual(available ? profile : null);
    expect(state.guesses[0]?.guess.join("")).toBe("zzzzz");
    expect(state.currentLetters.join("")).toBe("CL");
    expect(state.activeSlotIndex).toBe(2);
    expect(state.pendingGuessState?.profile).toEqual(available ? profile : null);
  });

  it.each(["authState", "hostInit"] as const)("retires the previous player's victory on %s", type => {
    /** Account whose terminal outcome must be retired. */
    const alice = {uid: "alice", isAnonymous: false, accountGeneration: 1};
    /** Replacement account owning the next riddle. */
    const bob = {uid: "bob", isAnonymous: false, accountGeneration: 1};
    /** Authoritative replacement balance and progression. */
    const profile = {username: "Bob", coins: 800, level: 1, xp: 0,
      winStreak: 0, gamesPlayed: 0, wins: 0, achievements: [], classicIndex: 2};
    /** Gameplay state spanning the account replacement. */
    let state = reduce(createInitialGameSession(), {type: "hostInit", locale: "en", gameMode: "classic",
      user: alice, products: [], profile: null});
    state = reduce(state, {type: "loadRiddle", riddle});
    state = resolveGuess(state, "PIANO", 1, {isCorrect: true, gameOver: true});
    state = reduce(state, type === "authState" ? {type, user: bob, profile} :
      {type, locale: "en", gameMode: "classic", user: bob, profile, products: []});
    expect(state.riddle).toBeNull();
    expect(state.modal).toBeNull();
    expect(state.lastOutcome).toBeNull();
    expect(state.currentLetters).toEqual([]);
    expect(state.profile?.coins).toBe(800);
    /** New content can load after the old modal retires. */
    const nextRiddle = {...riddle, riddleId: "classic-2", index: 2};
    expect(reduce(state, {type: "loadRiddle", riddle: nextRiddle}).riddle).toEqual(nextRiddle);
  });

  it("preserves drafts on profile refresh and clears them for a recreated account", () => {
    /** UID reused across independently created accounts. */
    const user = {uid: "alice", isAnonymous: false, accountGeneration: 1};
    /** Gameplay state spanning the account replacement. */
    let state = reduce(createInitialGameSession(), {type: "hostInit", locale: "en", gameMode: "classic",
      user, products: [], profile: null});
    state = reduce(state, {type: "loadRiddle", riddle});
    state = reduce(state, {type: "typeLetter", letter: "P"});
    expect(reduce(state, {type: "authState", user, profile: null}).currentLetters[0]).toBe("P");
    expect(reduce(state, {type: "authState", user: {...user, accountGeneration: 2}, profile: null}).riddle).toBeNull();
  });

  it.each(["profile", "settings", "instructions", "credits", "about", "statistics",
    "achievements", "ranks", "leaderboard", "shop", "treasure", "username"] as const)(
    "keeps the user-opened %s page when a delayed locale question arrives", (modal) => {
      /** Current question before the player changes language and opens a utility page. */
      let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});
      state = reduce(state, {type: "hostInit", locale: "pt", gameMode: "classic",
        user: state.user, profile: state.profile, products: state.products});
      state = reduce(state, {type: "openModal", modal});
      /** Delayed authoritative question for the newly selected language. */
      const localized = {...riddle, riddleId: "classic-1-pt", sessionToken: "locale-session-pt",
        text: "Qual instrumento tem teclas?"};
      state = reduce(state, {type: "loadRiddle", riddle: localized});
      expect(state.riddle).toEqual(localized);
      expect(state.modal).toBe(modal);
      expect(reduce(state, {type: "typeLetter", letter: "P"}).currentLetters).toEqual(state.currentLetters);
      expect(reduce(state, {type: "closeModal"}).modal).toBeNull();
    },
  );

  it("defers a restored Continue offer until the user closes their Profile page", () => {
    /** Profile opened while the host is still restoring an exhausted session. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});
    state = reduce(state, {type: "openModal", modal: "profile"});
    state = reduce(state, {type: "loadRiddle", riddle: {...riddle, attemptsUsed: 5, awaitingContinue: true}});
    expect(state.modal).toBe("profile");
    expect(reduce(state, {type: "closeModal"}).modal).toBe("continue");
  });

  it.each(["hint", "skip", "continue"] as const)(
    "closes the old question's %s choice when a playable replacement arrives", (modal) => {
      /** Question-specific action that must not survive a different issued question. */
      let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});
      state = reduce(state, {type: "openModal", modal});
      state = reduce(state, {type: "loadRiddle", riddle: {...riddle, riddleId: "replacement"}});
      expect(state.modal).toBeNull();
    },
  );

  it("keeps the victory sequence open when a late riddle arrives", () => {
    /** Provides state behavior. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});
    state = resolveGuess(state, "PIANO", 1, {isCorrect: true, gameOver: true});
    /** Provides next riddle behavior. */
    const nextRiddle = {...riddle, riddleId: "classic-2", sessionToken: "00000000-0000-4000-8000-000000000002", index: 2};
    expect(reduce(state, {type: "loadRiddle", riddle: nextRiddle})).toBe(state);
    state = reduce(state, {type: "closeModal"});
    expect(reduce(state, {type: "loadRiddle", riddle: nextRiddle}).riddle).toEqual(nextRiddle);
  });

  it("shows one 100-coin charge immediately, keeps it through stale profiles, and reconciles by request", () => {
    /** Guest account used to exercise the local charge. */
    let state = reduce(createInitialGameSession(), {type: "hostInit", locale: "en", gameMode: "classic",
      user: null, products: [], profile: {username: "Guest", coins: 250, level: 1, xp: 0,
        winStreak: 0, gamesPlayed: 0, wins: 0, achievements: [], classicIndex: 1}});
    /** Profile returned by a delayed request started before the charge. */
    const originalProfile = state.profile!;
    state = reduce(state, {type: "previewCoinSpend", requestId: "skip-1", amount: 100});
    expect(state.profile?.coins).toBe(150);
    expect(reduce(state, {type: "previewCoinSpend", requestId: "skip-1", amount: 100})).toBe(state);
    state = reduce(state, {type: "authState", user: null, profile: originalProfile});
    state = reduce(state, {type: "loadRiddle", riddle, profile: originalProfile});
    expect(state.profile?.coins).toBe(150);
    expect(reduce(state, {type: "confirmCoinSpend", requestId: "other", newCoins: 1})).toBe(state);
    state = reduce(state, {type: "confirmCoinSpend", requestId: "skip-1", newCoins: 125});
    expect(state.profile?.coins).toBe(125);
    expect(state.pendingCoinSpend).toBeNull();
    state = reduce(state, {type: "previewCoinSpend", requestId: "continue-1", amount: 100});
    expect(state.profile?.coins).toBe(25);
    state = reduce(state, {type: "rejectCoinSpend", requestId: "continue-1"});
    expect(state.profile?.coins).toBe(125);
    expect(state.pendingCoinSpend).toBeNull();
  });

  it("previews a hint without saving it and restores only its slot if the charge fails", () => {
    /** Session state used by this assertion. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: {
      ...riddle, evaluation: {answer: "piano", locale: "en"},
    }});
    state = reduce(state, {type: "typeLetter", letter: "C"});
    state = reduce(state, {type: "previewHint", index: 0, letter: "P"});
    expect(state.currentLetters[0]).toBe("P");
    expect(state.hintRevealedIndices).toEqual([0]);
    expect(createSavedGame(state)?.currentLetters[0]).toBe("C");
    expect(createSavedGame(state)?.hintRevealedIndices).toEqual([]);
    state = reduce(state, {type: "typeLetter", letter: "A"});
    state = reduce(state, {type: "rejectHint"});
    expect(state.currentLetters.slice(0, 2)).toEqual(["C", "A"]);
    expect(state.hintRevealedIndices).toEqual([]);
  });

  it.each(["hint", "skip"] as const)("opens %s while a wrong answer is awaiting confirmation", (modal) => {
    /** Locally evaluated wrong answer with its server response still pending. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: {
      ...riddle, evaluation: {answer: "piano", locale: "en"},
    }});
    for (const letter of "CRANE") state = reduce(state, {type: "typeLetter", letter});
    state = reduce(state, {type: "guessRequested"});
    expect(state.guessPending).toBe(true);
    expect(reduce(state, {type: "openModal", modal}).modal).toBe(modal);
  });

  it.each(["PIANO", "CRANE"])("shows feedback for %s before the server responds", (guess) => {
    /** Riddle with canonical feedback data supplied at load time. */
    const loaded = {...riddle, evaluation: {answer: "piano", locale: "en"}};
    /** Game state driven through the submission flow. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: loaded});
    for (const letter of guess) state = reduce(state, {type: "typeLetter", letter});
    state = reduce(state, {type: "guessRequested"});
    expect(state.guesses).toHaveLength(1);
    expect(state.guesses[0].feedback).toEqual(guess === "PIANO"
      ? ["green", "green", "green", "green", "green"]
      : ["red", "red", "green", "green", "red"]);
    expect(state.guessPending).toBe(true);
    expect(state.lastRewards).toBeNull();
    expect(state.completionAcknowledged).toBe(false);
  });

  it("shows and records deterministic achievement unlocks before completion responds", () => {
    /** Profile has one win remaining before its five-win milestone. */
    let state = reduce(createInitialGameSession(), {type: "hostInit", locale: "en", gameMode: "classic",
      user: null, products: [], profile: {username: "Guest", coins: 0, level: 1, xp: 0,
        winStreak: 0, gamesPlayed: 4, wins: 4, totalWins: 4, totalGuessesInWins: 8,
        achievements: ["first_win"], classicIndex: 1}});
    state = reduce(state, {type: "loadRiddle", riddle: {...riddle, evaluation: {answer: "piano", locale: "en"}}});
    for (const letter of "PIANO") state = reduce(state, {type: "typeLetter", letter});
    state = reduce(state, {type: "guessRequested"});
    expect(state.guessPending).toBe(true);
    expect(state.lastRewards?.newlyUnlockedAchievementIds).toEqual([
      "wins_5", "perfect_guess", "classic_perfect",
    ]);
    expect(state.profile?.achievements).toEqual(["first_win", "wins_5", "perfect_guess", "classic_perfect"]);
    state = reduce(state, {type: "completionReward", reward: {
      coinsEarned: 100, newlyUnlockedAchievementIds: ["wins_5", "perfect_guess", "classic_perfect", "level_5"],
    }});
    expect(state.lastRewards?.newlyUnlockedAchievementIds).toEqual([
      "wins_5", "perfect_guess", "classic_perfect", "level_5",
    ]);
  });

  it("reconciles a preview without duplicate rows and rolls back rejected guesses", () => {
    /** Riddle with canonical feedback data supplied at load time. */
    const loaded = {...riddle, evaluation: {answer: "piano", locale: "en"}};
    /** Confirmed state before submitting the guess. */
    let before = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: loaded});
    for (const letter of "PIANO") before = reduce(before, {type: "typeLetter", letter});
    /** Immediate presentation before server confirmation. */
    const preview = reduce(before, {type: "guessRequested"});
    expect(preview.modal).toBe("victory");
    expect(reduce(preview, {type: "guessRequested"})).toBe(preview);
    /** State after the server rejects the submission. */
    const failed = reduce(preview, {type: "guessFailed"});
    expect(failed).toEqual(before);
    /** State after server confirmation replaces the preview. */
    const confirmed = reduce(preview, {
      type: "guessResolved", attempts: 1, isCorrect: true, gameOver: true, canContinue: false,
      feedback: {guess: [..."piano"], feedback: ["green", "green", "green", "green", "green"]},
    });
    expect(confirmed.guesses).toHaveLength(1);
    expect(confirmed.guessPending).toBe(false);
    expect(confirmed.pendingGuessState).toBeNull();
    /** Server disagreement that must override local feedback. */
    const corrected = reduce(preview, {
      type: "guessResolved", attempts: 1, isCorrect: false, gameOver: false, canContinue: false,
      feedback: {guess: [..."piano"], feedback: ["red", "red", "red", "red", "red"]},
    });
    expect(corrected.modal).toBeNull();
    expect(corrected.lastOutcome).toBeNull();
    expect(corrected.letterStates.p).toBe("red");
    expect(corrected.lastRewards).toBeNull();
  });

  it("accepts another local attempt while confirmation is slow and retains accepted rows on rejection", () => {
    /** The state used by this regression scenario. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: {
      ...riddle, evaluation: {answer: "piano", locale: "en"},
    }});
    for (const letter of "CRANE") state = reduce(state, {type: "typeLetter", letter});
    state = reduce(state, {type: "guessRequested"});
    for (const letter of "SLOPE") state = reduce(state, {type: "typeLetter", letter});
    state = reduce(state, {type: "guessRequested"});
    expect(state.guesses).toHaveLength(2);
    expect(state.guessPending).toBe(true);

    state = reduce(state, {type: "guessCheckpointAdvanced", attempts: 1,
      feedback: state.guesses[0], isCorrect: false, gameOver: false, canContinue: false});
    state = reduce(state, {type: "guessFailed"});
    expect(state.guesses).toHaveLength(1);
    expect(state.engineSnapshot?.attemptsUsed).toBe(1);
    expect(state.guessPending).toBe(false);
  });

  it("shows the out of attempts panel immediately and restores it if the fifth guess is rejected", () => {
    /** Game state driven through the submission flow. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: {
      ...riddle, attemptsUsed: 4, evaluation: {answer: "piano", locale: "en"},
    }});
    for (const letter of "CRANE") state = reduce(state, {type: "typeLetter", letter});
    state = reduce(state, {type: "guessRequested"});
    expect(state.guesses).toHaveLength(1);
    expect(state.modal).toBe("continue");
    expect(state.guessPending).toBe(true);
    expect(state.lastOutcome).toBeNull();
    state = reduce(state, {type: "guessFailed"});
    expect(state.modal).toBeNull();
    expect(state.engineSnapshot?.attemptsUsed).toBe(4);
  });

  it("keeps the next draft editable while a wrong guess is confirming", () => {
    /** Loaded solo riddle with feedback data. */
    const loaded = {...riddle, evaluation: {answer: "piano", locale: "en"}};
    /** Submission followed by the next draft before confirmation. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: loaded});
    for (const letter of "CRANE") state = reduce(state, {type: "typeLetter", letter});
    state = reduce(state, {type: "guessRequested"});
    state = reduce(state, {type: "typeLetter", letter: "P"});
    expect(state.currentLetters[0]).toBe("P");
    state = reduce(state, {
      type: "guessResolved", attempts: 1, isCorrect: false, gameOver: false, canContinue: false,
      feedback: {guess: [..."crane"], feedback: ["red", "red", "green", "green", "red"]},
    });
    expect(state.currentLetters[0]).toBe("P");
    expect(state.guesses).toHaveLength(1);
    expect(state.guessPending).toBe(false);
  });

  it("ignores a stale saved snapshot while a guess is pending", () => {
    /** State immediately before the backend acknowledges the guess. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: {
      ...riddle, evaluation: {answer: "piano", locale: "en"},
    }});
    for (const letter of "PIANO") state = reduce(state, {type: "typeLetter", letter});
    state = reduce(state, {type: "guessRequested"});
    expect(reduce(state, {
      type: "restoreSession", riddleId: riddle.riddleId, sessionToken: riddle.sessionToken, currentLetters: [..."PIANO"], activeSlotIndex: 0,
      hintRevealedIndices: [], guesses: [], letterStates: {}, awaitingContinue: false,
      engineSnapshot: {guesses: [], attemptsUsed: 0, hasUsedContinue: false, gameOver: false},
    })).toBe(state);
  });

  it("opens and cancels the Daily Skip warning without changing its riddle", () => {
    /** Provides daily riddle behavior. */
    const dailyRiddle = {...riddle, riddleId: "daily-1", gameMode: "challenge" as const};
    /** Provides state behavior. */
    const state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: dailyRiddle});

    /** Opening a warning retains the original Daily session for cancellation. */
    const warning = reduce(state, {type: "openModal", modal: "skip"});
    expect(warning.modal).toBe("skip");
    expect(warning.gameMode).toBe("challenge");
    expect(warning.riddle).toBe(state.riddle);
    expect(reduce(warning, {type: "closeModal"})).toEqual(state);
  });

  it("ignores incomplete submissions without showing an error", () => {
    /** Provides state behavior. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});
    state = reduce(state, {type: "typeLetter", letter: "P"});

    /** Provides before submit behavior. */
    const beforeSubmit = state;
    state = reduce(state, {type: "guessRequested"});

    expect(state).toBe(beforeSubmit);
    expect(state.notice).toBeNull();
    expect(state.guesses).toHaveLength(0);
  });

  it("loads a riddle and wins with a correct guess", () => {
    /** Provides state behavior. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});

    for (const letter of ["P", "I", "A", "N", "O"]) {
      state = reduce(state, {type: "typeLetter", letter});
    }
    expect(getCurrentGuessValue(state)).toBe("piano");

    state = resolveGuess(state, "piano", 1, {isCorrect: true, gameOver: true});

    expect(state.modal).toBe("victory");
    expect(state.lastOutcome).toEqual(
      expect.objectContaining({
        kind: "win",
        riddleId: "classic-1",
        isCorrect: true,
      }),
    );
    expect(state.letterStates.p).toBe("green");
  });

  it("does not append duplicate rows for an authoritative semantic replay", () => {
    /** Provides state behavior. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});
    for (const letter of ["C", "R", "A", "N", "E"]) state = reduce(state, {type: "typeLetter", letter});
    state = resolveGuess(state, "crane", 1);
    expect(state.guesses).toHaveLength(1);

    for (const letter of ["C", "R", "A", "N", "E"]) state = reduce(state, {type: "typeLetter", letter});
    state = resolveGuess(state, "crane", 1);

    expect(state.guesses).toHaveLength(1);
    expect(state.engineSnapshot?.attemptsUsed).toBe(1);
    expect(state.guessPending).toBe(false);
  });

  it("can reveal a hinted letter and update coins", () => {
    /** Provides state behavior. */
    let state = reduce(createInitialGameSession(), {
      type: "hostInit",
      locale: "en",
      gameMode: "classic",
      user: null,
      profile: {
        username: "Guest",
        coins: 100,
        level: 1,
        xp: 0,
        winStreak: 0,
        gamesPlayed: 0,
        wins: 0,
        achievements: [],
        classicIndex: 1,
      },
      products: [],
    });
    state = reduce(state, {type: "loadRiddle", riddle});
    state = reduce(state, {type: "applyHint", index: 2, letter: "A", newCoins: 75});

    expect(state.currentLetters[2]).toBe("A");
    expect(state.letterStates.a).toBe("green");
    expect(state.profile?.coins).toBe(75);
  });

  it("grants a continue by resetting local attempts", () => {
    /** Provides state behavior. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});

    for (let attempt = 0; attempt < 5; attempt += 1) {
      for (const letter of ["C", "L", "O", "C", "K"]) {
        state = reduce(state, {type: "typeLetter", letter});
      }
      state = resolveGuess(state, "clock", attempt + 1, {canContinue: attempt === 4});
    }

    expect(state.modal).toBe("continue");
    state = reduce(state, {type: "continueGranted"});

    expect(state.modal).toBeNull();
    expect(state.guesses).toHaveLength(0);

    for (const letter of ["C", "L", "O", "C", "K"]) {
      state = reduce(state, {type: "typeLetter", letter});
    }
    state = resolveGuess(state, "clock", 6, {gameOver: true});

    expect(state.modal).toBeNull();
    expect(state.lastOutcome).toEqual(expect.objectContaining({kind: "loss", attempts: 6}));
  });

  it("replays Continue from an exhausted journal checkpoint without a modal", () => {
    /** Exhausted session recovered before replaying its interrupted charge. */
    let state = reduce(createInitialGameSession(), {type: "hostInit", locale: "en", gameMode: "classic",
      user: null, products: [], profile: {username: "Guest", coins: 150, level: 1, xp: 0,
        winStreak: 0, gamesPlayed: 0, wins: 0, achievements: [], classicIndex: 1}});
    state = reduce(state, {type: "loadRiddle", riddle});
    for (let attempt = 1; attempt <= 5; attempt += 1)
      state = resolveGuess(state, "clock", attempt, {canContinue: attempt === 5});
    state = {...state, modal: null};
    state = reduce(state, {type: "previewCoinSpend", requestId: "continue-replay", amount: 50, reason: "continue",
      draft: ["P", "I", "", "", ""], draftActiveSlotIndex: 2});
    expect(state.engineSnapshot?.hasUsedContinue).toBe(true);
    expect(state.engineSnapshot?.attemptsUsed).toBe(5);
    expect(state.profile?.coins).toBe(100);
    expect(state.pendingCoinSpend?.requestId).toBe("continue-replay");
    expect(state.guesses).toHaveLength(0);
    expect(state.currentLetters.join("")).toBe("PI");
    expect(state.activeSlotIndex).toBe(2);
    state = reduce(state, {type: "openModal", modal: "continue"});
    expect(state.modal).toBeNull();
  });

  it("opens play immediately after a local Continue charge and restores the panel on rejection", () => {
    /** Paid Continue session before and after server confirmation. */
    let state = reduce(createInitialGameSession(), {type: "hostInit", locale: "en", gameMode: "classic",
      user: null, products: [], profile: {username: "Guest", coins: 150, level: 1, xp: 0,
        winStreak: 0, gamesPlayed: 0, wins: 0, achievements: [], classicIndex: 1}});
    state = reduce(state, {type: "loadRiddle", riddle});
    for (let attempt = 1; attempt <= 5; attempt += 1)
      state = resolveGuess(state, "clock", attempt, {canContinue: attempt === 5});
    expect(state.modal).toBe("continue");

    state = reduce(state, {type: "previewCoinSpend", requestId: "continue-1", amount: 100, reason: "continue"});
    expect(state.profile?.coins).toBe(50);
    expect(state.modal).toBeNull();
    expect(state.engineSnapshot?.hasUsedContinue).toBe(true);

    state = reduce(state, {type: "rejectCoinSpend", requestId: "continue-1"});
    expect(state.profile?.coins).toBe(150);
    expect(state.modal).toBe("continue");
    expect(state.engineSnapshot?.hasUsedContinue).toBe(false);

    state = reduce(state, {type: "previewCoinSpend", requestId: "continue-2", amount: 100, reason: "continue"});
    state = reduce(state, {type: "confirmCoinSpend", requestId: "continue-2", newCoins: 40});
    expect(state.profile?.coins).toBe(40);
    expect(state.modal).toBeNull();
    expect(state.engineSnapshot?.hasUsedContinue).toBe(true);
    expect(state.pendingCoinSpend).toBeNull();
  });

  it.each([false, true])("keeps a granted Continue when a stale save restores after confirmation=%s", (confirmed) => {
    /** Authoritative exhausted question loaded before the replayed purchase finishes. */
    let state = reduce(createInitialGameSession(), {type: "hostInit", locale: "en", gameMode: "classic",
      user: null, products: [], profile: {username: "Guest", coins: 300, level: 1, xp: 0,
        winStreak: 0, gamesPlayed: 0, wins: 0, achievements: [], classicIndex: 1}});
    state = reduce(state, {type: "loadRiddle", riddle: {...riddle, attemptsUsed: 5, awaitingContinue: true}});
    /** Provider save still describing the exhausted question before Continue. */
    const staleSave = createSavedGame(state);
    if (!staleSave) throw new Error("Missing exhausted-session save");
    state = reduce(state, {type: "previewCoinSpend", requestId: "continue-replay", amount: 100, reason: "continue"});
    if (confirmed) state = reduce(state, {type: "confirmCoinSpend", requestId: "continue-replay", newCoins: 200});
    state = reduce(state, {type: "typeLetter", letter: "P"});
    state = reduce(state, {type: "restoreSession", ...staleSave});
    expect(state.modal).toBeNull();
    expect(state.engineSnapshot).toMatchObject({attemptsUsed: 5, hasUsedContinue: true, gameOver: false});
    expect(state.currentLetters.join("")).toBe("P");
    expect(state.profile?.coins).toBe(200);
  });

  it("records a declined continue without opening an answer modal", () => {
    /** Provides state behavior. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});

    for (let attempt = 0; attempt < 5; attempt += 1) {
      for (const letter of ["C", "L", "O", "C", "K"]) {
        state = reduce(state, {type: "typeLetter", letter});
      }
      state = resolveGuess(state, "clock", attempt + 1, {canContinue: attempt === 4});
    }

    state = reduce(state, {type: "declineContinue"});

    expect(state.modal).toBeNull();
    expect(state.lastOutcome).toEqual(expect.objectContaining({kind: "loss", attempts: 5}));
  });

  it("reopens Continue from authoritative load state when no client save survived", () => {
    /** Provides awaiting riddle behavior. */
    const awaitingRiddle = {
      ...riddle,
      attemptsUsed: 5,
      awaitingContinue: true,
    };
    /** Provides state behavior. */
    const state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: awaitingRiddle});

    expect(state.modal).toBe("continue");
    expect(state.engineSnapshot).toMatchObject({attemptsUsed: 5, hasUsedContinue: false, gameOver: false});
  });

  it("keeps a restored declined outcome retryable without reopening Continue", () => {
    /** Provides awaiting riddle behavior. */
    const awaitingRiddle = {...riddle, attemptsUsed: 5, awaitingContinue: true};
    /** Provides state behavior. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: awaitingRiddle});
    /** Provides pending outcome behavior. */
    const pendingOutcome = {
      id: `${riddle.sessionToken}-loss-5`,
      kind: "loss" as const,
      riddleId: riddle.riddleId,
      gameMode: riddle.gameMode,
      sessionToken: riddle.sessionToken,
      attempts: 5,
      isCorrect: false,
    };
    state = reduce(state, {
      type: "restoreSession", riddleId: riddle.riddleId, sessionToken: riddle.sessionToken,
      currentLetters: ["", "", "", "", ""],
      activeSlotIndex: 0,
      hintRevealedIndices: [],
      guesses: [],
      engineSnapshot: {guesses: [], attemptsUsed: 5, hasUsedContinue: false, gameOver: true},
      awaitingContinue: false,
      letterStates: {},
      pendingOutcome,
    });

    expect(state.modal).toBeNull();
    expect(state.lastOutcome).toEqual(pendingOutcome);
    expect(state.engineSnapshot?.gameOver).toBe(true);
  });

  it.each(["provider-only", "count", "token", "riddle", "mode", "not-terminal", "wrong-host-feedback"])(
    "anchors winning recovery to host feedback despite the provider record: %s", mismatch => {
      /** Local colours and a visible answer cannot replace host acceptance of the winning guess. */
      const guesses = [{guess: [..."PIANO"], feedback: Array(5).fill("green" as const)}];
      /** Host-issued row is independent of the provider colours. */
      const acceptedGuesses = [{attempt: 1, feedback: [..."PIANO"].map(letter => ({letter, status: "green" as const}))}];
      /** Presentation evaluation remains insufficient to prove server acceptance. */
      const issued: BridgeRiddle = {...riddle, attemptsUsed: 1, acceptedGuesses, evaluation: {answer: "piano", locale: "en"}};
      if(mismatch === "provider-only") delete issued.acceptedGuesses;
      if(mismatch === "wrong-host-feedback") issued.acceptedGuesses = [{attempt: 1, feedback: [..."QQQQQ"].map(letter => ({letter, status: "red"}))}];
      /** Saved intent is independently altered to verify identity and count guards. */
      const pendingOutcome: NonNullable<SavedGame["pendingOutcome"]> = {id: "saved-win-1", kind: "win", isCorrect: true, attempts: 1,
        riddleId: riddle.riddleId, sessionToken: riddle.sessionToken, gameMode: riddle.gameMode};
      if(mismatch === "count") pendingOutcome.attempts = 2;
      if(mismatch === "token") pendingOutcome.sessionToken = "00000000-0000-4000-8000-000000000002";
      if(mismatch === "riddle") pendingOutcome.riddleId = "classic-2";
      if(mismatch === "mode") pendingOutcome.gameMode = "challenge";
      /** Actual restore action reconciles the provider record with the loaded authority snapshot. */
      const state = reduce(reduce(createInitialGameSession(), {type: "loadRiddle", riddle: issued}), {
        type: "restoreSession", riddleId: riddle.riddleId, sessionToken: riddle.sessionToken,
        currentLetters: Array(5).fill(""), activeSlotIndex: 0, hintRevealedIndices: [], guesses,
        engineSnapshot: {guesses, attemptsUsed: 1, hasUsedContinue: false, gameOver: mismatch !== "not-terminal"},
        awaitingContinue: false, letterStates: {}, pendingOutcome,
      });
      if(mismatch === "provider-only" || mismatch === "wrong-host-feedback") {
        expect(state.lastOutcome).toBeNull();
        expect(state.modal).not.toBe("victory");
        expect(state.engineSnapshot?.gameOver).toBe(false);
      } else {
        expect(state.lastOutcome).toMatchObject({id: `${riddle.sessionToken}-win-1`, riddleId: riddle.riddleId,
          gameMode: "classic", sessionToken: riddle.sessionToken, attempts: 1, isCorrect: true});
        expect(state.modal).toBe("victory");
        expect(state.engineSnapshot?.gameOver).toBe(true);
      }
  });

  it("locks hinted slots while allowing non-sequential editing", () => {
    /** Provides state behavior. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});
    state = reduce(state, {type: "applyHint", index: 2, letter: "A"});
    state = reduce(state, {type: "selectSlot", index: 4});
    state = reduce(state, {type: "typeLetter", letter: "O"});
    state = reduce(state, {type: "selectSlot", index: 0});
    state = reduce(state, {type: "typeLetter", letter: "P"});
    state = reduce(state, {type: "selectSlot", index: 2});
    state = reduce(state, {type: "typeLetter", letter: "X"});

    expect(state.currentLetters).toEqual(["P", "X", "A", "", "O"]);
    expect(state.hintRevealedIndices).toEqual([2]);
  });

  it("keeps cached leaderboard rows while a fresh request is loading", () => {
    /** Provides existing entry behavior. */
    const existingEntry = {
      userId: "player-1",
      username: "Previous result",
      level: 3,
      xp: 420,
      totalWins: 5,
      bestStreak: 2,
    };
    /** Provides state behavior. */
    let state: GameSessionState = {
      ...createInitialGameSession(),
      leaderboard: [existingEntry],
    };

    state = reduce(state, {type: "openModal", modal: "leaderboard"});

    expect(state.leaderboard).toEqual([existingEntry]);
    expect(state.leaderboardLoading).toBe(true);

    state = reduce(state, {type: "leaderboardLoaded", leaderboardType: "xp", entries: [existingEntry]});

    expect(state.leaderboard).toEqual([existingEntry]);
    expect(state.leaderboardLoading).toBe(false);
  });

  it("keeps a failed ranking distinct from empty results and clears it on Retry", () => {
    /** Correlated reducer state follows failure, retry, and a confirmed empty result. */
    let state = reduce(createInitialGameSession(), {type: "leaderboardRequested", leaderboardType: "totalWins", requestId: "wins-1"});
    state = reduce(state, {type: "leaderboardLoadFailed", requestId: "wins-1"});
    expect(state).toMatchObject({leaderboardLoading: false, leaderboardLoadError: true, leaderboard: []});
    state = reduce(state, {type: "leaderboardRequested", leaderboardType: "totalWins", requestId: "wins-2"});
    expect(state).toMatchObject({leaderboardLoading: true, leaderboardLoadError: false});
    state = reduce(state, {type: "leaderboardLoaded", leaderboardType: "totalWins", entries: [], requestId: "wins-2"});
    expect(state).toMatchObject({leaderboardLoading: false, leaderboardLoadError: false, leaderboard: []});
  });

  it("ignores older ranking successes and failures after a newer selection or Retry", () => {
    /** Current request ownership excludes older ranking deliveries. */
    let state = reduce(createInitialGameSession(), {type: "leaderboardRequested", leaderboardType: "xp", requestId: "old"});
    state = reduce(state, {type: "leaderboardRequested", leaderboardType: "totalWins", requestId: "new"});
    expect(reduce(state, {type: "leaderboardLoadFailed", requestId: "old"})).toBe(state);
    expect(reduce(state, {type: "leaderboardLoaded", requestId: "old", leaderboardType: "xp", entries: []})).toBe(state);
    state = reduce(state, {type: "leaderboardLoaded", requestId: "new", leaderboardType: "totalWins", entries: []});
    expect(reduce(state, {type: "leaderboardLoadFailed", requestId: "new"})).toBe(state);
  });

  it("rejects another account's late ranking result", () => {
    /** Account replacement retires the previous player's requested ranking. */
    let state = reduce(createInitialGameSession(), {type: "leaderboardRequested", leaderboardType: "xp", requestId: "previous-player"});
    state = reduce(state, {type: "authState", user: {uid: "new-player", isAnonymous: true}, profile: null});
    expect(reduce(state, {type: "leaderboardLoaded", requestId: "previous-player", leaderboardType: "xp", entries: []})).toBe(state);
    expect(state.leaderboardLoadError).toBe(false);
  });

  it("invalidates cached rankings when the account generation or ranking profile changes", () => {
    /** The user used by this regression scenario. */
    const user = {uid: "player-1", accountGeneration: 1, isAnonymous: false};
    /** The profile used by this regression scenario. */
    const profile = {username: "Player", coins: 5, level: 1, xp: 10, winStreak: 0,
      gamesPlayed: 1, wins: 1, achievements: [], classicIndex: 2};
    /** The ranked used by this regression scenario. */
    const ranked = {...createInitialGameSession(), user, profile,
      leaderboard: [{userId: user.uid, username: "Player", level: 1, xp: 10, totalWins: 1, bestStreak: 0}]};
    expect(reduce(ranked, {type: "authState", user, profile}).leaderboard).toHaveLength(1);
    expect(reduce(ranked, {type: "authState", user: {...user, accountGeneration: 2}, profile}).leaderboard)
      .toHaveLength(0);
    expect(reduce(ranked, {type: "authState", user, profile: {...profile, xp: 20}}).leaderboard)
      .toHaveLength(0);
    expect(reduce(ranked, {type: "authState", user, profile: {...profile, multiplayerWins: 1}}).leaderboard)
      .toHaveLength(0);
  });

  it("does not replay a daily achievement when its completion response arrives after the next riddle loads", () => {
    /** Provides achievement behavior. */
    const achievement = "daily_completed";
    /** Provides profile behavior. */
    const profile = {
      username: "Guest", coins: 5, level: 1, xp: 10, winStreak: 0, gamesPlayed: 1, wins: 1,
      achievements: [achievement], classicIndex: 0,
    };
    /** Provides state behavior. */
    let state = reduce({...createInitialGameSession(), profile}, {type: "loadRiddle", riddle});
    state = reduce(state, {type: "completionReward", reward: {
      coinsEarned: 25, newlyUnlockedAchievementIds: [achievement],
    }});
    expect(state.lastRewards?.newlyUnlockedAchievementIds).toEqual([]);
  });
});


it.each([false, true])("restores receipt metadata only when its persisted coin components remain valid (%s)", malformed => {
  /** Current authority-issued question owns the presentation being recovered. */
  const state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});
  /** Recovery captures exactly the fields retained by the pending-play journal. */
  const base: PendingGuessState = {currentLetters: state.currentLetters, activeSlotIndex: state.activeSlotIndex,
    guesses: state.guesses, engineSnapshot: state.engineSnapshot, modal: state.modal, lastOutcome: state.lastOutcome,
    completionAcknowledged: state.completionAcknowledged, letterStates: state.letterStates, profile: state.profile,
    optimisticAchievementIds: state.optimisticAchievementIds,
    lastRewards: {coinsEarned: 25, newlyUnlockedAchievementIds: [], rewardBreakdown: {baseWinCoins: 25,
      levelUpBonus: 0, dailyStreakBonus: 0, achievementBonus: 0, totalAwarded: 25,
      newBalance: malformed ? Number.MAX_SAFE_INTEGER + 1 : 325}}};
  /** The production journal recovery path rejects invalid metadata before it reaches the modal. */
  const restored = reduce(state, {type: "restoreQueuedGuesses", base, guesses: [], draft: ["P", "", "", "", ""]});
  expect(restored.currentLetters).toEqual(["P", "", "", "", ""]);
  expect(restored.lastRewards?.rewardBreakdown?.baseWinCoins ?? null).toBe(malformed ? null : 25);
});

it("returns from commerce to an unspent Continue boundary, but not a resolved loss or paid continue", () => {
  /** Reducer state after applying the canonical content and gameplay transitions. */
  let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});
  for (let attempt = 1; attempt <= 5; attempt++) state = resolveGuess(state, "xxxxx", attempt, {canContinue: attempt === 5});
  /** Terminal reducer checkpoint preserved before late authority results are applied. */
  const exhausted = state;
  state = reduce(state, {type: "openModal", modal: "shop"});
  state = reduce(state, {type: "closeModal"});
  expect(state.modal).toBe("continue");
  state = reduce(state, {type: "showAuxiliaryFanfare", fanfare: {id: "purchase", kind: "purchase", coinsAwarded: 250, totalCoins: 500, achievementIds: []}});
  state = reduce(state, {type: "closeModal"});
  expect(state.modal).toBe("continue");
  expect(state.auxiliaryFanfare).toBeNull();
  for (const action of [{type: "continueGranted"}, {type: "declineContinue"}] as const) {
    /** Reducer result after a late response targets the terminal checkpoint. */
    let resolved = reduce(exhausted, action);
    resolved = reduce(resolved, {type: "openModal", modal: "shop"});
    expect(reduce(resolved, {type: "closeModal"}).modal).toBeNull();
  }
});


it.each(["typed", "preview", "confirmed"])("preserves Turkish dotted I in a %s single-player attempt", kind => {
  /** Content locale owns letter casing even while presentation uses another language. */
  const loaded = {...riddle, evaluation: {answer: "izmir", locale: "tr"}};
  /** An editable attempt can include either a provisional or authoritative hinted position. */
  let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: loaded});
  if (kind !== "typed") state = reduce(state, {type: kind === "preview" ? "previewHint" : "applyHint", index: 0, letter: "i"});
  for (const letter of kind === "typed" ? "izmir" : "zmir") state = reduce(state, {type: "typeLetter", letter});
  expect(state.currentLetters).toEqual(["İ", "Z", "M", "İ", "R"]);
  state = reduce(state, {type: "guessRequested"});
  expect(state.guesses[0].feedback).toEqual(Array(5).fill("green"));
});

it("keeps Turkish dotted and dotless typed I distinct", () => {
  /** A one-cell Turkish question distinguishes intentional uppercase I from lowercase i. */
  const loaded = {...riddle, answerLength: 1, evaluation: {answer: "i", locale: "tr"}};
  /** The visible state starts with no input or server mutations. */
  const state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: loaded});
  expect(reduce(state, {type: "typeLetter", letter: "i"}).currentLetters).toEqual(["İ"]);
  expect(reduce(state, {type: "typeLetter", letter: "I"}).currentLetters).toEqual(["I"]);
});


it.each([["izmir", "İ"], ["IRMAK", "I"]])("projects a historical Turkish I hint against immutable %s content", (answer, expected) => {
  /** The trusted current question distinguishes a dotted answer from a valid dotless answer. */
  const loaded = {...riddle, evaluation: {answer, locale: "tr"}};
  /** Historical receipt identity and balance are outside this local glyph projection. */
  const state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: loaded});
  /** The projected glyph retains the purchased position and confirmed balance. */
  const hinted = reduce(state, {type: "applyHint", index: 0, letter: "I", newCoins: 275});
  expect(hinted.currentLetters[0]).toBe(expected);
  expect(hinted.hintRevealedIndices).toEqual([0]);
});

it("does not reinterpret an ambiguous historical hint without immutable Turkish evaluation", () => {
  /** A legacy question without evaluation cannot establish which Turkish I was purchased. */
  const state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});
  expect(reduce(state, {type: "applyHint", index: 0, letter: "I"}).currentLetters[0]).toBe("I");
});


it.each([["izmir", "İ", "i"], ["izmir", "I", "i"], ["IRMAK", "I", "ı"]])(
  "keeps confirmed Turkish %s hint %s keyboard feedback under canonical %s", (answer, letter, key) => {
    /** Immutable Turkish content determines both displayed hint and keyboard feedback identity. */
    const loaded = {...riddle, evaluation: {answer, locale: "tr"}};
    /** A freshly confirmed grant starts before any submitted guess can mask hint feedback. */
    const state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: loaded});
    /** Confirmation must color precisely the hinted symbol without leaking to the other Turkish I. */
    const hinted = reduce(state, {type: "applyHint", index: 0, letter});
    expect(hinted.letterStates).toEqual({[key]: "green"});
  },
);


it.each(["loaded", "queued", "provider", "continue", "rollback"] as const)(
  "keeps authoritative hint keyboard feedback through %s recovery", kind => {
    /** An older checkpoint has no purchased hint or keyboard feedback. */
    const prior = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});
    /** Journal fields intentionally predate the server's paid hint. */
    const {currentLetters, activeSlotIndex, guesses, engineSnapshot, modal, lastOutcome,
      completionAcknowledged, letterStates, profile, lastRewards, optimisticAchievementIds} = prior;
    /** Recovery state must merge knowledge instead of replacing a confirmed purchase. */
    const base = {currentLetters, activeSlotIndex, guesses, engineSnapshot, modal, lastOutcome,
      completionAcknowledged, letterStates, profile, lastRewards, optimisticAchievementIds};
    /** Server-owned hint is confirmed even without any submitted guess. */
    const loaded = {...riddle, revealedHints: [{index: 0, letter: "P"}]};
    /** Actual recovery reducer begins from the current host-issued question. */
    let state = reduce(prior, {type: "loadRiddle", riddle: loaded});
    if (kind === "queued") state = reduce(state, {type: "restoreQueuedGuesses", base, guesses: [], draft: currentLetters});
    if (kind === "provider") state = reduce(state, {type: "restoreSession", riddleId: riddle.riddleId,
      sessionToken: riddle.sessionToken, currentLetters, activeSlotIndex, hintRevealedIndices: [], guesses: [],
      engineSnapshot: {guesses: [], attemptsUsed: 0, hasUsedContinue: false, gameOver: false},
      awaitingContinue: false, letterStates: {}});
    if (kind === "continue") state = reduce(state, {type: "continueGranted"});
    if (kind === "rollback") state = reduce(state, {type: "restoreConfirmedRiddle", riddle: loaded, base});
    expect(state.letterStates.p).toBe("green");
    expect(state.currentLetters[0]).toBe("P");
    expect(state.activeSlotIndex).not.toBe(0);
  },
);


it("does not promote a provisional hint to confirmed keyboard knowledge during recovery", () => {
  /** Current question has no purchased hint. */
  const loaded = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});
  /** A pending letter can still be rejected without leaving green keyboard feedback. */
  const preview = reduce(loaded, {type: "previewHint", index: 0, letter: "P"});
  /** Continue's history projection must not confirm an unrelated pending purchase. */
  const projected = reduce(preview, {type: "continueGranted"});
  expect(projected.letterStates.p).toBeUndefined();
  expect(reduce(projected, {type: "rejectHint"}).letterStates.p).toBeUndefined();
});

it("does not carry a prior question's hint feedback into its successor", () => {
  /** The completed predecessor contains confirmed hint knowledge. */
  const prior = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: {...riddle,
    revealedHints: [{index: 0, letter: "P"}]}});
  /** A successor without hints owns a new empty keyboard projection. */
  const next = reduce(prior, {type: "loadRiddle", riddle: {...riddle,
    riddleId: "next-riddle", sessionToken: "next-session-token"}});
  expect(next.letterStates).toEqual({});
});


it.each([-1, 0.5, NaN, Infinity, 5])("ignores invalid hint position %s without phantom locks", index => {
  /** A valid editable question owns only its five integer cell positions. */
  const state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});
  expect(reduce(state, {type: "previewHint", index, letter: "P"})).toBe(state);
  expect(reduce(state, {type: "applyHint", index, letter: "P"})).toBe(state);
  /** A failed confirmation retires only the provisional reveal, restoring its original selection. */
  const preview = reduce(state, {type: "previewHint", index: 0, letter: "P"});
  /** The rejected positional metadata cannot disable ordinary subsequent typing. */
  const restored = reduce(preview, {type: "applyHint", index, letter: "P"});
  expect(restored.pendingHintState).toBeNull();
  expect(restored.hintRevealedIndices).toEqual([]);
  expect(restored.activeSlotIndex).toBe(0);
  expect(reduce(restored, {type: "typeLetter", letter: "A"}).currentLetters[0]).toBe("A");
});


it.each(["", " ", "XX", "ß", "a" + "\u0301".repeat(32)])("rejects hint letters that cannot occupy one cell: %j", letter => {
  /** One valid question has no confirmed hint locks. */
  const state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});
  expect(reduce(state, {type: "previewHint", index: 0, letter})).toBe(state);
  expect(reduce(state, {type: "applyHint", index: 0, letter})).toBe(state);
  /** A malformed confirmation must retire its valid optimistic preview. */
  const preview = reduce(state, {type: "previewHint", index: 0, letter: "P"});
  /** Restored draft remains editable after rejecting impossible cell content. */
  const restored = reduce(preview, {type: "applyHint", index: 0, letter});
  expect(restored.hintRevealedIndices).toEqual([]);
  expect(restored.pendingHintState).toBeNull();
  expect(reduce(restored, {type: "typeLetter", letter: "A"}).currentLetters[0]).toBe("A");
});

it.each(["E\u0301", "👩‍🚀", "कि", "a" + "\u0301".repeat(31)])("preserves valid combining hint cells: %j", letter => {
  /** Existing one-grapheme hints remain valid even with multiple code points. */
  const state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});
  for (const type of ["previewHint", "applyHint"] as const) {
    /** Every valid reveal occupies exactly its owned slot. */
    const hinted = reduce(state, {type, index: 0, letter});
    expect(hinted.currentLetters[0]).toBe(letter.toLocaleUpperCase("en"));
    expect(hinted.hintRevealedIndices).toEqual([0]);
  }
});


it.each([["en", "PIANO", "piano"], ["tr", "İZMİR", "izmir"]])(
  "retires a saved %s draft newly committed as %s/%s", (locale, draft, accepted) => {
    /** Current authority has accepted the word that an older local checkpoint still calls a draft. */
    const issued = {...riddle, attemptsUsed: 1, evaluation: {answer: "zombi", locale},
      acceptedGuesses: [{attempt: 1, feedback: [...accepted].map(letter => ({letter, status: "yellow" as const}))}]};
    /** Same-session reload owns the newer history before restoring local intent. */
    const state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: issued});
    /** The retained checkpoint predates the authoritative attempt. */
    const restored = reduce(state, {type: "restoreSession", riddleId: riddle.riddleId, sessionToken: riddle.sessionToken,
      currentLetters: [...draft], activeSlotIndex: 3, hintRevealedIndices: [], guesses: [],
      engineSnapshot: {guesses: [], attemptsUsed: 0, hasUsedContinue: false, gameOver: false},
      awaitingContinue: false, letterStates: {}});
    expect(restored.currentLetters).toEqual(Array(5).fill(""));
    expect(restored.activeSlotIndex).toBe(0);
    expect(restored.guesses[0].guess.join("")).toBe(accepted);
  },
);

it.each(["unrelated-draft", "same-counter", "missing-history"])("preserves checkpoint intent without consumption proof: %s", kind => {
  /** Only an advanced authoritative matching row proves that a saved draft was already submitted. */
  const issued = {...riddle, attemptsUsed: 1, ...(kind !== "missing-history" ? {
    acceptedGuesses: [{attempt: 1, feedback: [..."piano"].map(letter => ({letter, status: "yellow" as const}))}],
  } : {})};
  /** Unrelated unsent letters or a current checkpoint must survive a reload. */
  const currentLetters = kind === "unrelated-draft" ? ["C", "L", "", "", ""] : [..."PIANO"];
  /** The fresh authority-issued question is eligible for provider reconciliation. */
  const state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: issued});
  /** Restoration carries its own acknowledged attempt count independently of draft contents. */
  const restored = reduce(state, {type: "restoreSession", riddleId: riddle.riddleId, sessionToken: riddle.sessionToken,
    currentLetters, activeSlotIndex: 2, hintRevealedIndices: [], guesses: [],
    engineSnapshot: {guesses: [], attemptsUsed: kind === "same-counter" ? 1 : 0, hasUsedContinue: false, gameOver: false},
    awaitingContinue: false, letterStates: {}});
  expect(restored.currentLetters).toEqual(currentLetters);
  expect(restored.activeSlotIndex).toBe(2);
});

it("keeps purchased cells when retiring a newly accepted saved draft", () => {
  /** Paid hint ownership survives clearing the other cells of an accepted word. */
  const issued = {...riddle, attemptsUsed: 1, revealedHints: [{index: 0, letter: "P"}],
    acceptedGuesses: [{attempt: 1, feedback: [..."piano"].map(letter => ({letter, status: "yellow" as const}))}]};
  /** Current host hint locks outrank the old checkpoint. */
  const state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle: issued});
  /** The consumed draft is cleared only outside confirmed hint cells. */
  const restored = reduce(state, {type: "restoreSession", riddleId: riddle.riddleId, sessionToken: riddle.sessionToken,
    currentLetters: [..."PIANO"], activeSlotIndex: 3, hintRevealedIndices: [0], guesses: [],
    engineSnapshot: {guesses: [], attemptsUsed: 0, hasUsedContinue: false, gameOver: false},
    awaitingContinue: false, letterStates: {}});
  expect(restored.currentLetters).toEqual(["P", "", "", "", ""]);
  expect(restored.activeSlotIndex).toBe(1);
  expect(restored.hintRevealedIndices).toEqual([0]);
  expect(restored.letterStates.p).toBe("green");
});


it.each(["reject", "save"])("preserves typing after an unconfirmed hint during %s", kind => {
  /** The hint starts after one player-owned letter, with the cursor ready for the next one. */
  let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});
  state = reduce(state, {type: "typeLetter", letter: "C"});
  state = reduce(state, {type: "previewHint", index: 0, letter: "P"});
  state = reduce(state, {type: "typeLetter", letter: "A"});
  state = reduce(state, {type: "typeLetter", letter: "N"});
  /** Projection rolls back only the unconfirmed hint, retaining subsequent player intent. */
  const recovered = kind === "reject" ? reduce(state, {type: "rejectHint"}) : createSavedGame(state)!;
  expect(recovered.currentLetters).toEqual(["C", "A", "N", "", ""]);
  expect(recovered.activeSlotIndex).toBe(3);
  expect(recovered.hintRevealedIndices).toEqual([]);
  if (kind === "reject") {
    state = recovered as GameSessionState;
    state = reduce(state, {type: "typeLetter", letter: "O"});
    state = reduce(state, {type: "typeLetter", letter: "N"});
    expect(state.currentLetters.join("")).toBe("CANON");
  }
});


it.each(["reject", "save"])("retains untouched and deliberate preview selection during %s", kind => {
  for (const intent of ["unchanged", "focused", "ignored", "typed-emptied", "focused-same"] as const) {
    /** Original selection differs from the automatic preview cursor. */
    let state = reduce(createInitialGameSession(), {type: "loadRiddle", riddle});
    state = reduce(state, {type: "typeLetter", letter: "C"});
    state = reduce(state, {type: "selectSlot", index: 3});
    state = reduce(state, {type: "previewHint", index: 0, letter: "P"});
    if (intent === "focused") state = reduce(state, {type: "selectSlot", index: 4});
    if (intent === "ignored") state = reduce(state, {type: "typeLetter", letter: " "});
    if (intent === "focused-same") state = reduce(state, {type: "selectSlot", index: 1});
    if (intent === "typed-emptied") {
      state = reduce(state, {type: "typeLetter", letter: "A"});
      state = reduce(state, {type: "backspace"});
    }
    /** Ignored input leaves the original intent intact; explicit focus remains player-owned. */
    const recovered = kind === "reject" ? reduce(state, {type: "rejectHint"}) : createSavedGame(state)!;
    expect(recovered.activeSlotIndex).toBe(intent === "focused" ? 4 : intent === "focused-same" || intent === "typed-emptied" ? 1 : 3);
    expect(recovered.currentLetters).toEqual(["C", "", "", "", ""]);
  }
});
