import {getSoloWinCoins, SOLO_COIN_COSTS} from "@qwordly/core/game";
import {computeFeedback, splitGraphemes} from "@qwordly/core/game";
import {cloneProductPricingCatalog} from "@qwordly/core/pricing/catalog";
import type {BridgeLeaderboardEntry, BridgeProfile, BridgeRiddle, BridgeUser} from "@qwordly/core/bridge";
import type {AuthSnapshot, HostServices, LeaderboardType, ProductSummary} from "./types";
import {toProductSummaries} from "./types";
import {createFakeRaceServices} from "./race/testing/fakeRaceServices";
import {predictCompletionAchievementIds} from "./predictCompletionAchievements";
import {CONTINUE_COIN_COST, SKIP_COIN_COST} from "./modalPages/commerce/commerceCosts";

/** Provides fake riddles behavior. */
const fakeRiddles: Array<
  BridgeRiddle & {
    /** Stores answer. */
    answer: string;
  }
> = [
  {
    riddleId: "classic-fake-1",
    text: "What has keys but cannot open doors?",
    answer: "piano",
    answerLength: 5,
    sessionToken: "00000000-0000-4000-8000-000000000001",
    gameMode: "classic",
    index: 1,
    attemptsUsed: 0,
    hasUsedContinue: false,
    awaitingContinue: false,
  },
  {
    riddleId: "classic-fake-2",
    text: "What has a face and hands but no arms?",
    answer: "clock",
    answerLength: 5,
    sessionToken: "00000000-0000-4000-8000-000000000002",
    gameMode: "classic",
    index: 2,
    attemptsUsed: 0,
    hasUsedContinue: false,
    awaitingContinue: false,
  },
  {
    riddleId: "daily-fake-1",
    text: "I speak without a mouth and hear without ears. What am I?",
    answer: "echo",
    answerLength: 4,
    sessionToken: "00000000-0000-4000-8000-000000000003",
    gameMode: "challenge",
    index: 0,
    attemptsUsed: 0,
    hasUsedContinue: false,
    awaitingContinue: false,
  },
];

/** Creates fake user. */
const createFakeUser = (): BridgeUser => ({
  uid: "jest-guest",
  displayName: "Guest Solver",
  email: undefined,
  photoURL: undefined,
  isAnonymous: true,
});

/** Creates fake profile. */
const createFakeProfile = (): BridgeProfile => ({
  username: "Guest Solver",
  coins: 300,
  level: 3,
  xp: 420,
  winStreak: 2,
  gamesPlayed: 7,
  wins: 5,
  achievements: ["first_win", "daily_spark"],
  classicIndex: 1,
});

/** Provides leaderboard rows behavior. */
const leaderboardRows: BridgeLeaderboardEntry[] = [
  {userId: "jest-guest", username: "Guest Solver", level: 3, xp: 420, totalWins: 5, multiplayerWins: 3, bestStreak: 2},
  {
    userId: "mira",
    username: "Mira",
    avatarUrl:
      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMzIiIGZpbGw9IiM4YzVkYmUiLz48dGV4dCB4PSIzMiIgeT0iNDEiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMjgiIGZpbGw9IndoaXRlIj5NPC90ZXh0Pjwvc3ZnPg==",
    level: 8,
    xp: 2220,
    totalWins: 29,
    multiplayerWins: 17,
    bestStreak: 9,
  },
  {userId: "tal", username: "Tal", level: 6, xp: 1540, totalWins: 21, multiplayerWins: 9, bestStreak: 6},
  ...Array.from({length: 20}, (_, index) => ({
    userId: `solver-${index + 1}`,
    username: `Solver ${index + 1}`,
    level: 2 + (index % 7),
    xp: 360 + index * 85,
    totalWins: 4 + index,
    multiplayerWins: 1 + index,
    bestStreak: 1 + (index % 11),
  })),
];

/** Creates fake host services. */
export const createFakeHostServices = ({
  initiallyAuthenticated = true,
  dailyUnavailable = false,
  dailyCompleted = false,
}: {
  /** Stores initially authenticated. */
  initiallyAuthenticated?: boolean;
  /** Trusted browser harness simulates the real absent Daily response. */
  dailyUnavailable?: boolean;
  /** Trusted browser authority confirms today's Daily was completed before this visit. */
  dailyCompleted?: boolean;
} = {}): HostServices => {
  /** Provides products behavior. */
  const products = toProductSummaries(cloneProductPricingCatalog());
  /** Provides snapshot behavior. */
  let snapshot: AuthSnapshot = initiallyAuthenticated
    ? {user: createFakeUser(), profile: createFakeProfile()}
    : {user: null, profile: null};
  /** Provides subscribers behavior. */
  const subscribers = new Set<(nextSnapshot: AuthSnapshot) => void>();
  /** Provides race services behavior. */
  const raceServices = createFakeRaceServices();
  /** Provides single player results behavior. */
  const singlePlayerResults = new Map<
    string,
    {
      /** Stores attempts. */
      attempts: number;
      /** Stores is correct. */
      isCorrect: boolean;
      /** Stores game over. */
      gameOver: boolean;
      /** Stores has used continue. */
      hasUsedContinue: boolean;
      /** Stores awaiting continue. */
      awaitingContinue: boolean;
    }
  >();

  /** Provides emit behavior. */
  const emit = () => {
    subscribers.forEach((subscriber) => subscriber(snapshot));
  };

  /** Updates profile. */
  const updateProfile = (patch: Partial<BridgeProfile>): BridgeProfile | null => {
    if (!snapshot.profile) {
      return null;
    }
    snapshot = {
      ...snapshot,
      profile: {
        ...snapshot.profile,
        ...patch,
      },
    };
    emit();
    return snapshot.profile;
  };

  /** Provides spend behavior. */
  const spend = (amount: number): number => {
    /** Provides current coins behavior. */
    const currentCoins = snapshot.profile?.coins ?? 0;
    if (currentCoins < amount) {
      throw new Error("Not enough coins.");
    }
    return updateProfile({coins: currentCoins - amount})?.coins ?? 0;
  };

  return {
    ...raceServices,
    /** Gets race access. */
    async getRaceAccess() {
      return {enabled: true, locale: "en" as const, reason: "enabled" as const};
    },
    /** Records race analytics. */
    async recordRaceAnalytics() {
      return {accepted: true as const};
    },
    products,
    auth: {
      /** Provides subscribe behavior. */
      subscribe(listener) {
        subscribers.add(listener);
        listener(snapshot);
        return () => subscribers.delete(listener);
      },
    },
    /** Loads riddle. */
    async loadRiddle({gameMode, classicIndex}) {
      if (dailyCompleted && gameMode === "challenge") throw Object.assign(new Error("Today's daily challenge is already complete."), {code: "daily-completed"});
      if (dailyUnavailable && gameMode === "challenge") throw new Error("No daily challenge available at the moment.");
      /** Provides mode riddles behavior. */
      const modeRiddles = fakeRiddles.filter((entry) => entry.gameMode === gameMode);
      /** Provides index behavior. */
      const index = gameMode === "classic" ? Math.max(0, (classicIndex ?? snapshot.profile?.classicIndex ?? 1) - 1) : 0;
      /** Provides riddle behavior. */
      const riddle = modeRiddles[index % modeRiddles.length];
      /** Provides {answer:  server only answer, ...public riddle} behavior. */
      const {answer: _serverOnlyAnswer, ...publicRiddle} = riddle;
      /** Provides prior behavior. */
      const prior = singlePlayerResults.get(riddle.riddleId);
      return {
        ...publicRiddle,
        gameMode,
        answerLength: splitGraphemes(riddle.answer).length,
        evaluation: {answer: riddle.answer, locale: "en"},
        attemptsUsed: prior?.attempts ?? 0,
        hasUsedContinue: prior?.hasUsedContinue ?? false,
        awaitingContinue: prior?.awaitingContinue ?? false,
      };
    },
    /** Loads profile. */
    async loadProfile() {
      return snapshot.profile;
    },
    /** Submits guess. */
    async submitGuess({riddleId, gameMode, guess}) {
      /** Provides riddle behavior. */
      const riddle = fakeRiddles.find((entry) => entry.riddleId === riddleId && entry.gameMode === gameMode);
      if (!riddle) throw new Error("Riddle not found.");
      /** Provides prior behavior. */
      const prior = singlePlayerResults.get(riddleId);
      if (prior?.awaitingContinue && !prior.hasUsedContinue) {
        throw new Error("Choose whether to continue before submitting another guess.");
      }
      /** Provides attempts behavior. */
      const attempts = (prior?.attempts ?? 0) + 1;
      /** Normalizes d guess. */
      const normalizedGuess = guess.toLocaleLowerCase();
      /** Indicates whether is correct. */
      const isCorrect = normalizedGuess === riddle.answer.toLocaleLowerCase();
      /** Indicates whether has used continue. */
      const hasUsedContinue = prior?.hasUsedContinue ?? false;
      /** Indicates whether can continue. */
      const canContinue = !isCorrect && attempts === 5 && !hasUsedContinue;
      /** Provides game over behavior. */
      const gameOver = isCorrect || attempts >= 6;
      singlePlayerResults.set(riddleId, {
        attempts,
        isCorrect,
        gameOver,
        hasUsedContinue,
        awaitingContinue: canContinue,
      });
      /** Provides letters behavior. */
      const letters = splitGraphemes(normalizedGuess);
      /** Provides statuses behavior. */
      const statuses = computeFeedback(normalizedGuess, riddle.answer);
      return {
        feedback: letters.map((letter, index) => ({letter, status: statuses[index] ?? "red"})),
        attempts,
        isCorrect,
        gameOver,
        ...(canContinue ? {canContinue: true} : {}),
      };
    },
    /** Completes game. */
    async completeGame({riddleId, gameMode}) {
      /** Provides authoritative behavior. */
      const authoritative = singlePlayerResults.get(riddleId);
      if (!authoritative) throw new Error("No authoritative guesses exist.");
      /** Provides {attempts, is correct} behavior. */
      const {attempts, isCorrect} = authoritative;
      // Match the production authority's once-per-day completion routing contract.
      if (gameMode === "challenge" && isCorrect) dailyCompleted = true;
      /** Provides profile behavior. */
      const profile = snapshot.profile;
      /** Provides coins earned behavior. */
      const coinsEarned = isCorrect ? getSoloWinCoins(gameMode, undefined) : 0;
      /** Provides next classic index behavior. */
      const nextClassicIndex =
        gameMode === "classic" && isCorrect ? (profile?.classicIndex ?? 1) + 1 : profile?.classicIndex;
      /** Provides games played behavior. */
      const gamesPlayed = (profile?.gamesPlayed ?? 0) + 1;
      /** Provides total wins behavior. */
      const totalWins = (profile?.totalWins ?? profile?.wins ?? 0) + (isCorrect ? 1 : 0);
      /** Provides total guesses in wins behavior. */
      const totalGuessesInWins = (profile?.totalGuessesInWins ?? 0) + (isCorrect ? attempts : 0);
      /** Provides challenge win streak behavior. */
      const challengeWinStreak =
        gameMode === "challenge" ? (isCorrect ? (profile?.winStreak ?? 0) + 1 : 0) : (profile?.winStreak ?? 0);
      /** Provides score earned behavior. */
      const scoreEarned = isCorrect ? 90 : 0;
      /** Mirrors the unlocks available to immediate client presentation. */
      const newlyUnlockedAchievementIds = predictCompletionAchievementIds(profile, {
        gameMode, isCorrect, attempts, gameOver: true,
      });
      /** Provides next profile behavior. */
      const nextProfile = updateProfile({
        coins: (profile?.coins ?? 0) + coinsEarned,
        gamesPlayed,
        wins: (profile?.wins ?? 0) + (isCorrect ? 1 : 0),
        totalWins,
        challengeWins: (profile?.challengeWins ?? 0) + (isCorrect && gameMode === "challenge" ? 1 : 0),
        dailyPuzzlesCompleted: (profile?.dailyPuzzlesCompleted ?? 0) + (isCorrect && gameMode === "challenge" ? 1 : 0),
        winStreak: challengeWinStreak,
        bestStreak: Math.max(profile?.bestStreak ?? 0, challengeWinStreak),
        totalWordsGuessed: (profile?.totalWordsGuessed ?? 0) + attempts,
        totalGuessesInWins,
        winRate: gamesPlayed > 0 ? Number(((totalWins / gamesPlayed) * 100).toFixed(2)) : 0,
        averageGuesses: totalWins > 0 ? Number((totalGuessesInWins / totalWins).toFixed(2)) : 0,
        totalScore: (profile?.totalScore ?? 0) + scoreEarned,
        xp: (profile?.xp ?? 0) + scoreEarned,
        classicIndex: nextClassicIndex ?? 1,
        highestLevelClassic:
          gameMode === "classic" && isCorrect
            ? Math.max(profile?.highestLevelClassic ?? 0, profile?.classicIndex ?? 1)
            : (profile?.highestLevelClassic ?? 0),
        achievements: [...new Set([...(profile?.achievements ?? []), ...newlyUnlockedAchievementIds])],
      });

      return {
        attempts,
        isCorrect,
        coinsEarned,
        newlyUnlockedAchievementIds,
        newXp: nextProfile?.xp,
        newLevel: nextProfile?.level,
        newWinStreak: nextProfile?.winStreak,
        rewardBreakdown: {
          newBalance: nextProfile?.coins ?? coinsEarned,
          totalAwarded: coinsEarned,
        },
      };
    },
    /** Requests hint. */
    async requestHint({currentAttempt, riddleId}) {
      /** Provides riddle behavior. */
      const riddle = fakeRiddles.find((entry) => entry.riddleId === riddleId) ?? fakeRiddles[0];
      /** Provides answer letters behavior. */
      const answerLetters = splitGraphemes(riddle.answer.toUpperCase());
      /** Provides reveal index behavior. */
      const revealIndex = answerLetters.findIndex((letter, index) => currentAttempt[index]?.toUpperCase() !== letter);

      if (revealIndex < 0) {
        return null;
      }

      /** Provides new coins behavior. */
      const newCoins = spend(SOLO_COIN_COSTS.hint);
      updateProfile({totalHintsUsed: (snapshot.profile?.totalHintsUsed ?? 0) + 1});
      return {
        revealedLetter: answerLetters[revealIndex],
        index: revealIndex,
        coinsCost: SOLO_COIN_COSTS.hint,
        newCoins,
      };
    },
    /** Provides spend coins behavior. */
    async spendCoins({amount, riddleId}) {
      if (amount !== undefined && amount !== CONTINUE_COIN_COST) {
        throw new Error(`Continue costs ${CONTINUE_COIN_COST} coins.`);
      }
      /** Provides prior behavior. */
      const prior = singlePlayerResults.get(riddleId);
      if (prior?.awaitingContinue) {
        singlePlayerResults.set(riddleId, {...prior, hasUsedContinue: true, awaitingContinue: false});
      }
      return {newCoins: spend(CONTINUE_COIN_COST)};
    },
    /** Provides skip riddle behavior. */
    async skipRiddle({gameMode}) {
      if (gameMode === "challenge") {
        throw new Error("Daily riddles cannot be skipped.");
      }
      /** Provides profile behavior. */
      const profile = snapshot.profile;
      /** Provides new coins behavior. */
      const newCoins = spend(SKIP_COIN_COST);
      /** Provides new classic index behavior. */
      const newClassicIndex = (profile?.classicIndex ?? 1) + 1;
      updateProfile({coins: newCoins, classicIndex: newClassicIndex});
      return {
        success: true,
        message: "Skipped.",
        costDeducted: SKIP_COIN_COST,
        newCoins,
        newProgress: {classicIndex: newClassicIndex},
      };
    },
    /** Requests purchase. */
    async requestPurchase(productId) {
      /** Provides product behavior. */
      const product = products.find((entry) => entry.productId === productId);
      if (!product) {
        throw new Error("Product not found.");
      }
      /** Provides result behavior. */
      const result = {
        success: true as const,
        productId: product.productId,
        coinsAwarded: product.coins,
        newCoins: (snapshot.profile?.coins ?? 0) + product.coins,
        newlyUnlockedAchievementIds: product.coins >= 900 ? ["coin_collector"] : [],
      };
      updateProfile({coins: result.newCoins});
      return result;
    },
    /** Loads leaderboard. */
    async loadLeaderboard(type: LeaderboardType) {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      /** Provides rows behavior. */
      const rows = [...leaderboardRows];
      if (type === "totalWins") {
        return rows.sort((left, right) => right.totalWins - left.totalWins);
      }
      if (type === "multiplayerWins") {
        return rows.sort((left, right) => (right.multiplayerWins ?? 0) - (left.multiplayerWins ?? 0));
      }
      if (type === "bestStreak") {
        return rows.sort((left, right) => right.bestStreak - left.bestStreak);
      }
      return rows.sort((left, right) => right.xp - left.xp);
    },
    /** Updates username. */
    async updateUsername(username) {
      return updateProfile({username});
    },
    /** Updates avatar. */
    async updateAvatar(imageDataUrl) {
      return updateProfile({avatarUrl: imageDataUrl});
    },
    /** Deletes account. */
    async deleteAccount() {
      snapshot = {user: null, profile: null};
      emit();
    },
  };
};
