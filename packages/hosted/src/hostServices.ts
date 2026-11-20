import {getDailyDate} from "@riddle-quest/core/validation";
import type {BridgeProfile, BridgeUser} from "@riddle-quest/core/bridge";
import type {ClassicRiddleBufferResponse} from "@riddle-quest/core/validation";
import {createGameplayAuthorityDelivery, type HostTranslate} from "./gameplayAuthorityDelivery";
import type {CurrentRiddleResponse, GameFunctionsClient} from "./gameFunctions";
import type {AuthSnapshot, HostServices} from "./hostTypes";
import {toBridgeProfile} from "./profileMapper";
import {mapRiddleResponse} from "./riddleResponse";
/** Signed-in account as the host's auth SDK reports it; a structural subset of Firebase's `User`. */
export type HostAuthUser = Readonly<{
  /** Stores uid. */
  uid: string;
  /** Stores metadata. */
  metadata: Readonly<{
    /** Account creation time as an ISO or RFC 2822 string. */
    creationTime?: string;
  }>;
  /** Stores display name. */
  displayName: string | null;
  /** Stores email. */
  email: string | null;
  /** Stores photo url. */
  photoURL: string | null;
  /** Stores is anonymous. */
  isAnonymous: boolean;
}>;
/** Auth surface the host binds to its Firebase Auth instance (browser or React Native). */
export type HostAuth = Readonly<{
  /** Current signed-in account or `null`. */
  readonly currentUser: HostAuthUser | null;
  /** Subscribes to account changes; returns the unsubscribe function. */
  onUserChanged(listener: (user: HostAuthUser | null) => void): () => void;
  /** Signs the current account out. */
  signOut(): Promise<void>;
}>;
/** Everything a host supplies to the shared services. */
export type HostServiceDependencies = Readonly<{
  /** Host auth binding. */
  auth: HostAuth;
  /** Typed game backend callables bound to the host's regions. */
  functions: GameFunctionsClient;
  /** Reads the authoritative account document, or `null` when absent. */
  loadUserDocument(userId: string): Promise<Record<string, unknown> | null>;
  /** Localized copy lookup. */
  translate: HostTranslate;
}>;
/** Provides to bridge user behavior. */
const toBridgeUser = (user: HostAuthUser | null): BridgeUser | null => {
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

/** Creates firebase host services. */
export const createFirebaseHostServices = (deps: HostServiceDependencies): HostServices => {
  /** Host-provided auth, callables, profile reads, and copy. */
  const {auth, functions, loadUserDocument, translate: tr} = deps;
  /** Provides latest snapshot behavior. */
  let latestSnapshot: AuthSnapshot = {user: toBridgeUser(auth.currentUser), profile: null};
  /** Identical renderer retries share a bounded, account-owned authority response. */
  const gameplayDelivery = createGameplayAuthorityDelivery(tr);
  /** Account visits invalidate profile and content responses even after same-UID re-entry. */
  let accountVisit = 0;
  /** Complete request data prevents unrelated operations from sharing a pending receipt. */
  const authorityKey = (operation: string, input: object) => JSON.stringify([latestSnapshot.user?.uid,
    latestSnapshot.user?.accountGeneration, accountVisit, operation,
    Object.entries(input).sort(([first], [second]) => first.localeCompare(second))]);
  /** Only the most recently requested authoritative profile may update the subscribed snapshot. */
  let profileRevision = 0;
  /** Retired native subscription callbacks cannot publish into a later host lifetime. */
  let authObserverVersion = 0;
  /** All consumers of this adapter share one SDK observer and its cleanup. */
  let unsubscribeAuth: (() => void) | null = null;
  /** The classic buffer used by the current operation. */
  let classicBuffer: {
    /** Account owning the issued sessions. */ uid: string;
    /** Content locale. */ locale: string;
    /** Server-issued buffer. */ data: ClassicRiddleBufferResponse;
  } | null = null;
  /** Shared request that fills the Classic queue. */
  let classicBufferInFlight: {
    /** Player requesting the queue. */ uid: string;
    /** Requested content locale. */ locale: string;
    /** Pending response. */ promise: Promise<ClassicRiddleBufferResponse>;
  } | null = null;
  /** Daily response retained until progress changes or the regional day rolls over. */
  let dailyPreload: {
    /** Player owning the Daily session. */ uid: string;
    /** Requested content locale. */ locale: string;
    /** Regional challenge day. */ day: string;
    /** Pending or completed response. */ promise: Promise<CurrentRiddleResponse>;
  } | null = null;
  /** Loads the Daily session once for this player, locale, and regional day. */
  const preloadDaily = (uid: string, locale: string): Promise<CurrentRiddleResponse> => {
    /** regional day associated with the cached Daily response. */
    const day = getDailyDate(locale);
    if (dailyPreload?.uid === uid && dailyPreload.locale === locale && dailyPreload.day === day)
      return dailyPreload.promise;
    /** Request shared by concurrent callers. */
    const promise = functions.getCurrentDailyChallenge({locale, includeEvaluation: true, includeHintRecovery: true, includeGuessRecovery: true}).then(({data}) => {
      // Unavailable content must be fetched again on recovery; only a confirmed completion is durable for the day.
      if (data.error && data.hasCompletedToday !== true && dailyPreload?.promise === promise) dailyPreload = null;
      return data;
    }).catch((error: unknown) => {
      if (dailyPreload?.promise === promise) dailyPreload = null;
      throw error;
    });
    dailyPreload = {uid, locale, day, promise};
    return promise;
  };
  /** Fetches issued Classic sessions without letting an older response replace newer progress. */
  const refreshClassicBuffer = (uid: string, locale: string, force = false): Promise<ClassicRiddleBufferResponse> => {
    if (!force && classicBufferInFlight?.uid === uid && classicBufferInFlight.locale === locale)
      return classicBufferInFlight.promise;
    /** Account lifetime admitting this content request. */
    const visit = accountVisit;
    /** Request shared by concurrent callers. */
    const promise = functions.getClassicRiddleBuffer({locale, includeHintRecovery: true, includeGuessRecovery: true}).then(({data}) => {
      if (visit === accountVisit && latestSnapshot.user?.uid === uid &&
        (classicBuffer?.uid !== uid || classicBuffer.locale !== locale ||
          data.confirmedClassicIndex >= classicBuffer.data.confirmedClassicIndex))
        classicBuffer = {uid, locale, data};
      return data;
    }).finally(() => {
      if (classicBufferInFlight?.promise === promise) classicBufferInFlight = null;
    });
    classicBufferInFlight = {uid, locale, promise};
    return promise;
  };
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

  /** Captures the admitted account visit before an authority operation starts. */
  const captureAccount = () => {
    /** UID and visit must both remain selected when asynchronous work finishes. */
    const uid = latestSnapshot.user?.uid, visit = accountVisit;
    return () => uid !== undefined && visit === accountVisit && latestSnapshot.user?.uid === uid;
  };
  /** Publishes only a current, latest-requested profile; optional callers isolate its failure. */
  const refreshProfile = async (): Promise<BridgeProfile | null> => {
    /** Account identity and request ordering retained through the profile transport. */
    const user = latestSnapshot.user, visit = accountVisit, revision = ++profileRevision;
    if (!user) return null;
    /** Profile remains server authoritative even though its publication is asynchronous. */
    const profile = await reloadProfile(user);
    if (visit !== accountVisit || revision !== profileRevision || latestSnapshot.user?.uid !== user.uid) return null;
    emit({user, profile});
    return profile;
  };
  /** Immediately retires the previous account before loading the replacement's profile. */
  const selectAccount = (user: BridgeUser | null) => {
    /** Repeated notifications for the same account retain its confirmed profile and issued content. */
    const sameAccount = latestSnapshot.user?.uid === user?.uid &&
      latestSnapshot.user?.accountGeneration === user?.accountGeneration;
    if (!sameAccount) {
      accountVisit += 1;
      classicBuffer = null;
      classicBufferInFlight = null;
      dailyPreload = null;
    }
    emit({user, profile: sameAccount ? latestSnapshot.profile : null});
  };

  return {
    products: [],
    /** Starts Daily and Classic downloads when the player session is ready. */
    preloadInitialRiddles(locale) {
      /** Account that owns the issued riddle sessions. */
      const uid = latestSnapshot.user?.uid;
      if (!uid) return;
      void refreshClassicBuffer(uid, locale).catch(() => undefined);
      void preloadDaily(uid, locale).catch(() => undefined);
    },
    auth: {
      /** Provides subscribe behavior. */
      subscribe(listener) {
        // A host may remount after the SDK changed accounts while it had no subscribers.
        if (subscribers.size === 0) selectAccount(toBridgeUser(auth.currentUser));
        /** Each subscription owns a distinct registration even when callbacks are reused. */
        const subscriptionListener = (snapshot: AuthSnapshot) => listener(snapshot);
        subscribers.add(subscriptionListener);
        listener(latestSnapshot);
        if (!unsubscribeAuth) {
          /** One SDK observer belongs to the complete subscriber lifetime. */
          const observerVersion = ++authObserverVersion;
          unsubscribeAuth = auth.onUserChanged(firebaseUser => {
            if (observerVersion !== authObserverVersion) return;
            selectAccount(toBridgeUser(firebaseUser));
            void refreshProfile().catch(() => undefined);
          });
        }
        return () => {
          subscribers.delete(subscriptionListener);
          if (subscribers.size === 0 && unsubscribeAuth) {
            authObserverVersion += 1;
            accountVisit += 1;
            unsubscribeAuth();
            unsubscribeAuth = null;
          }
        };
      },
    },
    /** Loads riddle. */
    async loadRiddle({gameMode, locale, classicIndex, sessionToken, riddleId, authoritative}) {
      /** The selected account visit owns every receipt and follow-up in this content load. */
      const ownsAccount = captureAccount();
      /** A retired read cannot continue under the replacement SDK account. */
      const requireOwner = () => {
        if (!ownsAccount()) throw Object.assign(new Error(tr("ErrorMessages.UNABLE_TO_LOAD_RIDDLES")), {code: "cancelled"});
      };
      requireOwner();
      if (gameMode === "challenge") {
        /** Provides result behavior. */
        const data = !sessionToken && !riddleId && latestSnapshot.user
          ? await preloadDaily(latestSnapshot.user.uid, locale)
          : (await functions.getCurrentDailyChallenge({locale, sessionToken, riddleId, includeEvaluation: true, includeHintRecovery: true, includeGuessRecovery: true})).data;
        requireOwner();
        return mapRiddleResponse(data, "challenge");
      }

      /** The uid used by the current operation. */
      const uid = latestSnapshot.user?.uid;
      if (authoritative && uid) {
        /** Validated riddle response from the host. */
        const fetched = await refreshClassicBuffer(uid, locale, true);
        requireOwner();
        /** A newer confirmed buffer may finish before this read; canonical progress cannot rewind. */
        const data = classicBuffer?.uid === uid && classicBuffer.locale === locale ? classicBuffer.data : fetched;
        /** The issued used by the current operation. */
        const issued = data.riddles.find((item) => item.classicIndex === data.confirmedClassicIndex);
        if (!issued) throw new Error("classic-buffer-unavailable");
        return {...mapRiddleResponse({challenge: {questions: [issued.question], totalQuestions: 1}}, "classic"),
          index: issued.classicIndex};
      }
      /** The requested position, including the initial current question. */
      const requestedIndex = classicIndex ?? latestSnapshot.profile?.classicIndex ?? 1;
      /** Finds a fresh, server-issued question for this account and locale. */
      const findCached = () => {
        /** Issued Classic question buffer for the current player. */
        const buffer = classicBuffer;
        return buffer && buffer.uid === uid && buffer.locale === locale
          ? buffer.data.riddles.find((item) => item.classicIndex === requestedIndex &&
              item.expiresAtMs > Date.now() + 30_000)
          : undefined;
      };
      /** Unexpired issued question matching the requested index. */
      let cached = !sessionToken && !riddleId ? findCached() : undefined;
      if (!cached && uid && !sessionToken && !riddleId) {
        /** Background request that may fill the Classic queue. */
        const pending = refreshClassicBuffer(uid, locale);
        if (requestedIndex > (latestSnapshot.profile?.classicIndex ?? 1)) {
          try {
            await pending;
            cached = findCached();
          } catch {
            // The ordinary current-question callable remains available during buffer outages.
          }
        } else {
          // Show the current question while its three successors download.
          void pending.catch(() => undefined);
        }
      }
      requireOwner();
      if (cached && !sessionToken && !riddleId) {
        /** The riddle used by the current operation. */
        const riddle = mapRiddleResponse({challenge: {questions: [cached.question], totalQuestions: 1}}, "classic");
        if (uid && cached.classicIndex > (classicBuffer?.data.confirmedClassicIndex ?? requestedIndex))
          void refreshClassicBuffer(uid, locale).catch(() => undefined);
        return {...riddle, index: cached.classicIndex};
      }

      /** Provides result behavior. */
      const result = await functions.getCurrentClassicRiddle({
        includeEvaluation: true,
        includeHintRecovery: true, includeGuessRecovery: true,
        classicIndex: requestedIndex,
        includeClassicIndex: true,
        locale,
        sessionToken,
        riddleId,
      });
      requireOwner();
      if (uid) void refreshClassicBuffer(uid, locale).catch(() => undefined);
      return {...mapRiddleResponse(result.data, "classic"), index: result.data.classicIndex ?? requestedIndex};
    },
    /** Loads profile. */
    async loadProfile(userId) {
      // Explicit race/identity reads share publication ordering with mutation and auth refreshes.
      // A superseded read returns no snapshot instead of letting its caller rewind newer host state.
      if (latestSnapshot.user?.uid !== userId) return null;
      return refreshProfile();
    },
    /** Completes game. */
    async completeGame(input) {
      /** Only the admitting account visit owns optional completion follow-up. */
      const ownsAccount = captureAccount();
      /** Concurrent retries share one timely authority receipt and one profile refresh. */
      const result = await gameplayDelivery.run(authorityKey("completion", input), () => functions.completeGame(input), () => {
        if (ownsAccount()) {
          if (input.gameMode === "challenge") dailyPreload = null;
          void refreshProfile().catch(() => undefined);
        }
      });
      return result.data;
    },
    /** Submits guess. */
    async submitGuess(input) {
      /** Terminal follow-up work belongs to the originally authenticated player. */
      const ownsAccount = captureAccount();
      /** One exact guessed request owns its response and terminal refresh work. */
      const result = await gameplayDelivery.run(authorityKey("guess", input), () => functions.submitSinglePlayerGuess(input), ({data}) => {
        if (data.gameOver && ownsAccount() && latestSnapshot.user) {
          if (input.gameMode === "challenge") dailyPreload = null;
          /** Current authenticated player for the background refresh. */
          const user = latestSnapshot.user;
          void refreshProfile().catch(() => undefined);
          if (input.gameMode === "classic" && classicBuffer?.uid === user.uid)
            void refreshClassicBuffer(user.uid, classicBuffer.locale, true).catch(() => undefined);
        }
      });
      return result.data;
    },
    /** Requests hint. */
    async requestHint(input) {
      /** Profile follow-up cannot cross an intervening account replacement. */
      const ownsAccount = captureAccount();
      /** Duplicate paid retries retain the same authority request identity. */
      const result = await gameplayDelivery.run(authorityKey("hint", input), () => functions.getHint(input), () => {
        if (ownsAccount()) void refreshProfile().catch(() => undefined);
      });
      return result.data;
    },
    /** Provides spend coins behavior. */
    async spendCoins(input) {
      /** The accepted debit receipt remains independent of later profile transport. */
      const ownsAccount = captureAccount();
      /** A held Continue cannot permanently retain the host's blocking activity. */
      const result = await gameplayDelivery.run(authorityKey("spend", input), () => functions.spendCoins(input), () => {
        if (ownsAccount()) void refreshProfile().catch(() => undefined);
      });
      return result.data;
    },
    /** Provides skip riddle behavior. */
    async skipRiddle(input) {
      /** Only the admitting account may refresh progression after this paid skip. */
      const ownsAccount = captureAccount();
      /** A repeated Skip shares its pending receipt without starting duplicate refreshes. */
      const result = await gameplayDelivery.run(authorityKey("skip", input), () => functions.skipRiddle(input), () => {
        if (ownsAccount() && latestSnapshot.user) {
          /** Current authenticated player for the background refresh. */
          const user = latestSnapshot.user;
          void refreshProfile().catch(() => undefined);
          if (classicBuffer?.uid === user.uid)
            void refreshClassicBuffer(user.uid, classicBuffer.locale, true).catch(() => undefined);
        }
      });
      return result.data;
    },
    /** Requests purchase. */
    async requestPurchase() {
      throw new Error("Jest checkout is not ready.");
    },
    /** Loads leaderboard. */
    async loadLeaderboard(type) {
      /** Provides result behavior. */
      const result = await functions.getLeaderboard({type, limit: 25});
      return result.data.entries;
    },
    /** Updates username. */
    async updateUsername(username) {
      /** Explicit profile edits retain their account while the callable executes. */
      const ownsAccount = captureAccount();
      await functions.updateUsername({username});
      return ownsAccount() ? refreshProfile() : null;
    },
    /** Updates avatar. */
    async updateAvatar(imageDataUrl) {
      /** Explicit avatar edits retain their account while the callable executes. */
      const ownsAccount = captureAccount();
      await functions.updateAvatar({imageDataUrl});
      return ownsAccount() ? refreshProfile() : null;
    },
    /** Deletes account. */
    async deleteAccount() {
      /** A delayed deletion must never sign out a replacement account. */
      const ownsAccount = captureAccount();
      await functions.deleteAccount({});
      if (!ownsAccount()) return;
      await auth.signOut();
      if (!auth.currentUser) selectAccount(null);
    },
    /** Lists race categories. */
    async listRaceCategories(locale) {
      return (await functions.listRaceCategories({locale})).data;
    },
    /** Starts race. */
    /** Schedules a prepared run after deck delivery. */
    async readyRace(input) { return (await functions.readyRaceRun(input)).data; },
    /** Starts race. */
    async startRace(input) {
      return (await functions.startRaceRun(input)).data;
    },
    /** Submits race guess. */
    async submitRaceGuess(input) {
      return (await functions.submitRaceGuess(input)).data;
    },
    /** Requests race hint. */
    async requestRaceHint(input) {
      return (await functions.requestRaceHint(input)).data;
    },
    /** Provides skip race riddle behavior. */
    async skipRaceRiddle(input) {
      return (await functions.skipRaceRiddle(input)).data;
    },
    /** Provides resume race behavior. */
    async resumeRace(runId) {
      return (await functions.resumeRaceRun({runId, includeEvaluation: true, includeGuessHistory: true})).data;
    },
    /** Provides abandon race behavior. */
    async abandonRace(input) {
      return (await functions.abandonRaceRun(input)).data;
    },
    /** Reserves a provider-invite lobby. */
    async reserveRaceInvite(input) {
      return (await functions.reserveRaceInvite(input)).data;
    },
    /** Publishes race. */
    async publishRace(input) {
      return (await functions.publishRaceChallenge(input)).data;
    },
    /** Gets race challenge. */
    async getRaceEntry(challengeId, locale) {return (await functions.getRaceEntry({challengeId, locale, includeViewerRole: true, includeExistingAttempt: true})).data;},
    /** Delivers creator cancellation through authenticated Firebase. */
    async cancelRaceInvite(input) {return (await functions.cancelRaceInvite(input)).data;},
    /** Reads a legacy public preview. */
    async getRaceChallenge(challengeId, locale) {
      return (await functions.getRaceChallenge({challengeId, locale})).data;
    },
    /** Gets race outcome. */
    async getRaceOutcome(runId) {
      return (await functions.getRaceOutcome({runId})).data;
    },
    /** Lists race inbox. */
    async listRaceInbox(input) {
      return (await functions.listRaceInbox({...input, limit: input?.limit ?? 20})).data;
    },
    /** Provides block rival behavior. */
    async blockRival(targetUserId) {
      return (await functions.blockRival({targetUserId})).data;
    },
    /** Provides report rival behavior. */
    async reportRival(input) {
      return (await functions.reportRival(input)).data;
    },
    /** Gets race access. */
    async getRaceAccess() {
      return (await functions.getRaceAccess({locale: "en"})).data;
    },
    /** Records race analytics. */
    async recordRaceAnalytics(input) {
      return (await functions.recordRaceAnalytics(input)).data;
    },
  };
};
