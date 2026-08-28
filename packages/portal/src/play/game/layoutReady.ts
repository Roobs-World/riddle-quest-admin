/** Provides run when layout ready behavior. */
export function runWhenLayoutReady(callback: () => void) {
  /** Provides cancelled behavior. */
  let cancelled = false;
  /** Provides animation frame behavior. */
  let animationFrame = 0;

  /** Provides run behavior. */
  const run = () => {
    animationFrame = window.requestAnimationFrame(() => {
      if (!cancelled) callback();
    });
  };

  if (document.readyState === "complete") run();
  else window.addEventListener("load", run, {once: true});

  return () => {
    cancelled = true;
    window.cancelAnimationFrame(animationFrame);
    window.removeEventListener("load", run);
  };
}
