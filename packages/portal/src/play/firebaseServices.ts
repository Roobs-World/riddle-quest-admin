import {splitGraphemes} from "@qwordly/core/game";
import {cloneProductPricingCatalog} from "@qwordly/core/pricing/catalog";
import type {BridgeProfile, BridgeRiddle, BridgeUser} from "@qwordly/core/bridge";
import {onAuthStateChanged} from "firebase/auth";
import {
  awardedAdCallback,
  auth,
  completeGame,
  getCurrentClassicRiddle,
  getCurrentDailyChallenge,
  getHint,
  getLeaderboard,
  loadUserDocument,
  signInAsGuest,
  signInWithEmail,
  signInWithFacebook,
  signInWithGoogle,
  signOutPortal,
  skipRiddle,
  spendCoins,
  updateUsername as updateUsernameCallable,
  type CurrentRiddleResponse,
} from "../firebase";
import {
  createNotConfiguredPurchaseProvider,
  createNotConfiguredRewardedAdProvider,
} from "./providers";
import type {
  AuthSnapshot,
  HostServices,
  ProductSummary,
  WebPurchaseProvider,
  WebRewardedAdProvider,
} from "./types";
import {toProductSummaries} from "./types";

const toBridgeUser = (user: typeof auth.currentUser): BridgeUser | null => {
  if (!user) {
    return null;
  }

  return {
    uid: user.uid,
    displayName: user.displayName ?? undefined,
    email: user.email ?? undefined,
    photoURL: user.photoURL ?? undefined,
    isAnonymous: user.isAnonymous,
  };
};

const toNumber = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const toStringArray = (value: unknown): string[] => (Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : []);

const toBridgeProfile = (user: BridgeUser, data: Record<string, unknown> | null): BridgeProfile => {
  const stats = typeof data?.stats === "object" && data.stats ? (data.stats as Record<string, unknown>) : {};
  const progress = typeof data?.progress === "object" && data.progress ? (data.progress as Record<string, unknown>) : {};

  return {
    username:
      (typeof data?.username === "string" && data.username) ||
      user.displayName ||
      user.email?.split("@")[0] ||
      "Player",
    coins: Math.max(0, Math.floor(toNumber(data?.coins, 0))),
    level: Math.max(1, Math.floor(toNumber(stats.level, 1))),
    xp: Math.max(0, Math.floor(toNumber(stats.xp, 0))),
    winStreak: Math.max(0, Math.floor(toNumber(stats.winStreak, 0))),
    gamesPlayed: Math.max(0, Math.floor(toNumber(stats.gamesPlayed, 0))),
    wins: Math.max(0, Math.floor(toNumber(stats.wins ?? stats.totalWins, 0))),
    achievements: toStringArray(data?.unlockedAchievements).map((entry) => entry),
    classicIndex: Math.max(1, Math.floor(toNumber(progress.classicIndex, 1))),
  };
};

const mapRiddleResponse = (response: CurrentRiddleResponse, gameMode: "classic" | "challenge"): BridgeRiddle => {
  const question = response.challenge?.questions[0];
  if (!question || response.error) {
    throw new Error(response.error || "No riddle was returned.");
  }

  return {
    riddleId: question.riddleId,
    text: question.text,
    answer: question.answer,
    answerLength: splitGraphemes(question.answer).length,
    gameMode,
    index: question.questionNumber,
  };
};

export const createFirebaseHostServices = ({
  purchaseProvider = createNotConfiguredPurchaseProvider(),
  rewardedAdProvider = createNotConfiguredRewardedAdProvider(),
}: {
  purchaseProvider?: WebPurchaseProvider;
  rewardedAdProvider?: WebRewardedAdProvider;
} = {}): HostServices => {
  const products: ProductSummary[] = toProductSummaries(cloneProductPricingCatalog());
  let latestSnapshot: AuthSnapshot = {user: toBridgeUser(auth.currentUser), profile: null};
  const subscribers = new Set<(snapshot: AuthSnapshot) => void>();

  const emit = (snapshot: AuthSnapshot) => {
    latestSnapshot = snapshot;
    subscribers.forEach((subscriber) => subscriber(snapshot));
  };

  const reloadProfile = async (user: BridgeUser | null): Promise<BridgeProfile | null> => {
    if (!user) {
      return null;
    }
    return toBridgeProfile(user, await loadUserDocument(user.uid));
  };

  return {
    products,
    auth: {
      subscribe(listener) {
        subscribers.add(listener);
        listener(latestSnapshot);
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          const user = toBridgeUser(firebaseUser);
          emit({user, profile: await reloadProfile(user)});
        });
        return () => {
          subscribers.delete(listener);
          unsubscribe();
        };
      },
      async signInGuest() {
        await signInAsGuest();
      },
      async signInEmail(email, password) {
        await signInWithEmail(email, password);
      },
      async signInGoogle() {
        await signInWithGoogle();
      },
      async signInFacebook() {
        await signInWithFacebook();
      },
      async signOut() {
        await signOutPortal();
      },
    },
    async loadRiddle({gameMode, locale, classicIndex}) {
      if (gameMode === "challenge") {
        const result = await getCurrentDailyChallenge({});
        return mapRiddleResponse(result.data, "challenge");
      }

      const result = await getCurrentClassicRiddle({classicIndex: classicIndex ?? latestSnapshot.profile?.classicIndex ?? 1, locale});
      return mapRiddleResponse(result.data, "classic");
    },
    async loadProfile(userId) {
      const user = latestSnapshot.user?.uid === userId ? latestSnapshot.user : null;
      return reloadProfile(user);
    },
    async completeGame(input) {
      const result = await completeGame(input);
      if (latestSnapshot.user) {
        emit({user: latestSnapshot.user, profile: await reloadProfile(latestSnapshot.user)});
      }
      return result.data;
    },
    async requestHint(input) {
      const result = await getHint(input);
      if (latestSnapshot.user) {
        emit({user: latestSnapshot.user, profile: await reloadProfile(latestSnapshot.user)});
      }
      return result.data;
    },
    async spendCoins(input) {
      const result = await spendCoins(input);
      if (latestSnapshot.user) {
        emit({user: latestSnapshot.user, profile: await reloadProfile(latestSnapshot.user)});
      }
      return result.data;
    },
    async skipRiddle(input) {
      const result = await skipRiddle(input);
      if (latestSnapshot.user) {
        emit({user: latestSnapshot.user, profile: await reloadProfile(latestSnapshot.user)});
      }
      return result.data;
    },
    async requestPurchase(productId) {
      const product = products.find((entry) => entry.productId === productId);
      if (!product) {
        throw new Error("Product not found.");
      }
      return purchaseProvider.purchase(product, latestSnapshot.profile);
    },
    async requestRewardedAd({placement, userId}) {
      const adResult = await rewardedAdProvider.requestReward(placement);
      const callbackResult = await awardedAdCallback({
        userId,
        placement,
        callbackId: adResult.callbackId,
        provider: adResult.provider,
      });
      if (latestSnapshot.user) {
        emit({user: latestSnapshot.user, profile: await reloadProfile(latestSnapshot.user)});
      }
      return {
        success: callbackResult.data.success,
        placement: callbackResult.data.placement,
        callbackId: callbackResult.data.callbackId,
        provider: adResult.provider,
        rewardCoins: callbackResult.data.rewardCoins,
        newCoins: callbackResult.data.newCoins,
        alreadyProcessed: callbackResult.data.alreadyProcessed,
      };
    },
    async loadLeaderboard(type) {
      const result = await getLeaderboard({type, limit: 25});
      return result.data.entries;
    },
    async updateUsername(username) {
      await updateUsernameCallable({username});
      if (!latestSnapshot.user) {
        return null;
      }
      const profile = await reloadProfile(latestSnapshot.user);
      emit({user: latestSnapshot.user, profile});
      return profile;
    },
  };
};
