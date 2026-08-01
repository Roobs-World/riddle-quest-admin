export function runWhenLayoutReady(callback: () => void) {
  let cancelled = false;
  let animationFrame = 0;

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
