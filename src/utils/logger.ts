/**
 * Centralized logger that gates debug/info/warn output in production.
 * Prevents excessive logging that can cause JSI crashes (e.g. SoundManager).
 * Error logs always emit for Crashlytics and debugging, and are automatically
 * forwarded to Sentry when an Error object is present in the arguments.
 */
import { captureException } from "./sentry";

const isDev =
  typeof __DEV__ !== "undefined"
    ? __DEV__
    : process.env.NODE_ENV !== "production";

export const logger = {
  debug: (...args: unknown[]): void => {
    if (isDev) {
      console.log(...args);
    }
  },
  info: (...args: unknown[]): void => {
    if (isDev) {
      console.log(...args);
    }
  },
  warn: (...args: unknown[]): void => {
    if (isDev) {
      console.warn(...args);
    }
  },
  error: (...args: unknown[]): void => {
    console.error(...args);
    // Automatically forward Error instances to Sentry so every logger.error
    // call is captured without requiring manual captureException at each site.
    const err = args.find((a) => a instanceof Error);
    if (err) {
      captureException(err);
    }
  },
};

