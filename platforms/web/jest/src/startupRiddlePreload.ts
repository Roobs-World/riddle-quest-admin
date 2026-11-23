import type {HostServices} from "../../../../src/platform/contracts/hostServices";

/** Starts the current Classic fallback before Daily's launch decision completes. */
export function createJestStartupRiddlePreload<Services extends Pick<HostServices, "loadRiddle">>(
  services: Services,
  now: () => number = Date.now,
) {
  /** One short-lived, consumable request for the authenticated startup attempt. */
  let preload: {
    /** Locale selected from validated player preferences. */
    locale: string;
    /** Position read from the authoritative profile. */
    classicIndex: number;
    /** Deadline prevents a later mode switch from restoring stale startup state. */
    expiresAt: number;
    /** Issued question from the existing target authority. */
    promise: ReturnType<HostServices["loadRiddle"]>;
  } | null = null;

  return {
    /** Retires requests when a startup attempt ends or is replaced. */
    clear: () => {preload = null;},
    /** Prepares the server-confirmed current position through the existing authority. */
    preloadClassic(locale: string, classicIndex: number) {
      if (!Number.isSafeInteger(classicIndex) || classicIndex < 1) return;
      /** Captures the entry so older failures cannot clear a newer attempt. */
      const entry = {locale, classicIndex, expiresAt: now() + 30_000,
        promise: (async () => services.loadRiddle({gameMode: "classic", locale, classicIndex}))()};
      preload = entry;
      void entry.promise.catch(() => {if (preload === entry) preload = null;});
    },
    /** Preserves every target operation while reusing at most one initial Classic load. */
    services: {
      ...services,
      /** Consumes a matching unexpired Classic preload, otherwise calls the target authority. */
      async loadRiddle(input: Parameters<HostServices["loadRiddle"]>[0]) {
        if (input.gameMode !== "classic") return services.loadRiddle(input);
        /** Consuming any Classic request retires the speculative startup snapshot. */
        const entry = preload;
        preload = null;
        if (entry && entry.locale === input.locale &&
          (input.classicIndex === undefined || input.classicIndex === entry.classicIndex) &&
          !input.authoritative && !input.sessionToken && !input.riddleId && entry.expiresAt > now()) {
          try {
            return await entry.promise;
          } catch {
            // Speculation is optional: a real load keeps the ordinary retry path.
          }
        }
        return services.loadRiddle(input);
      },
    },
  };
}
