/* eslint-disable no-undef */
declare const global: any;
declare const ErrorUtils: any;

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

  const hasErrorUtils =
    typeof ErrorUtils !== "undefined" ||
    (typeof global !== "undefined" && global?.ErrorUtils);
  const errorUtilsRef =
    typeof ErrorUtils !== "undefined" ? ErrorUtils : global?.ErrorUtils;

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

