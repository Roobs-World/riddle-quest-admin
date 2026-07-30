import {splitGraphemes} from "@qwordly/core/game";
import type {BridgeProfile, BridgeRiddle, BridgeUser} from "@qwordly/core/bridge";
import {onAuthStateChanged} from "firebase/auth";
import {
  auth,
  completeGame,
  getCurrentClassicRiddle,
  getCurrentDailyChallenge,
  getHint,
  getLeaderboard,
  loadUserDocument,
  skipRiddle,
  spendCoins,
  updateAvatar as updateAvatarCallable,
  updateUsername as updateUsernameCallable,
  type CurrentRiddleResponse,
} from "../firebase";
import type {AuthSnapshot, HostServices} from "./types";
import {toBridgeProfile} from "./profileMapper";

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

export const createFirebaseHostServices = (): HostServices => {
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
    products: [],
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
    async requestPurchase() {
      throw new Error("Jest checkout is not ready.");
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
    async updateAvatar(imageDataUrl) {
      await updateAvatarCallable({imageDataUrl});
      if (!latestSnapshot.user) {
        return null;
      }
      const profile = await reloadProfile(latestSnapshot.user);
      emit({user: latestSnapshot.user, profile});
      return profile;
    },
  };
};
