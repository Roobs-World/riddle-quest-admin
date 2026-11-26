import {readProtectedContent} from "../../../../src/content/transport/contentProtection";
import {computeFeedback} from "../../../../src/gameplay/rules/computeFeedback";
import {splitGraphemes} from "../../../../src/gameplay/input/graphemes";
import type {BridgeProfile, BridgeRiddle, BridgeUser} from "../../../../src/platform/bridge/messages";
import type {AuthSnapshot, CompletionResult, HostServices, SinglePlayerGuessResult} from "../../../../src/platform/contracts/hostServices";
import type {SavedGame} from "../../../../src/platform/contracts/capabilities";
import {parseSavedGame} from "../../../../src/accounts/browser/playerState/playerDataValidation";

/** Encrypted non-economic guest examples; answers are decoded only when guest play needs them. */
const protectedRiddles = {"contentProtection":1,"iv":"7597a7068e78eb9259c77597","data":"21f77dd0362498d4f59c8133811546203d6cf9fed6924dd55c289801fc128e5f260cc79a96b70dcf48b456ba1f5927593aa6ec7dec48069ac0e7cd29bfa5666f70739aa0718679626d77658f51acb6c934739158a036fa1f226b60e5540d90600b208afc3f06b014c1fc92046f1871b3b795c221f3adec5beaf5d8f8b4c4242c0649afffeb0723422e4337c3fcec15807daf02e95dadd4433c2d7e76151f80583c43ac284142d5d9a38c50edf0c51cf6fd71f6a872685f768fc26bbd94e2376c97"};
/** Trusted bundled guest content shape, independent of provider SDKs. */
type GuestRiddle = {
  /** Stable example identity. */ id: string;
  /** Displayed clue. */ text: string;
  /** Local answer. */ answer: string;
};
/** Lazy decoding avoids retaining plaintext answers during authenticated play. */
let guestRiddles: Promise<GuestRiddle[]> | undefined;
/** Loads the small encrypted guest deck once per browser session. */
const loadGuestRiddles = (): Promise<GuestRiddle[]> => guestRiddles ??= readProtectedContent(protectedRiddles).then(value => value as GuestRiddle[]);
/** Provides unavailable behavior. */
const unavailable = async (): Promise<never> => {
  throw new Error("reddit-login-required");
};
/** Provides guest user behavior. */
const guestUser: BridgeUser = {uid: "reddit-guest", displayName: "Guest Solver", isAnonymous: true};
/** Index-owned tokens retain first-deck checkpoint compatibility without reusing later rounds. */
const guestRoundToken = (index: number): string => `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;

/** Creates an isolated, non-economic solo engine for logged-out Reddit sessions. */
export const createRedditGuestHostServices = (savedProfile?: BridgeProfile, savedGame?: SavedGame | null): HostServices => {
  /** Guest checkpoints are local display/game state; economic fields are never restored from them. */
  const restoredGame = parseSavedGame(savedGame);
  /** Provides profile behavior. */
  let profile: BridgeProfile = {
    username: "Guest Solver",
    coins: 0,
    level: 1,
    xp: 0,
    winStreak: 0,
    gamesPlayed: savedProfile?.gamesPlayed ?? 0,
    wins: savedProfile?.wins ?? 0,
    achievements: [],
    classicIndex: Math.max(1, savedProfile?.classicIndex ?? 1),
  };
  /** Provides subscribers behavior. */
  const subscribers = new Set<(snapshot: AuthSnapshot) => void>();
  /** Provides attempts behavior. */
  const attempts = new Map<
    string,
    {
      /** Stores count. */
      count: number;
      /** Stores correct. */
      correct: boolean;
      /** Locally verified guesses allow the replacement view to recover truthful feedback. */
      guesses: string[];
      /** Bundled content identity belonging to this issued round. */
      riddleId: string;
      /** A transport retry receives the original verdict instead of another attempt. */
      receipts: Map<string, {
        /** Submitted normalized answer. */
        guess: string;
        /** Original verdict. */
        result: SinglePlayerGuessResult;
      }>;
      /** Completed local practice statistics are applied at most once. */
      completion?: CompletionResult;
    }
  >();
  /** Provides emit behavior. */
  const emit = () => subscribers.forEach((listener) => listener({user: guestUser, profile}));
  /** Provides riddle for behavior. */
  const riddleFor = async (classicIndex = profile.classicIndex) => {
    /** Decoded local examples. */
    const riddles = await loadGuestRiddles();
    return riddles[(Math.max(1, classicIndex) - 1) % riddles.length];
  };

  return {
    products: [],
    auth: {
      /** Provides subscribe behavior. */
      subscribe(listener) {
        subscribers.add(listener);
        listener({user: guestUser, profile});
        return () => subscribers.delete(listener);
      },
    },
    /** Loads profile. */
    async loadProfile() {
      return profile;
    },
    /** Loads riddle. */
    async loadRiddle({gameMode}) {
      if (gameMode !== "classic") throw new Error("reddit-login-required");
      /** Provides source behavior. */
      // Completion can reach the bridge before its profile update. The local authority
      // chooses the next issued example even when that caller still sends the old index.
      const index = profile.classicIndex;
      if (!Number.isSafeInteger(index) || index < 1) throw new Error("reddit-guest-invalid-index");
      /** Content may repeat; its issued round identity does not. */
      const source = await riddleFor(index), sessionToken = guestRoundToken(index);
      if (!attempts.has(sessionToken)) {
        attempts.set(sessionToken, {count: 0, correct: false, guesses: [], riddleId: source.id, receipts: new Map()});
        // Retain recent transport receipts without growing with an unlimited practice session.
        if (attempts.size > 16) attempts.delete(attempts.keys().next().value!);
      }
      /** Current issued state is distinct from the two reusable content identities. */
      const prior = attempts.get(sessionToken)!;
      if (prior.count === 0 && restoredGame?.riddleId === source.id &&
        restoredGame.sessionToken === sessionToken && restoredGame.gameMode === "classic" &&
        !restoredGame.engineSnapshot.hasUsedContinue &&
        restoredGame.engineSnapshot.attemptsUsed > 0 && restoredGame.engineSnapshot.attemptsUsed <= 5 &&
        restoredGame.guesses.length === restoredGame.engineSnapshot.attemptsUsed) {
        /** Recompute ongoing or pending terminal evidence from the actual bundled answer. */
        const guesses = restoredGame.guesses.map(row => row.guess.join("").toLocaleLowerCase("en"));
        /** A winning answer must be the last accepted attempt; earlier wins cannot be extended. */
        const correct = guesses.at(-1) === source.answer;
        /** Terminal provider state is retryable only with its matching completion intent. */
        const outcome = restoredGame.pendingOutcome;
        /** Matching intent prevents terminal colours alone from becoming completed practice statistics. */
        const terminalMatches = restoredGame.engineSnapshot.gameOver && outcome?.attempts === guesses.length &&
          outcome.isCorrect === correct && outcome.kind === (correct ? "win" : "loss") &&
          (correct || guesses.length === 5);
        if (guesses.every(guess => splitGraphemes(guess).length === splitGraphemes(source.answer).length) &&
          guesses.slice(0, -1).every(guess => guess !== source.answer) &&
          (terminalMatches || (!restoredGame.engineSnapshot.gameOver && !correct && !outcome))) {
          prior.count = guesses.length;
          prior.guesses = guesses;
          prior.correct = correct;
        }
      }
      return {
        riddleId: source.id,
        text: source.text,
        answerLength: splitGraphemes(source.answer).length,
        evaluation: {answer: source.answer, locale: "en"},
        sessionToken,
        gameMode: "classic",
        index,
        attemptsUsed: prior.count,
        hasUsedContinue: false,
        awaitingContinue: prior.count === 5 && !prior.correct,
        ...(prior.count ? {acceptedGuesses: prior.guesses.map((guess, index) => {
          /** The bundled answer is the source of every recovered feedback colour. */
          const statuses = computeFeedback(guess, source.answer);
          return {attempt: index + 1, feedback: splitGraphemes(guess).map((letter, index) => ({letter, status: statuses[index] ?? "red"}))};
        })} : {}),
      } satisfies BridgeRiddle;
    },
    /** Submits guess. */
    async submitGuess({riddleId, gameMode, sessionToken, requestId, guess}) {
      if (gameMode !== "classic") throw new Error("reddit-login-required");
      /** Provides source behavior. */
      const source = (await loadGuestRiddles()).find(({id}) => id === riddleId);
      if (!source) throw new Error("reddit-guest-riddle-not-found");
      /** Only an issued, matching round can consume a guest attempt. */
      const prior = attempts.get(sessionToken);
      if (!prior || prior.riddleId !== riddleId) throw new Error("reddit-guest-session-not-found");
      /** Normalizes d. */
      const normalized = guess.toLocaleLowerCase("en");
      /** Retries preserve their verdict even after the round has completed. */
      const receipt = prior.receipts.get(requestId);
      if (receipt) {
        if (receipt.guess !== normalized) throw new Error("reddit-guest-request-conflict");
        return {...receipt.result, feedback: receipt.result.feedback.map(cell => ({...cell}))};
      }
      if (prior.correct || prior.completion || prior.count >= 5) throw new Error("reddit-guest-session-complete");
      if (splitGraphemes(normalized).length !== splitGraphemes(source.answer).length) throw new Error("reddit-guest-invalid-guess");
      /** Provides count behavior. */
      const count = prior.count + 1;
      /** Provides correct behavior. */
      const correct = normalized === source.answer;
      prior.count = count;
      prior.correct = correct;
      prior.guesses.push(normalized);
      /** Provides statuses behavior. */
      const statuses = computeFeedback(normalized, source.answer);
      /** The shared five-attempt decision must match the guest authority's verdict. */
      const result: SinglePlayerGuessResult = {
        feedback: splitGraphemes(normalized).map((letter, index) => ({letter, status: statuses[index] ?? "red"})),
        attempts: count,
        isCorrect: correct,
        gameOver: correct,
        canContinue: !correct && count === 5,
      };
      prior.receipts.set(requestId, {guess: normalized, result});
      return {...result, feedback: result.feedback.map(cell => ({...cell}))};
    },
    /** Completes game. */
    async completeGame({riddleId, gameMode, sessionToken}) {
      /** Provides result behavior. */
      const result = attempts.get(sessionToken);
      if (gameMode !== "classic" || result?.riddleId !== riddleId || (!result.correct && result.count < 5)) throw new Error("reddit-guest-game-not-complete");
      if (result.completion) return {...result.completion, newlyUnlockedAchievementIds: [], rewardBreakdown: {...result.completion.rewardBreakdown!}};
      profile = {
        ...profile,
        gamesPlayed: profile.gamesPlayed + 1,
        wins: profile.wins + (result.correct ? 1 : 0),
        classicIndex: profile.classicIndex + 1,
        coins: 0,
        xp: 0,
        achievements: [],
      };
      result.completion = {
        attempts: result.count,
        isCorrect: result.correct,
        coinsEarned: 0,
        newlyUnlockedAchievementIds: [],
        newXp: 0,
        newLevel: 1,
        newWinStreak: 0,
        rewardBreakdown: {newBalance: 0, totalAwarded: 0},
      };
      // Commit the receipt before publishing profile changes to synchronous subscribers.
      emit();
      return {...result.completion, newlyUnlockedAchievementIds: [], rewardBreakdown: {...result.completion.rewardBreakdown!}};
    },
    requestHint: unavailable,
    spendCoins: unavailable,
    /** Provides skip riddle behavior. */
    async skipRiddle() {
      profile = {...profile, classicIndex: profile.classicIndex + 1};
      emit();
      return {success: true, message: "Skipped.", costDeducted: 0, newCoins: profile.coins,
        newProgress: {classicIndex: profile.classicIndex}};
    },
    requestPurchase: unavailable,
    /** Loads leaderboard. */
    async loadLeaderboard() {
      return {entries: [], nextCursor: null};
    },
    updateUsername: unavailable,
    updateAvatar: unavailable,
    deleteAccount: unavailable,
    listRaceCategories: unavailable,
    startRace: unavailable,
    readyRace: unavailable,
    submitRaceGuess: unavailable,
    requestRaceHint: unavailable,
    skipRaceRiddle: unavailable,
    resumeRace: unavailable,
    abandonRace: unavailable,
    publishRace: unavailable,
    getRaceChallenge: unavailable,
    getRaceOutcome: unavailable,
    listRaceInbox: unavailable,
    blockRival: unavailable,
    reportRival: unavailable,
    /** Gets race access. */
    async getRaceAccess() {
      return {enabled: false, locale: "en", reason: "rollout_disabled"};
    },
    recordRaceAnalytics: unavailable,
  };
};
