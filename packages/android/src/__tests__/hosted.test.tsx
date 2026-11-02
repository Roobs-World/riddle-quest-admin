import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {SafeAreaProvider} from "react-native-safe-area-context";

/** Recorded Firebase SDK calls. */
const mockCalls: string[] = [];
/** Fake Firebase user. */
const mockUser = {uid: "device-uid", isAnonymous: true};
/** Shape of the fake auth object. */
type FakeAuth = {
  /** Signed-in fake user, or `null`. */
  currentUser: typeof mockUser | null;
};
/** Fake auth object whose current user tests control. */
const mockAuth: FakeAuth = {currentUser: null};
/** Result envelope the fake callable resolves. */
type FakeCallableResult = {
  /** Callable response payload. */
  data: unknown;
};
/** Callable implementation tests control. */
const mockCallable = jest.fn<() => Promise<FakeCallableResult>>();
/** Options the fake `initializeApp` receives. */
type FakeAppOptions = {
  /** Firebase project id. */
  projectId: string;
};
/** Options the fake `initializeAuth` receives. */
type FakeAuthOptions = {
  /** Persistence token produced by the fake React Native persistence. */
  persistence: string;
};

jest.mock("firebase/app", () => ({
  initializeApp: (options: FakeAppOptions) => {
    mockCalls.push(`initializeApp:${options.projectId}`);
    return {name: "[DEFAULT]"};
  },
}));
jest.mock("firebase/auth", () => ({
  getReactNativePersistence: () => "rn-persistence",
  initializeAuth: (_app: unknown, options: FakeAuthOptions) => {
    mockCalls.push(`initializeAuth:${options.persistence}`);
    return mockAuth;
  },
  connectAuthEmulator: (_auth: unknown, url: string) => {
    mockCalls.push(`connectAuthEmulator:${url}`);
  },
  onAuthStateChanged: (_auth: unknown, listener: (user: unknown) => void) => {
    listener(mockAuth.currentUser);
    return () => {};
  },
  signInAnonymously: async () => {
    mockCalls.push("signInAnonymously");
    mockAuth.currentUser = mockUser;
    return {user: mockUser};
  },
}));
jest.mock("firebase/firestore/lite", () => ({
  getFirestore: () => {
    mockCalls.push("getFirestore");
    return "firestore";
  },
  connectFirestoreEmulator: (_db: unknown, host: string, port: number) => {
    mockCalls.push(`connectFirestoreEmulator:${host}:${port}`);
  },
  doc: (_db: unknown, collection: string, id: string) => `${collection}/${id}`,
  getDoc: async (path: string) => ({
    exists: () => path === "users/device-uid",
    data: () => ({coins: 300, username: "Android test"}),
  }),
}));
jest.mock("firebase/functions", () => ({
  // The fake Functions handle is its region string, which keeps the mock free of object literals.
  getFunctions: (_app: unknown, region: string) => {
    mockCalls.push(`getFunctions:${region}`);
    return region;
  },
  connectFunctionsEmulator: (region: string, host: string, port: number) => {
    mockCalls.push(`connectFunctionsEmulator:${region}:${host}:${port}`);
  },
  httpsCallable: (region: string, name: string) => {
    mockCalls.push(`httpsCallable:${region}:${name}`);
    return mockCallable;
  },
}));

import type {YouTubeLocale} from "@qwordly/solo";
import {createHostedFirebaseClient, type HostedFirebaseClient} from "../hosted/firebaseClient";
import {parseHostedConfig, type HostedConfig} from "../hosted/hostedConfig";
import {useHostedAccount} from "../hosted/useHostedAccount";
import {AccountScreen} from "../screens/AccountScreen";

/** Valid production-shaped configuration. */
const productionConfig: HostedConfig = parseHostedConfig({
  firebase: {
    apiKey: "key",
    appId: "1:1:web:a",
    authDomain: "example.firebaseapp.com",
    messagingSenderId: "1",
    projectId: "riddle-quest-test",
    functionsRegion: "us-central1",
    gameplayRegion: "europe-west1",
  },
  emulators: null,
});
/** Emulator-targeting configuration. */
const emulatorConfig: HostedConfig = {
  ...productionConfig,
  emulators: {host: "10.0.2.2", authPort: 9099, functionsPort: 5001, firestorePort: 8099},
};

describe("parseHostedConfig", () => {
  it("accepts the bundled example configuration", () => {
    expect(() => parseHostedConfig(require("../../hosted.config.example.json"))).not.toThrow();
  });

  it("rejects missing Firebase fields and malformed emulator blocks", () => {
    expect(() => parseHostedConfig(null)).toThrow("hosted-config-invalid");
    expect(() => parseHostedConfig({firebase: {apiKey: "k"}})).toThrow("hosted-config-firebase-invalid");
    expect(() => parseHostedConfig({firebase: productionConfig.firebase, emulators: {host: "", authPort: 1, functionsPort: 2, firestorePort: 3}})).toThrow(
      "hosted-config-emulators-invalid",
    );
    expect(() => parseHostedConfig({firebase: productionConfig.firebase, emulators: {host: "h", authPort: 70_000, functionsPort: 2, firestorePort: 3}})).toThrow(
      "hosted-config-emulators-invalid",
    );
  });
});

describe("createHostedFirebaseClient", () => {
  beforeEach(() => {
    mockCalls.length = 0;
    mockAuth.currentUser = null;
    mockCallable.mockReset();
  });

  it("initializes auth with device persistence and both callable regions", () => {
    /** Client under test. */
    const client = createHostedFirebaseClient(productionConfig);
    expect(client.projectId).toBe("riddle-quest-test");
    expect(client.usingEmulators).toBe(false);
    expect(mockCalls.slice(0, 4)).toEqual([
      "initializeApp:riddle-quest-test",
      "initializeAuth:rn-persistence",
      "getFunctions:us-central1",
      "getFunctions:europe-west1",
    ]);
    expect(mockCalls).toContain("httpsCallable:europe-west1:provisionAndroidAccount");
    expect(mockCalls).toContain("httpsCallable:europe-west1:getClassicRiddleBuffer");
    expect(mockCalls).toContain("httpsCallable:us-central1:updateUsername");
    expect(client.functions.completeGame).toBe(mockCallable);
  });

  it("targets the emulators only when configured", () => {
    createHostedFirebaseClient(emulatorConfig);
    expect(mockCalls).toEqual(expect.arrayContaining([
      "connectAuthEmulator:http://10.0.2.2:9099",
      "connectFunctionsEmulator:us-central1:10.0.2.2:5001",
      "connectFunctionsEmulator:europe-west1:10.0.2.2:5001",
      "connectFirestoreEmulator:10.0.2.2:8099",
    ]));
  });

  it("reuses a persisted session instead of signing in again", async () => {
    /** Client under test. */
    const client = createHostedFirebaseClient(productionConfig);
    await expect(client.signInAnonymously()).resolves.toBe(mockUser);
    await expect(client.signInAnonymously()).resolves.toBe(mockUser);
    expect(mockCalls.filter((call) => call === "signInAnonymously")).toHaveLength(1);
    expect(client.currentUser()).toBe(mockUser);
  });

  it("reads the account document through the lightweight Firestore client", async () => {
    /** Client under test. */
    const client = createHostedFirebaseClient(productionConfig);
    await expect(client.loadUserDocument("device-uid")).resolves.toEqual({coins: 300, username: "Android test"});
    await expect(client.loadUserDocument("missing")).resolves.toBeNull();
  });

  it("validates the provisioning response shape", async () => {
    /** Client under test. */
    const client = createHostedFirebaseClient(productionConfig);
    mockCallable.mockResolvedValueOnce({data: {uid: "device-uid", created: true, coins: 300}});
    await expect(client.provisionAccount()).resolves.toEqual({uid: "device-uid", created: true, coins: 300});
    mockCallable.mockResolvedValueOnce({data: {uid: 1}});
    await expect(client.provisionAccount()).rejects.toThrow("provision-response-invalid");
  });
});

describe("AccountScreen", () => {
  beforeEach(() => {
    mockCalls.length = 0;
    mockAuth.currentUser = null;
    mockCallable.mockReset();
  });
  /** Props for the harness that owns the account controller the way the root does. */
  type HarnessProps = {
    /** Client under test. */
    client: HostedFirebaseClient;
    /** Back handler. */
    onBack: () => void;
    /** Locale under test. */
    locale: YouTubeLocale;
  };
  /** Owns the account controller so the screen receives it as the root would. */
  const Harness = ({client, onBack, locale}: HarnessProps) => {
    /** On-demand account controller. */
    const account = useHostedAccount(client);
    return <AccountScreen locale={locale} client={client} account={account} onBack={onBack} />;
  };
  /** Renders the screen with a client built from the given configuration. */
  const renderScreen = async (config = productionConfig, locale: YouTubeLocale = "en") => {
    /** Client under test. */
    const client = createHostedFirebaseClient(config);
    /** Back handler spy. */
    const onBack = jest.fn();
    await render(
      <SafeAreaProvider>
        <Harness client={client} onBack={onBack} locale={locale} />
      </SafeAreaProvider>,
    );
    return {client, onBack};
  };

  it("connects on demand and shows the confirmed server balance", async () => {
    mockCallable.mockResolvedValueOnce({data: {uid: "device-uid", created: true, coins: 300}});
    await renderScreen();
    expect(screen.getByTestId("account-heading")).toHaveTextContent("Account");
    await fireEvent.press(screen.getByTestId("account-connect"));
    await waitFor(() => expect(screen.getByTestId("account-ready")).toBeTruthy());
    expect(screen.getByTestId("account-status")).toHaveTextContent(/Account created/u);
    expect(screen.getByTestId("account-coins")).toHaveTextContent(/300$/u);
    expect(mockCalls).toContain("signInAnonymously");
  });

  it("reports a provisioning failure and allows a retry", async () => {
    mockCallable.mockRejectedValueOnce(new Error("unavailable"));
    mockCallable.mockResolvedValueOnce({data: {uid: "device-uid", created: false, coins: 540}});
    await renderScreen(emulatorConfig);
    await fireEvent.press(screen.getByTestId("account-connect"));
    await waitFor(() => expect(screen.getByTestId("account-status")).toHaveTextContent(/could not be confirmed/u));
    await fireEvent.press(screen.getByTestId("account-connect"));
    await waitFor(() => expect(screen.getByTestId("account-ready")).toBeTruthy());
    expect(screen.getByTestId("account-status")).toHaveTextContent(/Account confirmed/u);
    expect(screen.getByTestId("account-coins")).toHaveTextContent(/540$/u);
  });

  it("returns to the previous screen", async () => {
    /** Rendered screen handles. */
    const {onBack} = await renderScreen();
    await fireEvent.press(screen.getByTestId("back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("renders the device locale's copy", async () => {
    mockCallable.mockResolvedValueOnce({data: {uid: "device-uid", created: true, coins: 300}});
    await renderScreen(productionConfig, "es");
    expect(screen.getByTestId("account-heading")).toHaveTextContent("Cuenta");
    await fireEvent.press(screen.getByTestId("account-connect"));
    await waitFor(() => expect(screen.getByTestId("account-status")).toHaveTextContent("Cuenta creada."));
    expect(screen.getByTestId("account-coins")).toHaveTextContent(/Monedas en el servidor/u);
  });
});
