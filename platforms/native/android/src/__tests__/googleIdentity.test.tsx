import {beforeEach, describe, expect, it} from "@jest/globals";
import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {NativeModules} from "react-native";
import {createAndroidGoogleIdentity} from "../auth/androidGoogleIdentity";
import {GoogleAccountLink} from "../components/GoogleAccountLink";
import {AccountScreen} from "../screens/AccountScreen";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {clearGoogleCredentialState, googleCredentialsAvailable, pickGoogleCredential} from "../auth/googleCredentials";
import {googleIdentityCopy} from "../i18n/googleIdentityCopy";
import type {HostedFirebaseClient} from "../hosted/firebaseClient";
import type {HostedAccountController} from "../hosted/useHostedAccount";
import {createGameFunctionsClient} from "../../../../../src/hosted";
import {getApps, initializeApp} from "firebase/app";
import {getFunctions} from "firebase/functions";

/** Inert Firebase callable handles are constructed without sending any requests. */
const app = getApps().find(value => value.name === "identity-rendering") ?? initializeApp({apiKey: "demo-key", projectId: "demo-identity-rendering"}, "identity-rendering");
/** Callable construction performs no network access. */
const functions = getFunctions(app);

/** Minimal target client used by native account rendering tests. */
const client = (): HostedFirebaseClient => ({projectId: "demo", usingEmulators: true, functions: createGameFunctionsClient({account: functions, gameplay: functions, race: functions}),
  currentUser: () => null, onUserChanged: () => () => undefined, signInAnonymously: async () => {throw Error("not used");}, signOut: async () => undefined,
  loadUserDocument: async () => null, provisionAccount: async () => ({uid: "original", created: false, coins: 300}),
  purchases: {grant: async () => {throw Error("not used");}, syncSubscriptions: async () => ({verified: true, activeSkus: [], premiumCoinsAwarded: 0, newCoins: 300})}});

beforeEach(() => {delete NativeModules.RiddleQuestGoogleCredentials;});

describe("optional native Google identity", () => {
  it("validates configuration, cancellation and the native token envelope", async () => {
    expect(googleCredentialsAvailable()).toBe(false);
    NativeModules.RiddleQuestGoogleCredentials = {getIdToken: async () => null, clearSession: async () => undefined};
    expect(googleCredentialsAvailable("public.apps.googleusercontent.com")).toBe(true);
    await expect(pickGoogleCredential("public.apps.googleusercontent.com")).resolves.toBeNull();
    await clearGoogleCredentialState();
    NativeModules.RiddleQuestGoogleCredentials = {getIdToken: async () => "invalid"};
    await expect(pickGoogleCredential("public.apps.googleusercontent.com")).rejects.toThrow("google-credential-invalid");
    NativeModules.RiddleQuestGoogleCredentials = {getIdToken: async () => "a.b.c"};
    await expect(pickGoogleCredential("public.apps.googleusercontent.com")).resolves.toBe("a.b.c");
  });

  it("shows translated unavailable copy when optional OAuth/native support is absent", async () => {
    await render(<GoogleAccountLink locale="es" client={client()} ownerId="original" onChanged={() => undefined} />);
    expect(screen.getByTestId("google-unavailable")).toHaveTextContent(googleIdentityCopy("es").unavailable);
    expect(screen.queryByTestId("google-link")).toBeNull();
  });

  it("updates the Account balance from a new confirmed profile without reprovisioning", async () => {
    /** The startup account balance is intentionally older than subsequent confirmed progress. */
    const account: HostedAccountController = {state: {kind: "ready", account: {uid: "original", coins: 300, created: false}}, connect: () => undefined};
    /** Target client identity stays stable while the profile subscription publishes another balance. */
    const target = client();
    /** Mounted native account view initially receives the provisioning fallback. */
    const view = await render(<SafeAreaProvider><AccountScreen locale="en" client={target} account={account} onBack={() => undefined} /></SafeAreaProvider>);
    expect(screen.getByTestId("account-coins")).toHaveTextContent(/300$/u);
    await view.rerender(<SafeAreaProvider><AccountScreen locale="en" client={target} account={account} onBack={() => undefined} confirmedCoins={725} /></SafeAreaProvider>);
    expect(screen.getByTestId("account-coins")).toHaveTextContent(/725$/u);
  });

  it("requires a visible informed choice before switching a conflicting account", async () => {
    /** Current authenticated uid changes only after explicit consent. */
    let uid = "original", switches = 0, changes = 0;
    /** Shared workflow receives a real conflict from its Firebase boundary. */
    const identity = createAndroidGoogleIdentity({available: true, current: () => ({uid, googleLinked: false}), pick: async () => "token", credential: value => value,
      link: async () => {throw Object.assign(Error("existing"), {code: "auth/credential-already-in-use"});}, verifyGoogle: async () => undefined,
      signIn: async () => {switches++; uid = "existing"; return uid;}, provision: async () => undefined, signOut: async () => ({kind: "cancelled"})});
    await render(<GoogleAccountLink locale="en" client={{...client(), googleIdentity: identity}} ownerId="original" onChanged={() => {changes++;}} />);
    await fireEvent.press(screen.getByTestId("google-link"));
    await waitFor(() => expect(screen.getByTestId("google-conflict")).toHaveTextContent(/will not merge.*may become inaccessible/u));
    expect(switches).toBe(0); expect(uid).toBe("original");
    await fireEvent.press(screen.getByTestId("google-keep-current"));
    expect(switches).toBe(0); expect(uid).toBe("original");
    await fireEvent.press(screen.getByTestId("google-link"));
    await fireEvent.press(screen.getByTestId("google-open-existing"));
    await waitFor(() => expect(changes).toBe(1));
    expect(switches).toBe(1); expect(uid).toBe("existing");
  });
});
