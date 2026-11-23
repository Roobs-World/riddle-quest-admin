import assert from "node:assert/strict";
import {createHash, randomUUID} from "node:crypto";
import {mkdir, writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {dirname, resolve} from "node:path";
import {deleteApp, initializeApp} from "firebase/app";
import {connectAuthEmulator, deleteUser, getAuth, getIdTokenResult, GoogleAuthProvider, linkWithCredential, reauthenticateWithCredential, signInAnonymously, signInWithCredential, signOut} from "firebase/auth";
import {createAndroidGoogleIdentity} from "../src/auth/androidGoogleIdentity.ts";

/** This proof refuses to contact Firebase production or a remote authentication service. */
const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!host || !/^(?:127\.0\.0\.1|localhost):\d+$/u.test(host)) throw new Error("Set FIREBASE_AUTH_EMULATOR_HOST to a running local Auth emulator");
/** Every created identity belongs only to this isolated emulator scenario. */
const run = randomUUID();
/** Firebase's emulator accepts unsigned fixture provider tokens; production never does. */
const jwt = Buffer.from(JSON.stringify({alg: "none", typ: "JWT"})).toString("base64url") + "." + Buffer.from(JSON.stringify({
  sub: `google-link-${run}`, email: `google-link-${run}@example.test`, email_verified: true, aud: "demo-client.apps.googleusercontent.com",
  iss: "https://accounts.google.com", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 300,
})).toString("base64url") + ".";
/** Separate SDK sessions model an original device and a fresh installation. */
const apps = [0, 1].map(index => initializeApp({apiKey: "demo-api-key", projectId: "demo-riddle-quest-google-identity"}, `google-identity-${run}-${index}`));
/** Auth adapters are the real Firebase JS SDK bound only to the local emulator. */
const sessions = apps.map(app => {const auth = getAuth(app); connectAuthEmulator(auth, `http://${host}`, {disableWarnings: true}); return auth;});
/** Cleanup retains every scenario-owned anonymous identity even after an explicit switch. */
const created = [];
/** Only bounded proof facts are recorded; no ID or refresh tokens are saved. */
const evidence = {};
try {
  for (const auth of sessions) created.push((await signInAnonymously(auth)).user);
  /** Original uid also binds Google Play purchases through the server's obfuscated account id. */
  const original = sessions[0].currentUser.uid;
  /** A fresh installation initially has its own anonymous uid. */
  const fresh = sessions[1].currentUser.uid;
  /** Purchase binding must remain identical after linking and restoring. */
  const purchaseBinding = uid => createHash("sha256").update(uid).digest("hex");
  /** Native selection is the only unavailable seam; all linking/conflict verification uses real Firebase HTTP APIs. */
  const identity = auth => createAndroidGoogleIdentity({available: true,
    current: () => auth.currentUser ? {uid: auth.currentUser.uid, googleLinked: auth.currentUser.providerData.some(value => value.providerId === "google.com")} : null,
    pick: async () => jwt, credential: value => GoogleAuthProvider.credential(value),
    link: async (uid, credential) => {assert.equal(auth.currentUser.uid, uid); await linkWithCredential(auth.currentUser, credential);},
    verifyGoogle: async (uid, credential) => {
      assert.equal(auth.currentUser.uid, uid);
      if ((await getIdTokenResult(auth.currentUser, true)).signInProvider !== "google.com") await reauthenticateWithCredential(auth.currentUser, credential);
      assert.equal((await getIdTokenResult(auth.currentUser, true)).signInProvider, "google.com");
    },
    signIn: async credential => (await signInWithCredential(auth, credential)).user.uid,
    provision: async () => undefined, signOut: async (uid, current) => {
      if (!current() || auth.currentUser?.uid !== uid) return {kind: "cancelled"};
      await signOut(auth); return auth.currentUser === null ? {kind: "committed", uid: null} : {kind: "cancelled"};
    },
  });
  /** The original account attaches Google without changing server document or purchase identity. */
  const first = identity(sessions[0]);
  assert.equal(await first.link(original, () => true), "linked");
  assert.equal(sessions[0].currentUser.uid, original);
  assert.equal(sessions[0].currentUser.isAnonymous, false);
  assert.equal(purchaseBinding(sessions[0].currentUser.uid), purchaseBinding(original));
  /** Signed Firebase provider claims are the authority used by durable referral registration. */
  const token = await getIdTokenResult(sessions[0].currentUser, true);
  assert.equal(token.claims.firebase.identities["google.com"][0], `google-link-${run}`);
  evidence.linkPreservedUid = true; evidence.purchaseBindingPreserved = true; evidence.verifiedGoogleSubject = true;
  /** A reinstalled app may discover the saved account, but never switches before explicit consent. */
  const second = identity(sessions[1]);
  assert.equal(await second.link(fresh, () => true), "conflict");
  assert.equal(sessions[1].currentUser.uid, fresh);
  evidence.conflictKeptCurrentAccount = true;
  await second.openExisting(fresh, () => true);
  assert.equal(sessions[1].currentUser.uid, original);
  assert.equal(purchaseBinding(sessions[1].currentUser.uid), purchaseBinding(original));
  evidence.explicitRestoreRecoveredOriginalUid = true;
  /** A successful explicit choice consumes the pending credential. */
  await assert.rejects(second.openExisting(original, () => true), /google-conflict-expired/u);
  evidence.conflictChoiceConsumedOnce = true;
} finally {
  for (const user of created.reverse()) await deleteUser(user).catch(() => undefined);
  for (const app of apps) await deleteApp(app);
}
/** Durable evidence is separate from credentials and scenario-owned identities. */
const directory = process.env.GOOGLE_IDENTITY_EVIDENCE_DIR ?? resolve(dirname(fileURLToPath(import.meta.url)), "../../../../artifacts/android-google-identity");
await mkdir(directory, {recursive: true});
await writeFile(resolve(directory, "auth-emulator.json"), JSON.stringify({runtime: "real local Firebase Auth emulator and shared identity controller", checks: evidence}, null, 2) + "\n");
process.stdout.write(JSON.stringify(evidence) + "\n");
