import {useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction} from "react";
import type {HostToGameMessage} from "@qwordly/core/bridge";
import type {ListRaceCategoriesResponse} from "@qwordly/core/race";
import {trackEvent} from "../analytics/events";
import type {Locale} from "./i18n";
import {createRequestId} from "./requestIds";
import {isRaceTo10Enabled} from "./race/logic/raceFeatureFlag";
import type {AuthSnapshot, HostServices} from "./types";

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
  /** Target-neutral host services. */
  services: HostServices;
  /** Challenge deep link, which makes category preloading unnecessary. */
  initialRaceChallengeId?: string;
  /** Locale eligibility policy supplied by the active target. */
  raceLocalePolicy: "english-only" | "all";
  /** Updates the host's authoritative authentication state. */
  setAuthSnapshot: Dispatch<SetStateAction<AuthSnapshot>>;
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
  syncProgress: (result: RaceProgressResult) => Promise<void>;
}>;

/** Owns multiplayer rollout, category preloading, and profile reconciliation. */
export function useHostRaceCoordination({
  authSnapshot,
  bridgeUser,
  locale,
  services,
  initialRaceChallengeId,
  raceLocalePolicy,
  setAuthSnapshot,
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
  /** Categories available before the multiplayer view opens. */
  const [prefetchedCategories, setPrefetchedCategories] = useState<ListRaceCategoriesResponse["categories"]>([]);

  useEffect(() => {
    /** Prevents stale requests from updating a changed session or locale. */
    let cancelled = false;
    setPrefetchedCategories([]);
    if (!enabled || !authSnapshot.user || (raceLocalePolicy === "english-only" && locale !== "en")) return;

    void services
      .getRaceAccess()
      .then(async (access) => {
        if (!access.enabled || cancelled || initialRaceChallengeId) return;
        try {
          /** Categories returned for the current locale. */
          const response = await services.listRaceCategories(locale);
          if (!cancelled) setPrefetchedCategories(response.categories);
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
  }, [authSnapshot.user, enabled, initialRaceChallengeId, locale, raceLocalePolicy, services]);

  /** Reconciles multiplayer rewards and refreshes the authoritative profile. */
  const syncProgress = useCallback(
    async (result: RaceProgressResult) => {
      if (typeof result.newCoins === "number") {
        setAuthSnapshot((current) =>
          current.profile ? {...current, profile: {...current.profile, coins: result.newCoins!}} : current,
        );
      }
      for (const achievementId of result.newlyUnlockedAchievementIds ?? []) {
        trackEvent("unlock_achievement", {achievement_id: achievementId, source: "multiplayer"});
      }

      /** User whose profile owns the authoritative multiplayer result. */
      const user = authSnapshot.user;
      if (!user) return;
      try {
        /** Fresh profile after the server applies all rewards. */
        const profile = await services.loadProfile(user.uid);
        setAuthSnapshot((current) => ({...current, profile}));
        postToGame({
          type: "host:authState",
          requestId: createRequestId("race-profile"),
          payload: {user: bridgeUser, profile},
        });
      } catch (error) {
        console.warn("[riddle-quest-race-achievements] Profile refresh failed", error);
      }
    },
    [authSnapshot.user, bridgeUser, postToGame, services, setAuthSnapshot],
  );

  return {enabled, prefetchedCategories, syncProgress};
}
