import {computeFeedback, splitGraphemes} from "@qwordly/core/game";
import type {BridgeProfile, BridgeRiddle, BridgeUser} from "@qwordly/core/bridge";
import type {AuthSnapshot, HostServices} from "../play/types";

/** Provides riddles behavior. */
const riddles = [
  {id: "reddit-guest-1", text: "What has keys but cannot open doors?", answer: "piano"},
  {id: "reddit-guest-2", text: "What has a face and hands but no arms?", answer: "clock"},
] as const;
/** Provides unavailable behavior. */
const unavailable = async (): Promise<never> => { throw new Error("reddit-login-required"); };
/** Provides guest user behavior. */
const guestUser: BridgeUser = {uid: "reddit-guest", displayName: "Guest Solver", isAnonymous: true};

/** Creates an isolated, non-economic solo engine for logged-out Reddit sessions. */
export const createRedditGuestHostServices = (savedProfile?: BridgeProfile): HostServices => {
  let profile: BridgeProfile = {
    username: "Guest Solver", coins: 0, level: 1, xp: 0, winStreak: 0,
    gamesPlayed: savedProfile?.gamesPlayed ?? 0,
    wins: savedProfile?.wins ?? 0,
    achievements: [], classicIndex: Math.max(1, savedProfile?.classicIndex ?? 1),
  };
  const subscribers = new Set<(snapshot: AuthSnapshot) => void>();
  const attempts = new Map<string, {count: number; correct: boolean}>();
  const emit = () => subscribers.forEach((listener) => listener({user: guestUser, profile}));
  const riddleFor = (classicIndex = profile.classicIndex) => riddles[(Math.max(1, classicIndex) - 1) % riddles.length];

  return {
    products: [],
    auth: {
      subscribe(listener) {
        subscribers.add(listener);
        listener({user: guestUser, profile});
        return () => subscribers.delete(listener);
      },
    },
    async loadProfile() { return profile; },
    async loadRiddle({gameMode, classicIndex}) {
      if (gameMode !== "classic") throw new Error("reddit-login-required");
      const source = riddleFor(classicIndex);
      const prior = attempts.get(source.id);
      return {
        riddleId: source.id,
        text: source.text,
        answerLength: splitGraphemes(source.answer).length,
        sessionToken: `00000000-0000-4000-8000-00000000000${source === riddles[0] ? "1" : "2"}`,
        gameMode: "classic",
        index: classicIndex ?? profile.classicIndex,
        attemptsUsed: prior?.count ?? 0,
        hasUsedContinue: false,
        awaitingContinue: false,
      } satisfies BridgeRiddle;
    },
    async submitGuess({riddleId, gameMode, guess}) {
      if (gameMode !== "classic") throw new Error("reddit-login-required");
      const source = riddles.find(({id}) => id === riddleId);
      if (!source) throw new Error("reddit-guest-riddle-not-found");
      const normalized = guess.toLocaleLowerCase();
      const count = (attempts.get(riddleId)?.count ?? 0) + 1;
      const correct = normalized === source.answer;
      attempts.set(riddleId, {count, correct});
      const statuses = computeFeedback(normalized, source.answer);
      return {
        feedback: splitGraphemes(normalized).map((letter, index) => ({letter, status: statuses[index] ?? "red"})),
        attempts: count, isCorrect: correct, gameOver: correct || count >= 6,
      };
    },
    async completeGame({riddleId}) {
      const result = attempts.get(riddleId);
      if (!result || (!result.correct && result.count < 6)) throw new Error("reddit-guest-game-not-complete");
      profile = {
        ...profile,
        gamesPlayed: profile.gamesPlayed + 1,
        wins: profile.wins + (result.correct ? 1 : 0),
        classicIndex: profile.classicIndex + (result.correct ? 1 : 0),
        coins: 0, xp: 0, achievements: [],
      };
      emit();
      return {
        attempts: result.count, isCorrect: result.correct, coinsEarned: 0,
        newlyUnlockedAchievementIds: [], newXp: 0, newLevel: 1, newWinStreak: 0,
        rewardBreakdown: {newBalance: 0, totalAwarded: 0},
      };
    },
    requestHint: unavailable,
    spendCoins: unavailable,
    async skipRiddle() {
      profile = {...profile, classicIndex: profile.classicIndex + 1};
      emit();
      return {success: true, message: "Skipped.", costDeducted: 0, newProgress: {classicIndex: profile.classicIndex}};
    },
    requestPurchase: unavailable,
    async loadLeaderboard() { return []; },
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
    async getRaceAccess() { return {enabled: false, locale: "en", reason: "rollout_disabled"}; },
    recordRaceAnalytics: unavailable,
  };
};
