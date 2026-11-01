import {createFirebaseHostServices, type HostAuth} from "@qwordly/hosted/hostServices";
import type {HostServices} from "@qwordly/hosted/hostTypes";
import type {HostedFirebaseClient} from "./firebaseClient";
/** English copy for the few host-level notices the shared services raise; localized tables arrive with 1.5. */
const HOST_COPY: Readonly<Record<string, string>> = Object.freeze({
  "ErrorMessages.UNABLE_TO_LOAD_RIDDLES": "The riddles could not be loaded.",
  "ErrorMessages.SERVICE_TEMPORARILY_UNAVAILABLE": "The service is temporarily unavailable.",
});
/** Resolves host copy, falling back to the key so a missing entry is visible rather than silent. */
export const translateHostCopy = (key: string): string => HOST_COPY[key] ?? key;
/** Binds the device's Firebase Auth session to the shared host-auth surface. */
export const createAndroidHostAuth = (client: HostedFirebaseClient): HostAuth => ({
  /** Reads the live SDK account rather than a captured value. */
  get currentUser() {
    return client.currentUser();
  },
  onUserChanged: (listener) => client.onUserChanged(listener),
  signOut: () => client.signOut(),
});
/**
 * Creates the shared hosted play services for Android.
 *
 * @remarks
 * This is the same implementation the Jest Web Target runs: issued Classic
 * buffers, Daily preloads, authority-delivery deadlines and profile refreshes
 * all behave identically; only auth persistence and transport differ.
 */
export const createAndroidHostServices = (client: HostedFirebaseClient): HostServices =>
  createFirebaseHostServices({
    auth: createAndroidHostAuth(client),
    functions: client.functions,
    loadUserDocument: (userId) => client.loadUserDocument(userId),
    translate: translateHostCopy,
  });
