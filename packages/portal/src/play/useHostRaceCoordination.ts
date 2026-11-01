import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {BridgeProfile, HostToGameMessage} from "@qwordly/core/bridge";
import type {ListRaceCategoriesResponse} from "@qwordly/core/race";
import {trackEvent} from "../analytics/events";
import type {Locale} from "./i18n";
import {createRequestId} from "./requestIds";
import {isRaceTo10Enabled} from "./race/logic/raceFeatureFlag";
import type {AuthSnapshot, HostServices} from "@qwordly/hosted/hostTypes";
import type {HostAuthorityModules} from "./HostAuthorityModules";

/** Result fields that can change profile state after a multiplayer operation. */
export type RaceProgressResult = Readonly<{
  /** Achievement identifiers unlocked by the authoritative operation. */
  newlyUnlockedAchievementIds?: string[];
  /** Authoritative coin balance returned by the operation. */
  newCoins?: number;
}>;

/** Configuration owned by the host race-coordination module. */
type HostRaceCoordinationOptions = Readonly<{
  /** Current authenticated host state. */
  authSnapshot: AuthSnapshot;
  /** User representation enriched with target registration state. */
  bridgeUser: AuthSnapshot["user"];
  /** Current game locale. */
  locale: Locale;
  /** Present race authority, absent for a Capability Gap. */
  race: HostAuthorityModules["race"];
  /** Profile authority shared with authenticated host state. */
  identity: Pick<HostServices, "loadProfile">;
  /** Challenge deep link, which makes category preloading unnecessary. */
  initialRaceChallengeId?: string;
  /** Locale eligibility policy supplied by the active target. */
  raceLocalePolicy: "english-only" | "all";
  /** Applies an authoritative balance to authenticated host state. */
  applyCoinBalance: (coins?: number, ownerId?: string) => void;
  /** Replaces authenticated host profile state after a refresh. */
  replaceProfile: (profile: BridgeProfile | null, ownerId?: string) => void;
  /** Immediate subscription ownership, independent of queued React rendering. */
  ownsAccount?: (ownerId: string) => boolean;
  /** Captures the account visit before asynchronous reward work begins. */
  captureAccount?: (ownerId?: string) => () => boolean;
  /** Delivers a protocol message to the embedded game. */
  postToGame: (message: HostToGameMessage) => void;
}>;

/** Race state and operations consumed by the host shell. */
export type HostRaceCoordination = Readonly<{
  /** Whether the build-time or query-string race rollout is enabled. */
  enabled: boolean;
  /** Categories loaded ahead of opening the multiplayer flow. */
  prefetchedCategories: ListRaceCategoriesResponse["categories"];
  /** Reconciles authoritative multiplayer rewards with host state. */
  syncProgress: (result: RaceProgressResult) => Promise<boolean>;
}>;

/** Owns multiplayer rollout, category preloading, and profile reconciliation. */
export function useHostRaceCoordination({
  authSnapshot,
  bridgeUser,
  locale,
  race,
  identity,
  initialRaceChallengeId,
  raceLocalePolicy,
  applyCoinBalance,
  replaceProfile,
  ownsAccount,
  captureAccount,
  postToGame,
}: HostRaceCoordinationOptions): HostRaceCoordination {
  /** Stable race rollout decision for the lifetime of this host. */
  const enabled = useMemo(
    () =>
      isRaceTo10Enabled({
        search: window.location.search,
        envValue: import.meta.env.VITE_RACE_TO_10_ENABLED,
      }),
    [],
  );
  /** Catalog selection identity changes before passive effect cleanup can clear stale data. */
  const prefetchScope = useMemo(() => ({}), [authSnapshot.user?.uid, captureAccount, enabled, initialRaceChallengeId, locale, race, raceLocalePolicy]);
  /** Categories remain attached to the account, locale and authority that loaded them. */
  const [prefetched, setPrefetched] = useState<{
    /** Exact selection lifetime under which access and categories were fetched. */
    scope: typeof prefetchScope;
    /** Catalog accepted from the selected race authority. */
    categories: ListRaceCategoriesResponse["categories"];
  } | null>(null);

  /** Reward reconciliation belongs to one account and identity-loader lifetime. */
  const lifetime = useMemo(() => ({active: true, sequence: 0}), [authSnapshot.user?.uid, identity.loadProfile]);
  /** Render-time ownership invalidates old callbacks before effect cleanup runs. */
  const currentOwner = useRef({lifetime, user: bridgeUser, ownsAccount});
  currentOwner.current = {lifetime, user: bridgeUser, ownsAccount};
  useEffect(() => {
    lifetime.active = true;
    return () => {lifetime.active = false; lifetime.sequence++;};
  }, [lifetime]);

  /** This rendered account visit cannot survive a switch away and back before React commits. */
  const accountScope = captureAccount?.(authSnapshot.user?.uid);
  useEffect(() => {
    /** Prevents stale requests from updating a changed session or locale. */
    let cancelled = false;
    setPrefetched(null);
    if (!enabled || !race || !authSnapshot.user || accountScope?.() === false || (raceLocalePolicy === "english-only" && locale !== "en")) return;

    void Promise.resolve()
      .then(() => {
        // Optional providers may throw before returning a promise; retired effects issue no read.
        if (cancelled || accountScope?.() === false) return {enabled: false};
        return race.getRaceAccess();
      })
      .then(async (access) => {
        if (!access.enabled || cancelled || accountScope?.() === false || initialRaceChallengeId) return;
        try {
          /** Categories returned for the current locale. */
          const response = await race.listRaceCategories(locale);
          if (!cancelled && accountScope?.() !== false) setPrefetched({scope: prefetchScope, categories: response.categories});
        } catch (error) {
          console.warn("[riddle-quest-race-prefetch] Unable to preload categories", error);
        }
      })
      .catch((error) => {
        console.warn("[riddle-quest-race-access] Unable to load rollout access", error);
      });

    return () => {
      cancelled = true;
    };
  }, [prefetchScope]);

  /** Reconciles multiplayer rewards and refreshes the authoritative profile. */
  const syncProgress = useCallback(
    async (result: RaceProgressResult) => {
      /** Account returned by the original authoritative operation. */
      const user = authSnapshot.user;
      if (!user || accountScope?.() === false || !lifetime.active || currentOwner.current.lifetime !== lifetime || currentOwner.current.ownsAccount?.(user.uid) === false) return false;
      /** A newer reward refresh supersedes an older profile request for the same account. */
      const sequence = ++lifetime.sequence;
      /** Independent completed runs retain their provider follow-up while this account remains current. */
      const accountOwned = () => accountScope?.() !== false && lifetime.active && currentOwner.current.lifetime === lifetime && currentOwner.current.ownsAccount?.(user.uid) !== false;
      /** Only the newest refresh may replace profile state for that same account. */
      const owned = () => accountOwned() && lifetime.sequence === sequence;
      applyCoinBalance(result.newCoins, user.uid);
      if (!owned()) return accountOwned();
      for (const achievementId of result.newlyUnlockedAchievementIds ?? []) {
        trackEvent("unlock_achievement", {achievement_id: achievementId, source: "multiplayer"});
        if (!owned()) return accountOwned();
      }

      try {
        /** Fresh profile after the server applies all rewards. */
        const profile = await identity.loadProfile(user.uid);
        if (!owned()) return accountOwned();
        // Providers may return null when a newer read or account retirement supersedes this refresh.
        // The current subscription retains its valid projection; the race follow-up stays account-owned.
        if (profile === null) return accountOwned();
        replaceProfile(profile, user.uid);
        if (!owned()) return accountOwned();
        postToGame({
          type: "host:authState",
          requestId: createRequestId("race-profile"),
          payload: {user: currentOwner.current.user, profile},
        });
      } catch (error) {
        console.warn("[riddle-quest-race-achievements] Profile refresh failed", error);
      }
      return accountOwned();
    },
    [accountScope, applyCoinBalance, authSnapshot.user, identity, lifetime, postToGame, replaceProfile],
  );

  useEffect(() => {
    /** Refresh authority after a live victory without trusting event currency fields. */
    const completed = (event: Event) => {
      if ((event as CustomEvent<{
        /** Account whose authoritative balance should be reloaded. */
        ownerId?: string;
      }>).detail?.ownerId === authSnapshot.user?.uid) void syncProgress({});
    };
    window.addEventListener("riddle-quest:live-race-completed", completed);
    return () => window.removeEventListener("riddle-quest:live-race-completed", completed);
  }, [authSnapshot.user?.uid, syncProgress]);

  /** Never expose a previous catalog during the replacement render before effects run. */
  const prefetchedCategories = prefetched?.scope === prefetchScope && accountScope?.() !== false ? prefetched.categories : [];
  return {enabled, prefetchedCategories, syncProgress};
}
