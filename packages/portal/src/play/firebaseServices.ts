import type {BridgeProfile, BridgeRiddle, BridgeUser} from "@qwordly/core/bridge";
import {onAuthStateChanged, signOut} from "firebase/auth";
import {
  auth,
  blockRival,
  completeGame,
  getCurrentClassicRiddle,
  getClassicRiddleBuffer,
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
import type {ClassicRiddleBufferResponse} from "@qwordly/core/validation";
import {toBridgeProfile} from "./profileMapper";

/** Provides to bridge user behavior. */
const toBridgeUser = (user: typeof auth.currentUser): BridgeUser | null => {
  if (!user) {
    return null;
  }

  return {
    uid: user.uid,
    ...(user.metadata.creationTime && Number.isSafeInteger(Date.parse(user.metadata.creationTime))
      ? {accountGeneration: Date.parse(user.metadata.creationTime)} : {}),
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
    ...(question.evaluation ? {evaluation: question.evaluation} : {}),
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
  /** The classic buffer used by the current operation. */
  let classicBuffer: {
    /** Account owning the issued sessions. */ uid: string;
    /** Content locale. */ locale: string;
    /** Server-issued buffer. */ data: ClassicRiddleBufferResponse;
  } | null = null;
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
    async loadRiddle({gameMode, locale, classicIndex, sessionToken, riddleId, authoritative}) {
      if (gameMode === "challenge") {
        /** Provides result behavior. */
        const result = await getCurrentDailyChallenge({locale, sessionToken, riddleId, includeEvaluation: true});
        return mapRiddleResponse(result.data, "challenge");
      }

      /** The uid used by the current operation. */
      const uid = latestSnapshot.user?.uid;
      if (authoritative && uid) {
        /** The destructured result used by the current operation. */
        const {data} = await getClassicRiddleBuffer({locale});
        classicBuffer = {uid, locale, data};
        /** The issued used by the current operation. */
        const issued = data.riddles.find((item) => item.classicIndex === data.confirmedClassicIndex);
        if (!issued) throw new Error("classic-buffer-unavailable");
        return {...mapRiddleResponse({challenge: {questions: [issued.question], totalQuestions: 1}}, "classic"),
          index: issued.classicIndex};
      }
      /** The buffer used by the current operation. */
      const buffer = classicBuffer;
      /** The cached used by the current operation. */
      let cached = buffer && buffer.uid === uid && buffer.locale === locale
        ? buffer.data.riddles.find((item) =>
            item.classicIndex === classicIndex &&
            item.classicIndex > buffer.data.confirmedClassicIndex &&
            item.expiresAtMs > Date.now() + 30_000,
          )
        : undefined;
      if (!cached && uid && classicIndex &&
        classicIndex > (buffer?.data.confirmedClassicIndex ?? latestSnapshot.profile?.classicIndex ?? 1) &&
        !sessionToken && !riddleId) {
        /** The destructured result used by the current operation. */
        const {data} = await getClassicRiddleBuffer({locale});
        classicBuffer = {uid, locale, data};
        cached = data.riddles.find((item) => item.classicIndex === classicIndex &&
          item.classicIndex > data.confirmedClassicIndex && item.expiresAtMs > Date.now() + 30_000);
      }
      if (cached && !sessionToken && !riddleId) {
        /** The riddle used by the current operation. */
        const riddle = mapRiddleResponse({challenge: {questions: [cached.question], totalQuestions: 1}}, "classic");
        void getClassicRiddleBuffer({locale}).then(({data}) => { classicBuffer = {uid: uid!, locale, data}; }).catch(() => undefined);
        return {...riddle, index: cached.classicIndex};
      }

      /** Provides result behavior. */
      const result = await getCurrentClassicRiddle({
        includeEvaluation: true,
        classicIndex: classicIndex ?? latestSnapshot.profile?.classicIndex ?? 1,
        locale,
        sessionToken,
        riddleId,
      });
      if (uid) void getClassicRiddleBuffer({locale}).then(({data}) => { classicBuffer = {uid, locale, data}; }).catch(() => undefined);
      return {...mapRiddleResponse(result.data, "classic"), index: classicIndex ?? latestSnapshot.profile?.classicIndex ?? 1};
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
      /** The result used by the current operation. */
      const result = (await submitSinglePlayerGuess(input)).data;
      if (result.gameOver && latestSnapshot.user) {
        /** The user used by the current operation. */
        const user = latestSnapshot.user;
        void reloadProfile(user).then((profile) => {
          if (latestSnapshot.user?.uid === user.uid) emit({user, profile});
        }).catch(() => undefined);
      }
      return result;
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
      return (await resumeRaceRun({runId, includeEvaluation: true})).data;
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
