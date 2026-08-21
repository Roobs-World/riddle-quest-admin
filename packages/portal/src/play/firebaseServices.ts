import type {BridgeProfile, BridgeRiddle, BridgeUser} from "@qwordly/core/bridge";
import {onAuthStateChanged, signOut} from "firebase/auth";
import {
  auth,
  blockRival,
  completeGame,
  getCurrentClassicRiddle,
  getCurrentDailyChallenge,
  getHint,
  getLeaderboard,
  loadUserDocument,
  listRaceCategories,
  listRaceInbox,
  startRaceRun,
  submitRaceGuess,
  requestRaceHint,
  skipRaceRiddle,
  resumeRaceRun,
  abandonRaceRun,
  publishRaceChallenge,
  getRaceChallenge,
  getRaceOutcome,
  getRaceAccess,
  recordRaceAnalytics,
  reportRival,
  skipRiddle,
  submitSinglePlayerGuess,
  spendCoins,
  updateAvatar as updateAvatarCallable,
  updateUsername as updateUsernameCallable,
  deleteAccount as deleteAccountCallable,
  type CurrentRiddleResponse,
} from "../firebase";
import type {AuthSnapshot, HostServices} from "./types";
import {toBridgeProfile} from "./profileMapper";

/** Provides to bridge user behavior. */
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

/** Maps riddle response. */
const mapRiddleResponse = (response: CurrentRiddleResponse, gameMode: "classic" | "challenge"): BridgeRiddle => {
  const question = response.challenge?.questions[0];
  if (!question || response.error) {
    throw new Error(response.error || "No riddle was returned.");
  }

  return {
    riddleId: question.riddleId,
    text: question.text,
    answerLength: question.answerLength,
    sessionToken: question.sessionToken,
    gameMode,
    index: question.questionNumber,
    attemptsUsed: question.attemptsUsed,
    hasUsedContinue: question.hasUsedContinue,
    awaitingContinue: question.awaitingContinue,
  };
};

/** Creates firebase host services. */
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
    async loadRiddle({gameMode, locale, classicIndex, sessionToken, riddleId}) {
      if (gameMode === "challenge") {
        const result = await getCurrentDailyChallenge({locale, sessionToken, riddleId});
        return mapRiddleResponse(result.data, "challenge");
      }

      const result = await getCurrentClassicRiddle({
        classicIndex: classicIndex ?? latestSnapshot.profile?.classicIndex ?? 1,
        locale,
        sessionToken,
        riddleId,
      });
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
    async submitGuess(input) {
      return (await submitSinglePlayerGuess(input)).data;
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
    async deleteAccount() {
      await deleteAccountCallable({});
      await signOut(auth);
      emit({user: null, profile: null});
    },
    async listRaceCategories(locale) {
      return (await listRaceCategories({locale})).data;
    },
    async startRace(input) {
      return (await startRaceRun(input)).data;
    },
    async submitRaceGuess(input) {
      return (await submitRaceGuess(input)).data;
    },
    async requestRaceHint(input) {
      return (await requestRaceHint(input)).data;
    },
    async skipRaceRiddle(input) {
      return (await skipRaceRiddle(input)).data;
    },
    async resumeRace(runId) {
      return (await resumeRaceRun({runId})).data;
    },
    async abandonRace(input) {
      return (await abandonRaceRun(input)).data;
    },
    async publishRace(input) {
      return (await publishRaceChallenge(input)).data;
    },
    async getRaceChallenge(challengeId, locale) {
      return (await getRaceChallenge({challengeId, locale})).data;
    },
    async getRaceOutcome(runId) {
      return (await getRaceOutcome({runId})).data;
    },
    async listRaceInbox(input) {
      return (await listRaceInbox({...input, limit: input?.limit ?? 20})).data;
    },
    async blockRival(targetUserId) {
      return (await blockRival({targetUserId})).data;
    },
    async reportRival(input) {
      return (await reportRival(input)).data;
    },
    async getRaceAccess() {
      return (await getRaceAccess({locale: "en"})).data;
    },
    async recordRaceAnalytics(input) {
      return (await recordRaceAnalytics(input)).data;
    },
  };
};
