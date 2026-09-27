import {useEffect, type RefObject} from "react";

/** Element references required to fit multiplayer gameplay into its dialog. */
export type RaceGameplayFitOptions = {
  /** Stores active. */
  active: boolean;
  /** Stores screen ref. */
  screenRef: RefObject<HTMLElement | null>;
  /** Stores viewport ref. */
  viewportRef: RefObject<HTMLDivElement | null>;
  /** Stores gameplay ref. */
  gameplayRef: RefObject<HTMLDivElement | null>;
};

/** Responsively scales the multiplayer gameplay surface to the available height. */
export function useRaceGameplayFit({active, screenRef, viewportRef, gameplayRef}: RaceGameplayFitOptions): void {
  useEffect(() => {
    if (!active) return;
    /** Outer multiplayer dialog used to calculate the available height. */
    const screen = screenRef.current;
    /** Viewport whose height follows the scaled gameplay surface. */
    const viewport = viewportRef.current;
    /** Natural gameplay surface being scaled. */
    const gameplay = gameplayRef.current;
    if (!screen || !viewport || !gameplay) return;

    /** Most recently scheduled gameplay-layout animation frame. */
    let frame = 0;
    /** Scales gameplay to fit the available race dialog height. */
    const fitGameplay = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        gameplay.style.transform = "none";
        viewport.style.height = "auto";
        /** Current bounds of the multiplayer dialog. */
        const screenRect = screen.getBoundingClientRect();
        /** Current bounds of the gameplay viewport. */
        const viewportRect = viewport.getBoundingClientRect();
        /** Bottom padding reserved by the multiplayer dialog. */
        const paddingBottom = Number.parseFloat(getComputedStyle(screen).paddingBottom) || 0;
        /** Vertical space available below the gameplay viewport origin. */
        const availableHeight = Math.max(1, screenRect.bottom - paddingBottom - viewportRect.top);
        gameplay.style.minHeight = `${availableHeight}px`;
        /** Unscaled gameplay height. */
        const naturalHeight = gameplay.offsetHeight;
        /** Scale required to keep the complete gameplay surface visible. */
        const scale = naturalHeight > availableHeight ? availableHeight / naturalHeight : 1;
        gameplay.style.transform = `scale(${scale})`;
        gameplay.style.setProperty("--race-gameplay-scale", String(scale));
        viewport.style.height = `${availableHeight}px`;
        viewport.dataset.viewportScale = scale.toFixed(4);
      });
    };

    fitGameplay();
    /** Observes layout changes that require gameplay rescaling. */
    const observer = new ResizeObserver(fitGameplay);
    observer.observe(screen);
    observer.observe(gameplay);
    window.addEventListener("resize", fitGameplay);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", fitGameplay);
      gameplay.style.transform = "";
      gameplay.style.minHeight = "";
      gameplay.style.removeProperty("--race-gameplay-scale");
      viewport.style.height = "";
      delete viewport.dataset.viewportScale;
    };
  }, [active, gameplayRef, screenRef, viewportRef]);
}
