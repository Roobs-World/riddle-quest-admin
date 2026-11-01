import {onAuthStateChanged, signOut} from "firebase/auth";
import {createFirebaseHostServices as createSharedFirebaseHostServices, type HostAuth} from "@qwordly/hosted/hostServices";
import type {HostServices} from "@qwordly/hosted/hostTypes";
import * as firebase from "../firebase";
import {tr} from "./i18n";
/** Binds the browser's Firebase Auth instance to the shared host-auth surface. */
const createBrowserHostAuth = (): HostAuth => ({
  /** Reads the live SDK account rather than a captured value. */
  get currentUser() {
    return firebase.auth.currentUser;
  },
  onUserChanged: (listener) => onAuthStateChanged(firebase.auth, listener),
  signOut: () => signOut(firebase.auth),
});
/** Creates firebase host services for this Web Target from the shared implementation. */
export const createFirebaseHostServices = (): HostServices =>
  createSharedFirebaseHostServices({
    auth: createBrowserHostAuth(),
    functions: firebase,
    loadUserDocument: firebase.loadUserDocument,
    translate: tr,
  });
