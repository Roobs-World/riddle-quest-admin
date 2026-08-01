import {cloneProductPricingCatalog} from "@qwordly/core/pricing/catalog";
import {createFakeHostServices} from "./fakeServices";
import type {HostServices} from "./types";
import {toProductSummaries} from "./types";

export type HostServicesMode = "firebase" | "fake";

const requiredFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

const missingFirebaseConfig = Object.entries(requiredFirebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

const firebaseConfigurationError =
  missingFirebaseConfig.length > 0 ? `Missing Firebase configuration: ${missingFirebaseConfig.join(", ")}` : null;

let firebaseServicesPromise: Promise<HostServices> | null = null;

const getFirebaseServices = async (): Promise<HostServices> => {
  firebaseServicesPromise ??= import("./firebaseServices").then((module) => module.createFirebaseHostServices());
  return firebaseServicesPromise;
};

const createLazyFirebaseHostServices = (): HostServices => ({
  products: toProductSummaries(cloneProductPricingCatalog()),
  auth: {
    subscribe(listener) {
      let unsubscribe: (() => void) | null = null;
      let cancelled = false;

      void getFirebaseServices()
        .then((services) => {
          if (cancelled) {
            return;
          }
          unsubscribe = services.auth.subscribe(listener);
        })
        .catch((error) => {
          console.error("[riddle-quest-web] Firebase services failed to load", error);
        });

      return () => {
        cancelled = true;
        unsubscribe?.();
      };
    },
  },
  async loadRiddle(input) {
    return (await getFirebaseServices()).loadRiddle(input);
  },
  async loadProfile(userId) {
    return (await getFirebaseServices()).loadProfile(userId);
  },
  async completeGame(input) {
    return (await getFirebaseServices()).completeGame(input);
  },
  async requestHint(input) {
    return (await getFirebaseServices()).requestHint(input);
  },
  async spendCoins(input) {
    return (await getFirebaseServices()).spendCoins(input);
  },
  async skipRiddle(input) {
    return (await getFirebaseServices()).skipRiddle(input);
  },
  async requestPurchase(productId) {
    return (await getFirebaseServices()).requestPurchase(productId);
  },
  async loadLeaderboard(type) {
    return (await getFirebaseServices()).loadLeaderboard(type);
  },
  async updateUsername(username) {
    return (await getFirebaseServices()).updateUsername(username);
  },
  async updateAvatar(imageDataUrl) {
    return (await getFirebaseServices()).updateAvatar(imageDataUrl);
  },
  async listRaceCategories(locale) {
    return (await getFirebaseServices()).listRaceCategories(locale);
  },
  async startRace(input) {
    return (await getFirebaseServices()).startRace(input);
  },
  async submitRaceGuess(input) {
    return (await getFirebaseServices()).submitRaceGuess(input);
  },
  async requestRaceHint(input) {
    return (await getFirebaseServices()).requestRaceHint(input);
  },
  async skipRaceRiddle(input) {
    return (await getFirebaseServices()).skipRaceRiddle(input);
  },
  async resumeRace(runId) {
    return (await getFirebaseServices()).resumeRace(runId);
  },
  async abandonRace(input) {
    return (await getFirebaseServices()).abandonRace(input);
  },
  async publishRace(input) {
    return (await getFirebaseServices()).publishRace(input);
  },
  async getRaceChallenge(challengeId) {
    return (await getFirebaseServices()).getRaceChallenge(challengeId);
  },
  async getRaceOutcome(runId) {
    return (await getFirebaseServices()).getRaceOutcome(runId);
  },
  async listRaceInbox(input) {
    return (await getFirebaseServices()).listRaceInbox(input);
  },
  async getRaceAccess() {
    return (await getFirebaseServices()).getRaceAccess();
  },
  async recordRaceAnalytics(input) {
    return (await getFirebaseServices()).recordRaceAnalytics(input);
  },
});

export const resolveHostServicesMode = (search = window.location.search): HostServicesMode => {
  const params = new URLSearchParams(search);
  const harness = params.get("harness");
  return import.meta.env.DEV ||
    harness === "jest" ||
    harness === "jest-auth" ||
    harness === "race-auth" ||
    harness === "dev" ||
    harness === "race"
    ? "fake"
    : "firebase";
};

export const createHostServices = (mode: HostServicesMode = resolveHostServicesMode()): HostServices => {
  if (mode === "fake") {
    return createFakeHostServices({initiallyAuthenticated: true});
  }

  return createLazyFirebaseHostServices();
};

export const getHostConfigurationWarning = (mode: HostServicesMode): string | null => {
  if (mode === "fake") {
    return null;
  }

  return firebaseConfigurationError;
};
