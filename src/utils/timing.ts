/**
 * Thread-safe delay helper - avoid setTimeout to prevent Reanimated worklet conflicts
 * Uses requestAnimationFrame for smooth, non-blocking delays that work with React Native Reanimated
 */
export const safeDelay = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    const startTime = performance.now();
    const checkElapsed = () => {
      const elapsed = performance.now() - startTime;
      if (elapsed >= ms) {
        resolve();
      } else {
        requestAnimationFrame(checkElapsed);
      }
    };
    requestAnimationFrame(checkElapsed);
  });
};

/**
 * Thread-safe timeout helper for React Native Reanimated worklets
 * Returns a cleanup function to cancel the timeout
 */
export const safeTimeout = (callback: () => void, ms: number): (() => void) => {
  let cancelled = false;
  const startTime = performance.now();

  const checkElapsed = () => {
    if (cancelled) return;

    const elapsed = performance.now() - startTime;
    if (elapsed >= ms) {
      callback();
    } else {
      requestAnimationFrame(checkElapsed);
    }
  };

  requestAnimationFrame(checkElapsed);

  // Return cleanup function
  return () => {
    cancelled = true;
  };
};
