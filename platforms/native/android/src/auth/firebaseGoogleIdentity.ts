import {GoogleAuthProvider, getIdTokenResult, linkWithCredential, reauthenticateWithCredential, signInWithCredential, type Auth, type User} from "firebase/auth";
import {createAndroidGoogleIdentity, type GoogleAccountChange} from "./androidGoogleIdentity";
import {googleCredentialsAvailable, pickGoogleCredential} from "./googleCredentials";

/** Binds the shared durable-account workflow to the native credential and Firebase adapters. */
export function createFirebaseGoogleIdentity(auth: Auth, webClientId: string | undefined, provision: () => Promise<unknown>, signOut: (ownerId: string, current: () => boolean) => Promise<GoogleAccountChange>) {
  /** Firebase uid must remain the one confirmed when the player opened the account screen. */
  const user = (uid: string): User => {
    if (!auth.currentUser || auth.currentUser.uid !== uid) throw new Error("google-account-changed");
    return auth.currentUser;
  };
  return createAndroidGoogleIdentity({
    available: googleCredentialsAvailable(webClientId),
    current: () => auth.currentUser ? {uid: auth.currentUser.uid, googleLinked: auth.currentUser.providerData.some(provider => provider.providerId === "google.com")} : null,
    pick: () => webClientId ? pickGoogleCredential(webClientId) : Promise.reject(new Error("google-sign-in-unavailable")),
    credential: idToken => GoogleAuthProvider.credential(idToken),
    link: async (uid, credential) => {await linkWithCredential(user(uid), credential);},
    /** Confirm a Google sign-in claim before the backend registers the durable subject. */
    async verifyGoogle(uid, credential) {
      /** Linking normally refreshes the provider claim; legacy compatible responses may need same-user reauthentication. */
      let token = await getIdTokenResult(user(uid), true);
      if (token.signInProvider !== "google.com") {
        await reauthenticateWithCredential(user(uid), credential);
        token = await getIdTokenResult(user(uid), true);
      }
      if (token.signInProvider !== "google.com") throw new Error("google-identity-unconfirmed");
    },
    signIn: async credential => (await signInWithCredential(auth, credential)).user.uid,
    provision,
    signOut,
  });
}
