import {cloneProductPricingCatalog} from "@qwordly/core/pricing/catalog";
import type {HostServices} from "./types";
import {toProductSummaries} from "./types";
import {hasTrustedTestHarnessMarker, shouldUseFakeHostServices} from "../testHarness";

/** Describes host services mode. */
export type HostServicesMode = "firebase" | "fake";

/** Provides required firebase config behavior. */
const requiredFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

/** Provides missing firebase config behavior. */
const missingFirebaseConfig = Object.entries(requiredFirebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

/** Provides firebase configuration error behavior. */
const firebaseConfigurationError =
  missingFirebaseConfig.length > 0 ? `Missing Firebase configuration: ${missingFirebaseConfig.join(", ")}` : null;

/** Provides firebase services promise behavior. */
let firebaseServicesPromise: Promise<HostServices> | null = null;

/** Gets firebase services. */
const getFirebaseServices = async (): Promise<HostServices> => {
  firebaseServicesPromise ??= import("./firebaseServices").then((module) => module.createFirebaseHostServices());
  return firebaseServicesPromise;
};

/** Creates a synchronous HostServices proxy backed by one lazily imported implementation. */
const createLazyHostServices = (
  loadServices: () => Promise<HostServices>,
  implementationName: "Firebase" | "fake",
): HostServices => ({
  products: toProductSummaries(cloneProductPricingCatalog()),
  auth: {
    subscribe(listener) {
      let unsubscribe: (() => void) | null = null;
      let cancelled = false;

      void loadServices()
        .then((services) => {
          if (cancelled) {
            return;
          }
          unsubscribe = services.auth.subscribe(listener);
        })
        .catch((error) => {
          console.error(`[riddle-quest-web] ${implementationName} services failed to load`, error);
        });

      return () => {
        cancelled = true;
        unsubscribe?.();
      };
    },
  },
  async loadRiddle(input) {
    return (await loadServices()).loadRiddle(input);
  },
  async loadProfile(userId) {
    return (await loadServices()).loadProfile(userId);
  },
  async completeGame(input) {
    return (await loadServices()).completeGame(input);
  },
  async submitGuess(input) {
    return (await loadServices()).submitGuess(input);
  },
  async requestHint(input) {
    return (await loadServices()).requestHint(input);
  },
  async spendCoins(input) {
    return (await loadServices()).spendCoins(input);
  },
  async skipRiddle(input) {
    return (await loadServices()).skipRiddle(input);
  },
  async requestPurchase(productId) {
    return (await loadServices()).requestPurchase(productId);
  },
  async loadLeaderboard(type) {
    return (await loadServices()).loadLeaderboard(type);
  },
  async updateUsername(username) {
    return (await loadServices()).updateUsername(username);
  },
  async updateAvatar(imageDataUrl) {
    return (await loadServices()).updateAvatar(imageDataUrl);
  },
  async deleteAccount() {
    return (await loadServices()).deleteAccount();
  },
  async listRaceCategories(locale) {
    return (await loadServices()).listRaceCategories(locale);
  },
  async startRace(input) {
    return (await loadServices()).startRace(input);
  },
  async submitRaceGuess(input) {
    return (await loadServices()).submitRaceGuess(input);
  },
  async requestRaceHint(input) {
    return (await loadServices()).requestRaceHint(input);
  },
  async skipRaceRiddle(input) {
    return (await loadServices()).skipRaceRiddle(input);
  },
  async resumeRace(runId) {
    return (await loadServices()).resumeRace(runId);
  },
  async abandonRace(input) {
    return (await loadServices()).abandonRace(input);
  },
  async publishRace(input) {
    return (await loadServices()).publishRace(input);
  },
  async getRaceChallenge(challengeId, locale) {
    return (await loadServices()).getRaceChallenge(challengeId, locale);
  },
  async getRaceOutcome(runId) {
    return (await loadServices()).getRaceOutcome(runId);
  },
  async listRaceInbox(input) {
    return (await loadServices()).listRaceInbox(input);
  },
  async blockRival(targetUserId) {
    return (await loadServices()).blockRival(targetUserId);
  },
  async reportRival(input) {
    return (await loadServices()).reportRival(input);
  },
  async getRaceAccess() {
    return (await loadServices()).getRaceAccess();
  },
  async recordRaceAnalytics(input) {
    return (await loadServices()).recordRaceAnalytics(input);
  },
});

/** Creates the production proxy while retaining one Firebase service instance. */
const createLazyFirebaseHostServices = (): HostServices =>
  createLazyHostServices(getFirebaseServices, "Firebase");

/** Creates an isolated trusted-harness proxy without loading fake riddles in the production startup chunk. */
const createLazyFakeHostServices = (): HostServices => {
  let fakeServicesPromise: Promise<HostServices> | null = null;
  const getFakeServices = (): Promise<HostServices> => {
    fakeServicesPromise ??= import("./fakeServices")
      .then((module) => module.createFakeHostServices({initiallyAuthenticated: true}));
    return fakeServicesPromise;
  };
  return createLazyHostServices(getFakeServices, "fake");
};

/** Resolves host services mode. */
export const resolveHostServicesMode = (
  search = window.location.search,
  options: {development?: boolean; testHarnessEnabled?: boolean} = {},
): HostServicesMode => {
  const development = options.development ?? import.meta.env.DEV;
  const harnessAllowed = options.testHarnessEnabled ?? (development || hasTrustedTestHarnessMarker());
  return shouldUseFakeHostServices({search, development, testHarnessEnabled: harnessAllowed}) ? "fake" : "firebase";
};

/** Creates host services. */
export const createHostServices = (mode: HostServicesMode = resolveHostServicesMode()): HostServices => {
  if (mode === "fake") {
    return createLazyFakeHostServices();
  }

  return createLazyFirebaseHostServices();
};

/** Gets host configuration warning. */
export const getHostConfigurationWarning = (mode: HostServicesMode): string | null => {
  if (mode === "fake") {
    return null;
  }

  return firebaseConfigurationError;
};
