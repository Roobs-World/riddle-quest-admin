import {splitGraphemes} from "@qwordly/core/game";
import {cloneProductPricingCatalog} from "@qwordly/core/pricing/catalog";
import type {BridgeLeaderboardEntry, BridgeProfile, BridgeRiddle, BridgeUser} from "@qwordly/core/bridge";
import {createFakePurchaseProvider, createFakeRewardedAdProvider} from "./providers";
import type {
  AuthSnapshot,
  HostServices,
  LeaderboardType,
  ProductSummary,
  RewardedAdPlacement,
  WebPurchaseProvider,
  WebRewardedAdProvider,
} from "./types";
import {toProductSummaries} from "./types";

const fakeRiddles: BridgeRiddle[] = [
  {
    riddleId: "classic-fake-1",
    text: "What has keys but cannot open doors?",
    answer: "piano",
    answerLength: 5,
    gameMode: "classic",
    index: 1,
  },
  {
    riddleId: "classic-fake-2",
    text: "What has a face and hands but no arms?",
    answer: "clock",
    answerLength: 5,
    gameMode: "classic",
    index: 2,
  },
  {
    riddleId: "daily-fake-1",
    text: "I speak without a mouth and hear without ears. What am I?",
    answer: "echo",
    answerLength: 4,
    gameMode: "challenge",
    index: 0,
  },
];

const createFakeUser = (): BridgeUser => ({
  uid: "jest-guest",
  displayName: "Guest Solver",
  email: undefined,
  photoURL: undefined,
  isAnonymous: true,
});

const createFakeProfile = (): BridgeProfile => ({
  username: "Guest Solver",
  coins: 180,
  level: 3,
  xp: 420,
  winStreak: 2,
  gamesPlayed: 7,
  wins: 5,
  achievements: ["first_win", "daily_spark"],
  classicIndex: 1,
});

const leaderboardRows: BridgeLeaderboardEntry[] = [
  {userId: "jest-guest", username: "Guest Solver", level: 3, xp: 420, totalWins: 5, bestStreak: 2},
  {userId: "mira", username: "Mira", level: 8, xp: 2220, totalWins: 29, bestStreak: 9},
  {userId: "tal", username: "Tal", level: 6, xp: 1540, totalWins: 21, bestStreak: 6},
];

export const createFakeHostServices = ({
  purchaseProvider = createFakePurchaseProvider(),
  rewardedAdProvider = createFakeRewardedAdProvider(),
}: {
  purchaseProvider?: WebPurchaseProvider;
  rewardedAdProvider?: WebRewardedAdProvider;
} = {}): HostServices => {
  const products = toProductSummaries(cloneProductPricingCatalog());
  let snapshot: AuthSnapshot = {user: null, profile: null};
  const subscribers = new Set<(nextSnapshot: AuthSnapshot) => void>();

  const emit = () => {
    subscribers.forEach((subscriber) => subscriber(snapshot));
  };

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

  const spend = (amount: number): number => {
    const currentCoins = snapshot.profile?.coins ?? 0;
    if (currentCoins < amount) {
      throw new Error("Not enough coins.");
    }
    return updateProfile({coins: currentCoins - amount})?.coins ?? 0;
  };

  return {
    products,
    auth: {
      subscribe(listener) {
        subscribers.add(listener);
        listener(snapshot);
        return () => subscribers.delete(listener);
      },
      async signInGuest() {
        snapshot = {user: createFakeUser(), profile: createFakeProfile()};
        emit();
      },
      async signInEmail(email) {
        snapshot = {
          user: {...createFakeUser(), uid: "jest-email-user", email, isAnonymous: false},
          profile: {...createFakeProfile(), username: email.split("@")[0] || "Player"},
        };
        emit();
      },
      async signInGoogle() {
        snapshot = {
          user: {...createFakeUser(), uid: "jest-google-user", displayName: "Google Solver", isAnonymous: false},
          profile: {...createFakeProfile(), username: "Google Solver"},
        };
        emit();
      },
      async signInFacebook() {
        snapshot = {
          user: {...createFakeUser(), uid: "jest-facebook-user", displayName: "Facebook Solver", isAnonymous: false},
          profile: {...createFakeProfile(), username: "Facebook Solver"},
        };
        emit();
      },
      async signOut() {
        snapshot = {user: null, profile: null};
        emit();
      },
    },
    async loadRiddle({gameMode, classicIndex}) {
      const modeRiddles = fakeRiddles.filter((entry) => entry.gameMode === gameMode);
      const index = gameMode === "classic" ? Math.max(0, (classicIndex ?? snapshot.profile?.classicIndex ?? 1) - 1) : 0;
      const riddle = modeRiddles[index % modeRiddles.length];
      return {
        ...riddle,
        gameMode,
        answerLength: splitGraphemes(riddle.answer).length,
      };
    },
    async loadProfile() {
      return snapshot.profile;
    },
    async completeGame({isCorrect, gameMode}) {
      const profile = snapshot.profile;
      const coinsEarned = isCorrect ? (gameMode === "challenge" ? 75 : 50) : 0;
      const nextClassicIndex = gameMode === "classic" && isCorrect ? (profile?.classicIndex ?? 1) + 1 : profile?.classicIndex;
      const nextProfile = updateProfile({
        coins: (profile?.coins ?? 0) + coinsEarned,
        gamesPlayed: (profile?.gamesPlayed ?? 0) + 1,
        wins: (profile?.wins ?? 0) + (isCorrect ? 1 : 0),
        winStreak: isCorrect ? (profile?.winStreak ?? 0) + 1 : 0,
        xp: (profile?.xp ?? 0) + (isCorrect ? 90 : 20),
        classicIndex: nextClassicIndex ?? 1,
      });

      return {
        coinsEarned,
        newlyUnlockedAchievementIds: isCorrect ? ["sharp_solver"] : [],
        newXp: nextProfile?.xp,
        newLevel: nextProfile?.level,
        newWinStreak: nextProfile?.winStreak,
        rewardBreakdown: {
          newBalance: nextProfile?.coins ?? coinsEarned,
          totalAwarded: coinsEarned,
        },
      };
    },
    async requestHint({currentAttempt, riddleId}) {
      const riddle = fakeRiddles.find((entry) => entry.riddleId === riddleId) ?? fakeRiddles[0];
      const answerLetters = splitGraphemes(riddle.answer.toUpperCase());
      const revealIndex = answerLetters.findIndex((letter, index) => currentAttempt[index]?.toUpperCase() !== letter);

      if (revealIndex < 0) {
        return null;
      }

      const newCoins = spend(25);
      return {
        revealedLetter: answerLetters[revealIndex],
        index: revealIndex,
        coinsCost: 25,
        newCoins,
      };
    },
    async spendCoins({reason, amount}) {
      const cost = amount ?? (reason === "continue" ? 50 : reason === "skip" ? 100 : 25);
      return {newCoins: spend(cost)};
    },
    async skipRiddle() {
      const profile = snapshot.profile;
      const newCoins = spend(100);
      const newClassicIndex = (profile?.classicIndex ?? 1) + 1;
      updateProfile({coins: newCoins, classicIndex: newClassicIndex});
      return {
        success: true,
        message: "Skipped.",
        costDeducted: 100,
        newProgress: {classicIndex: newClassicIndex},
      };
    },
    async requestPurchase(productId) {
      const product = products.find((entry) => entry.productId === productId);
      if (!product) {
        throw new Error("Product not found.");
      }
      const result = await purchaseProvider.purchase(product, snapshot.profile);
      updateProfile({coins: result.newCoins});
      return result;
    },
    async requestRewardedAd({placement}: {placement: RewardedAdPlacement}) {
      const adResult = await rewardedAdProvider.requestReward(placement);
      const newCoins = updateProfile({coins: (snapshot.profile?.coins ?? 0) + adResult.rewardCoins})?.coins ?? 0;
      return {
        success: true,
        placement,
        callbackId: adResult.callbackId,
        provider: adResult.provider,
        rewardCoins: adResult.rewardCoins,
        newCoins,
        alreadyProcessed: false,
      };
    },
    async loadLeaderboard(type: LeaderboardType) {
      const rows = [...leaderboardRows];
      if (type === "totalWins") {
        return rows.sort((left, right) => right.totalWins - left.totalWins);
      }
      if (type === "bestStreak") {
        return rows.sort((left, right) => right.bestStreak - left.bestStreak);
      }
      return rows.sort((left, right) => right.xp - left.xp);
    },
    async updateUsername(username) {
      return updateProfile({username});
    },
  };
};
