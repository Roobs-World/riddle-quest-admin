import {lazy, useEffect, useState} from "react";
import {preloadGameModals} from "../../preloadGameModals";

/** Provides game modal view promise behavior. */
const LazyGameModalView = lazy(preloadGameModals);

/** Provides race to10 game promise behavior. */
let raceTo10GamePromise: Promise<{
  /** Stores default. */
  default: typeof import("../../race/RaceTo10Game").RaceTo10Game;
}> | null = null;
/** Loads race to10 game. */
const loadRaceTo10Game = () =>
  (raceTo10GamePromise ??= import("../../race/RaceTo10Game").then((module) => ({default: module.RaceTo10Game})));
/** Renders the lazy race to10 game interface. */
const LazyRaceTo10Game = lazy(loadRaceTo10Game);

/** Provides lazy overlay surfaces and preloads them after the initial page load. */
export function useGameSurfaces(raceEnabled: boolean) {
  /** Provides [preloaded race to10 game, set preloaded race to10 game] behavior. */
  const [preloadedRaceTo10Game, setPreloadedRaceTo10Game] = useState<
    typeof import("../../race/RaceTo10Game").RaceTo10Game | null
  >(null);

  useEffect(() => {
    /** Requests id. */
    let requestId: number | undefined;
    /** Provides timeout id behavior. */
    let timeoutId: number | undefined;
    /** Provides preload after page load behavior. */
    const preloadAfterPageLoad = () => {
      if (raceEnabled) {
        void loadRaceTo10Game().then(({default: game}) => setPreloadedRaceTo10Game(() => game));
      }
      if (typeof window.requestIdleCallback === "function") {
        requestId = window.requestIdleCallback(() => void preloadGameModals().catch(() => undefined), {timeout: 2_000});
      } else {
        timeoutId = window.setTimeout(() => void preloadGameModals().catch(() => undefined), 250);
      }
    };

    if (document.readyState === "complete") preloadAfterPageLoad();
    else window.addEventListener("load", preloadAfterPageLoad, {once: true});

    return () => {
      window.removeEventListener("load", preloadAfterPageLoad);
      if (requestId !== undefined) window.cancelIdleCallback(requestId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [raceEnabled]);

  return {
    GameModalView: LazyGameModalView,
    RaceTo10Game: preloadedRaceTo10Game ?? LazyRaceTo10Game,
  };
}
