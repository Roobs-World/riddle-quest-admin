/* eslint-disable no-undef */
type ErrorUtilsLike = {
  getGlobalHandler?: () => ((error: Error, isFatal?: boolean) => void) | undefined;
  setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
};

let installed = false;

export function installGlobalErrorLogging(): void {
  if (installed || !__DEV__) return;
  installed = true;

  const originalConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    originalConsoleError(...args);
    const first = args[0];
    if (first instanceof Error && first.stack) {
      originalConsoleError("[debug:error-stack]", first.stack);
    }
  };

  const globalWithErrorUtils = globalThis as typeof globalThis & {
    ErrorUtils?: ErrorUtilsLike;
  };
  const errorUtilsRef = globalWithErrorUtils.ErrorUtils;
  const hasErrorUtils = typeof errorUtilsRef !== "undefined";

  if (hasErrorUtils && errorUtilsRef?.setGlobalHandler) {
    const previousHandler =
      typeof errorUtilsRef.getGlobalHandler === "function"
        ? errorUtilsRef.getGlobalHandler()
        : undefined;

    errorUtilsRef.setGlobalHandler((error: Error, isFatal?: boolean) => {
      originalConsoleError("[debug:global-error]", {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        isFatal: !!isFatal,
      });

      if (typeof previousHandler === "function") {
        previousHandler(error, isFatal);
      }
    });
  }
}
