import {computeFeedback, splitGraphemes} from "@qwordly/core/game";
import type {BridgeProfile, BridgeRiddle, BridgeUser} from "@qwordly/core/bridge";
import type {AuthSnapshot, HostServices} from "../play/types";

/** Provides riddles behavior. */
const riddles = [
  {id: "reddit-guest-1", text: "What has keys but cannot open doors?", answer: "piano"},
  {id: "reddit-guest-2", text: "What has a face and hands but no arms?", answer: "clock"},
] as const;
/** Provides unavailable behavior. */
const unavailable = async (): Promise<never> => {
  throw new Error("reddit-login-required");
};
/** Provides guest user behavior. */
const guestUser: BridgeUser = {uid: "reddit-guest", displayName: "Guest Solver", isAnonymous: true};

/** Creates an isolated, non-economic solo engine for logged-out Reddit sessions. */
export const createRedditGuestHostServices = (savedProfile?: BridgeProfile): HostServices => {
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
      count: number; /** Stores correct. */
      /** Stores correct. */
      correct: boolean;
    }
  >();
  /** Provides emit behavior. */
  const emit = () => subscribers.forEach((listener) => listener({user: guestUser, profile}));
  /** Provides riddle for behavior. */
  const riddleFor = (classicIndex = profile.classicIndex) => riddles[(Math.max(1, classicIndex) - 1) % riddles.length];

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
    async loadRiddle({gameMode, classicIndex}) {
      if (gameMode !== "classic") throw new Error("reddit-login-required");
      /** Provides source behavior. */
      const source = riddleFor(classicIndex);
      /** Provides prior behavior. */
      const prior = attempts.get(source.id);
      return {
        riddleId: source.id,
        text: source.text,
        answerLength: splitGraphemes(source.answer).length,
        evaluation: {answer: source.answer, locale: "en"},
        sessionToken: `00000000-0000-4000-8000-00000000000${source === riddles[0] ? "1" : "2"}`,
        gameMode: "classic",
        index: classicIndex ?? profile.classicIndex,
        attemptsUsed: prior?.count ?? 0,
        hasUsedContinue: false,
        awaitingContinue: false,
      } satisfies BridgeRiddle;
    },
    /** Submits guess. */
    async submitGuess({riddleId, gameMode, guess}) {
      if (gameMode !== "classic") throw new Error("reddit-login-required");
      /** Provides source behavior. */
      const source = riddles.find(({id}) => id === riddleId);
      if (!source) throw new Error("reddit-guest-riddle-not-found");
      /** Normalizes d. */
      const normalized = guess.toLocaleLowerCase();
      /** Provides count behavior. */
      const count = (attempts.get(riddleId)?.count ?? 0) + 1;
      /** Provides correct behavior. */
      const correct = normalized === source.answer;
      attempts.set(riddleId, {count, correct});
      /** Provides statuses behavior. */
      const statuses = computeFeedback(normalized, source.answer);
      return {
        feedback: splitGraphemes(normalized).map((letter, index) => ({letter, status: statuses[index] ?? "red"})),
        attempts: count,
        isCorrect: correct,
        gameOver: correct || count >= 6,
      };
    },
    /** Completes game. */
    async completeGame({riddleId}) {
      /** Provides result behavior. */
      const result = attempts.get(riddleId);
      if (!result || (!result.correct && result.count < 6)) throw new Error("reddit-guest-game-not-complete");
      profile = {
        ...profile,
        gamesPlayed: profile.gamesPlayed + 1,
        wins: profile.wins + (result.correct ? 1 : 0),
        classicIndex: profile.classicIndex + (result.correct ? 1 : 0),
        coins: 0,
        xp: 0,
        achievements: [],
      };
      emit();
      return {
        attempts: result.count,
        isCorrect: result.correct,
        coinsEarned: 0,
        newlyUnlockedAchievementIds: [],
        newXp: 0,
        newLevel: 1,
        newWinStreak: 0,
        rewardBreakdown: {newBalance: 0, totalAwarded: 0},
      };
    },
    requestHint: unavailable,
    spendCoins: unavailable,
    /** Provides skip riddle behavior. */
    async skipRiddle() {
      profile = {...profile, classicIndex: profile.classicIndex + 1};
      emit();
      return {success: true, message: "Skipped.", costDeducted: 0, newProgress: {classicIndex: profile.classicIndex}};
    },
    requestPurchase: unavailable,
    /** Loads leaderboard. */
    async loadLeaderboard() {
      return [];
    },
    updateUsername: unavailable,
    updateAvatar: unavailable,
    deleteAccount: unavailable,
    listRaceCategories: unavailable,
    startRace: unavailable,
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
