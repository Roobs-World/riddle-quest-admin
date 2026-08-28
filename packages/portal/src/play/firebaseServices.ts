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
  /** Provides question behavior. */
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
  /** Provides latest snapshot behavior. */
  let latestSnapshot: AuthSnapshot = {user: toBridgeUser(auth.currentUser), profile: null};
  /** Provides subscribers behavior. */
  const subscribers = new Set<(snapshot: AuthSnapshot) => void>();

  /** Provides emit behavior. */
  const emit = (snapshot: AuthSnapshot) => {
    latestSnapshot = snapshot;
    subscribers.forEach((subscriber) => subscriber(snapshot));
  };

  /** Provides reload profile behavior. */
  const reloadProfile = async (user: BridgeUser | null): Promise<BridgeProfile | null> => {
    if (!user) {
      return null;
    }
    return toBridgeProfile(user, await loadUserDocument(user.uid));
  };

  return {
    products: [],
    auth: {
      /** Provides subscribe behavior. */
      subscribe(listener) {
        subscribers.add(listener);
        listener(latestSnapshot);
        /** Provides unsubscribe behavior. */
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          /** Provides r. */
          const user = toBridgeUser(firebaseUser);
          emit({user, profile: await reloadProfile(user)});
        });
        return () => {
          subscribers.delete(listener);
          unsubscribe();
        };
      },
    },
    /** Loads riddle. */
    async loadRiddle({gameMode, locale, classicIndex, sessionToken, riddleId}) {
      if (gameMode === "challenge") {
        /** Provides result behavior. */
        const result = await getCurrentDailyChallenge({locale, sessionToken, riddleId});
        return mapRiddleResponse(result.data, "challenge");
      }

      /** Provides result behavior. */
      const result = await getCurrentClassicRiddle({
        classicIndex: classicIndex ?? latestSnapshot.profile?.classicIndex ?? 1,
        locale,
        sessionToken,
        riddleId,
      });
      return mapRiddleResponse(result.data, "classic");
    },
    /** Loads profile. */
    async loadProfile(userId) {
      /** Provides r. */
      const user = latestSnapshot.user?.uid === userId ? latestSnapshot.user : null;
      return reloadProfile(user);
    },
    /** Completes game. */
    async completeGame(input) {
      /** Provides result behavior. */
      const result = await completeGame(input);
      if (latestSnapshot.user) {
        emit({user: latestSnapshot.user, profile: await reloadProfile(latestSnapshot.user)});
      }
      return result.data;
    },
    /** Submits guess. */
    async submitGuess(input) {
      return (await submitSinglePlayerGuess(input)).data;
    },
    /** Requests hint. */
    async requestHint(input) {
      /** Provides result behavior. */
      const result = await getHint(input);
      if (latestSnapshot.user) {
        emit({user: latestSnapshot.user, profile: await reloadProfile(latestSnapshot.user)});
      }
      return result.data;
    },
    /** Provides spend coins behavior. */
    async spendCoins(input) {
      /** Provides result behavior. */
      const result = await spendCoins(input);
      if (latestSnapshot.user) {
        emit({user: latestSnapshot.user, profile: await reloadProfile(latestSnapshot.user)});
      }
      return result.data;
    },
    /** Provides skip riddle behavior. */
    async skipRiddle(input) {
      /** Provides result behavior. */
      const result = await skipRiddle(input);
      if (latestSnapshot.user) {
        emit({user: latestSnapshot.user, profile: await reloadProfile(latestSnapshot.user)});
      }
      return result.data;
    },
    /** Requests purchase. */
    async requestPurchase() {
      throw new Error("Jest checkout is not ready.");
    },
    /** Loads leaderboard. */
    async loadLeaderboard(type) {
      /** Provides result behavior. */
      const result = await getLeaderboard({type, limit: 25});
      return result.data.entries;
    },
    /** Updates username. */
    async updateUsername(username) {
      await updateUsernameCallable({username});
      if (!latestSnapshot.user) {
        return null;
      }
      /** Provides profile behavior. */
      const profile = await reloadProfile(latestSnapshot.user);
      emit({user: latestSnapshot.user, profile});
      return profile;
    },
    /** Updates avatar. */
    async updateAvatar(imageDataUrl) {
      await updateAvatarCallable({imageDataUrl});
      if (!latestSnapshot.user) {
        return null;
      }
      /** Provides profile behavior. */
      const profile = await reloadProfile(latestSnapshot.user);
      emit({user: latestSnapshot.user, profile});
      return profile;
    },
    /** Deletes account. */
    async deleteAccount() {
      await deleteAccountCallable({});
      await signOut(auth);
      emit({user: null, profile: null});
    },
    /** Lists race categories. */
    async listRaceCategories(locale) {
      return (await listRaceCategories({locale})).data;
    },
    /** Starts race. */
    async startRace(input) {
      return (await startRaceRun(input)).data;
    },
    /** Submits race guess. */
    async submitRaceGuess(input) {
      return (await submitRaceGuess(input)).data;
    },
    /** Requests race hint. */
    async requestRaceHint(input) {
      return (await requestRaceHint(input)).data;
    },
    /** Provides skip race riddle behavior. */
    async skipRaceRiddle(input) {
      return (await skipRaceRiddle(input)).data;
    },
    /** Provides resume race behavior. */
    async resumeRace(runId) {
      return (await resumeRaceRun({runId})).data;
    },
    /** Provides abandon race behavior. */
    async abandonRace(input) {
      return (await abandonRaceRun(input)).data;
    },
    /** Publishes race. */
    async publishRace(input) {
      return (await publishRaceChallenge(input)).data;
    },
    /** Gets race challenge. */
    async getRaceChallenge(challengeId, locale) {
      return (await getRaceChallenge({challengeId, locale})).data;
    },
    /** Gets race outcome. */
    async getRaceOutcome(runId) {
      return (await getRaceOutcome({runId})).data;
    },
    /** Lists race inbox. */
    async listRaceInbox(input) {
      return (await listRaceInbox({...input, limit: input?.limit ?? 20})).data;
    },
    /** Provides block rival behavior. */
    async blockRival(targetUserId) {
      return (await blockRival({targetUserId})).data;
    },
    /** Provides report rival behavior. */
    async reportRival(input) {
      return (await reportRival(input)).data;
    },
    /** Gets race access. */
    async getRaceAccess() {
      return (await getRaceAccess({locale: "en"})).data;
    },
    /** Records race analytics. */
    async recordRaceAnalytics(input) {
      return (await recordRaceAnalytics(input)).data;
    },
  };
};
