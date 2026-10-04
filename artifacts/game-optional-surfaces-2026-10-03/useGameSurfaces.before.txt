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

/** Provides lazy overlay surfaces and starts modal loading with the game frame. */
export function useGameSurfaces(raceEnabled: boolean) {
  /** Modal component made ready before an outcome needs to open. */
  const [preloadedGameModalView, setPreloadedGameModalView] = useState<
    typeof import("../../GameModalView").GameModalView | null
  >(null);
  /** Provides [preloaded race to10 game, set preloaded race to10 game] behavior. */
  const [preloadedRaceTo10Game, setPreloadedRaceTo10Game] = useState<
    typeof import("../../race/RaceTo10Game").RaceTo10Game | null
  >(null);

  useEffect(() => {
    // The fifth answer can open Continue immediately only when its modal chunk is ready.
    /** Prevents a completed preload from updating an unmounted game frame. */
    let cancelled = false;
    void preloadGameModals().then(({default: view}) => {
      if (!cancelled) setPreloadedGameModalView(() => view);
    }).catch(() => undefined);
    /** Provides preload after page load behavior. */
    const preloadAfterPageLoad = () => {
      if (raceEnabled) {
        void loadRaceTo10Game().then(({default: game}) => setPreloadedRaceTo10Game(() => game));
      }
    };

    if (document.readyState === "complete") preloadAfterPageLoad();
    else window.addEventListener("load", preloadAfterPageLoad, {once: true});

    return () => {
      cancelled = true;
      window.removeEventListener("load", preloadAfterPageLoad);
    };
  }, [raceEnabled]);

  return {
    GameModalView: preloadedGameModalView ?? LazyGameModalView,
    RaceTo10Game: preloadedRaceTo10Game ?? LazyRaceTo10Game,
  };
}
