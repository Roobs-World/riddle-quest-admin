import {createFirebaseHostServices, type HostAuth} from "../../../../../src/platform/firebase/hostServices";
import type {HostServices} from "../../../../../src/platform/contracts/hostServices";
import {type YouTubeLocale} from "../../../../../src/gameplay/local/types";
import {translateHostCopy} from "../i18n/hostedCopy";
import type {HostedFirebaseClient} from "./firebaseClient";
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
 * all behave identically; only auth persistence and transport differ. The
 * locale is read lazily because the services are created before the device
 * language has been resolved.
 */
export const createAndroidHostServices = (client: HostedFirebaseClient, resolveLocale: () => YouTubeLocale = () => "en"): HostServices =>
  createFirebaseHostServices({
    auth: createAndroidHostAuth(client),
    functions: client.functions,
    loadUserDocument: (userId) => client.loadUserDocument(userId),
    translate: (key) => translateHostCopy(resolveLocale(), key),
  });
