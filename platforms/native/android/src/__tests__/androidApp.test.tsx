import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import type {BridgeProfile} from "../../../../../src/core/bridge";
import type {AuthSnapshot, HostServices} from "../../../../../src/hosted/hostTypes";
import type {YouTubeLocale, YouTubeSdkPort} from "../../../../../src/solo";
import {act, fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {Linking} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {ANDROID_ENTRY_INBOX_KEY} from "../entries/androidEntryInbox";
import {readPlayInstallReferrer} from "../hosted/playInstallReferrer";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {AndroidApp} from "../AndroidApp";
import type {HostedRaceScreenProps} from "../screens/HostedRaceScreen";
import type {HostedFirebaseClient, ProvisionedAccount} from "../hosted/firebaseClient";
import {calls, createFakeHostServices, subscribers} from "../test/fakeHostServices";
import {contentSource, createPort, expectScreen, press} from "../test/harness";


jest.mock("../hosted/playInstallReferrer", () => ({readPlayInstallReferrer: jest.fn(async () => null)}));

/** Isolates navigation ownership; the race controller's retirement is verified by its dedicated native tests. */
jest.mock("../screens/HostedRaceScreen", () => {
  /** Native primitives used by the isolated race-navigation boundary. */
  const {View, Text, Pressable} = require("react-native");
  return {HostedRaceScreen: ({challengeId, onBack, onActivityChange}: Pick<HostedRaceScreenProps, "challengeId" | "onBack" | "onActivityChange">) => <View testID="route-race">
    <Text testID="route-race-challenge">{challengeId ?? "public"}</Text>
    <Pressable testID="route-race-active" onPress={() => onActivityChange?.(true)}><Text>Join started</Text></Pressable>
    <Pressable testID="route-race-retired" onPress={onBack}><Text>Retirement confirmed</Text></Pressable>
  </View>};
});

/** Native payload inferred from the installed link-listener contract. */
type NativeLinkEvent = Parameters<Parameters<typeof Linking.addEventListener>[1]>[0];

/** Scripted outcomes of the fake client's connection attempts. */
type ClientScript = {
  /** Results of successive provisioning calls; an Error rejects that call. */
  provisioning: (ProvisionedAccount | Error)[];
  /** Whether the first anonymous sign-in fails before provisioning is reached. */
  signInFailsOnce?: boolean;
};
/** Fake client plus its recorded calls. */
type FakeClient = HostedFirebaseClient & {
  /** Recorded sign-in and provisioning calls. */
  recorded: string[];
};
/** Builds a fake hosted client whose connection attempts follow a script. */
const createClient = (script: ClientScript): FakeClient => {
  /** Recorded calls. */
  const recorded: string[] = [];
  /** Whether the scripted sign-in failure has been consumed. */
  let signInFailed = false;
  return {
    recorded,
    projectId: "riddle-quest-test",
    usingEmulators: true,
    functions: {} as never,
    currentUser: () => null,
    onUserChanged: () => () => {},
    signInAnonymously: async () => {
      recorded.push("signIn");
      if (script.signInFailsOnce && !signInFailed) {
        signInFailed = true;
        throw new Error("auth/network-request-failed");
      }
      return {uid: "device-uid"} as never;
    },
    signOut: async () => {},
    loadUserDocument: async () => null,
    provisionAccount: async () => {
      recorded.push("provision");
      /** Next scripted outcome. */
      const next = script.provisioning.shift();
      if (!next) throw new Error("unscripted provisioning call");
      if (next instanceof Error) throw next;
      return next;
    },
    purchases: {} as never,
  };
};
/** A freshly created account. */
const created: ProvisionedAccount = {uid: "device-uid", created: true, coins: 300};
/** Renders the root with a scripted client, the fake services, and a port. */
const renderRoot = async (client: HostedFirebaseClient, port: YouTubeSdkPort = createPort(), onLocaleResolved?: (locale: YouTubeLocale) => void) => {
  /** Fake services shared with the hosted screen suite. */
  const services = createFakeHostServices();
  await render(
    <SafeAreaProvider>
      <AndroidApp sdk={port} contentSource={contentSource} client={client} services={services} onLocaleResolved={onLocaleResolved} />
    </SafeAreaProvider>,
  );
  return services;
};

describe("AndroidApp", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.mocked(readPlayInstallReferrer).mockResolvedValue(null);
    jest.spyOn(Linking, "getInitialURL").mockResolvedValue(null);
    jest.spyOn(Linking, "addEventListener").mockImplementation(() => ({remove: () => undefined}));
    calls.length = 0;
    subscribers.clear();
  });

  it("connects on launch and routes between the hosted home, server play, and the account", async () => {
    /** Client that provisions on the first attempt. */
    const client = createClient({provisioning: [created]});
    await renderRoot(client);
    await expectScreen("screen-hosted-home");
    expect(client.recorded).toEqual(["signIn", "provision"]);
    expect(screen.getByTestId("hosted-coins")).toHaveTextContent(/300$/u);
    await press("hosted-play-classic");
    await expectScreen("screen-hosted-game");
    expect(calls.filter(call => call.startsWith("loadRiddle:"))).toEqual(["loadRiddle:classic:authoritative"]);
    await press("hosted-back");
    await expectScreen("screen-hosted-home");
    await press("hosted-play-daily");
    await expectScreen("screen-hosted-game");
    expect(calls).toContain("loadRiddle:challenge:buffered");
    await press("hosted-back");
    await press("show-account");
    await expectScreen("screen-account");
    expect(screen.getByTestId("account-status")).toHaveTextContent("Account created.");
    await press("back");
    await expectScreen("screen-hosted-home");
    // The account was confirmed once for the whole session, not per screen.
    expect(client.recorded).toEqual(["signIn", "provision"]);
  });

  it("offers offline play when the connection fails and keeps the failed state until a retry succeeds", async () => {
    /** Client whose first sign-in fails and whose first provisioning then succeeds. */
    const client = createClient({provisioning: [created], signInFailsOnce: true});
    await renderRoot(client);
    await expectScreen("screen-hosted-connect");
    await waitFor(() => expect(screen.getByTestId("account-status")).toHaveTextContent(/Sign-in failed/u));
    await press("play-offline");
    await expectScreen("screen-menu");
    expect(screen.getByTestId("play-online")).toHaveTextContent("Play online");
    await press("play-online");
    await expectScreen("screen-hosted-connect");
    await press("account-connect");
    await expectScreen("screen-hosted-home");
    expect(client.recorded).toEqual(["signIn", "signIn", "provision"]);
  });

  it("reports a provisioning failure distinctly", async () => {
    /** Client whose provisioning call is rejected. */
    const client = createClient({provisioning: [new Error("unavailable")]});
    await renderRoot(client);
    await waitFor(() => expect(screen.getByTestId("account-status")).toHaveTextContent(/could not be confirmed/u));
    expect(screen.getByTestId("account-connect")).toHaveTextContent("Retry");
  });

  it("renders the device locale across the hosted screens and reports it to the host", async () => {
    /** Locale reported to the root's owner. */
    const resolved = jest.fn<(locale: YouTubeLocale) => void>();
    await renderRoot(createClient({provisioning: [created]}), createPort("", "es-ES"), resolved);
    await expectScreen("screen-hosted-home");
    expect(resolved).toHaveBeenCalledWith("es");
    expect(screen.getByTestId("hosted-home-heading")).toHaveTextContent("Elige un acertijo");
    expect(screen.getByTestId("play-offline")).toHaveTextContent("Jugar sin conexión");
    await press("hosted-play-classic");
    await expectScreen("screen-hosted-game");
    expect(screen.getByTestId("hosted-submit")).toHaveTextContent("Enviar");
  });

  it("falls back to English when the device language cannot be read", async () => {
    /** Port whose language lookup rejects. */
    const port: YouTubeSdkPort = {
      ...createPort(),
      getLanguage: async () => {
        throw new Error("no-locale");
      },
    };
    await renderRoot(createClient({provisioning: [created]}), port);
    await expectScreen("screen-hosted-home");
    expect(screen.getByTestId("hosted-home-heading")).toHaveTextContent("Choose a puzzle");
  });
  it("defers a second race invitation until the active race confirms retirement", async () => {
    /** Installed native URL callbacks receive the same event as the root adapter. */
    const listeners = new Set<(event: NativeLinkEvent) => void>();
    /** Restorable listener registration captures foreground navigation events. */
    const listenerSpy = jest.spyOn(Linking, "addEventListener").mockImplementation((_kind, callback) => {
      listeners.add(callback); return {remove: () => {listeners.delete(callback);}};
    });
    await renderRoot(createClient({provisioning: [created]})); await expectScreen("screen-hosted-home");
    await press("show-race"); await expectScreen("route-race");
    /** New invitation remains queued until the active race retires. */
    const challengeId = `live_${"a".repeat(64)}`;
    await act(() => {for (const listener of listeners) listener({url: `riddlequest://race?challengeId=${challengeId}`});});
    expect(screen.getByTestId("route-race-challenge")).toHaveTextContent("public");
    await press("route-race-retired");
    await waitFor(() => expect(screen.getByTestId("route-race-challenge")).toHaveTextContent(challengeId));
    listenerSpy.mockRestore();
  });

  it("queues a Daily link during a race and opens it only after retirement", async () => {
    /** Installed native URL callbacks receive the same event as the root adapter. */
    const listeners = new Set<(event: NativeLinkEvent) => void>();
    /** Restorable listener registration captures foreground navigation events. */
    const listenerSpy = jest.spyOn(Linking, "addEventListener").mockImplementation((_kind, callback) => {
      listeners.add(callback); return {remove: () => {listeners.delete(callback);}};
    });
    await renderRoot(createClient({provisioning: [created]})); await expectScreen("screen-hosted-home");
    await press("show-race");
    await act(() => {for (const listener of listeners) listener({url: "riddlequest://daily"});});
    expect(screen.getByTestId("route-race")).toBeTruthy();
    expect(calls).not.toContain("loadRiddle:challenge:buffered");
    await press("route-race-retired"); await expectScreen("screen-hosted-game");
    expect(calls).toContain("loadRiddle:challenge:buffered"); listenerSpy.mockRestore();
  });

  it("ignores a duplicate current invitation without losing a different queued invitation", async () => {
    /** Installed native URL callbacks receive the same event as the root adapter. */
    const listeners = new Set<(event: NativeLinkEvent) => void>();
    /** Restorable listener registration captures foreground navigation events. */
    const listenerSpy = jest.spyOn(Linking, "addEventListener").mockImplementation((_kind, callback) => {
      listeners.add(callback); return {remove: () => {listeners.delete(callback);}};
    });
    /** Current and queued invitation handles remain distinct. */
    const first = `live_${"b".repeat(64)}`, second = `live_${"c".repeat(64)}`;
    await renderRoot(createClient({provisioning: [created]})); await expectScreen("screen-hosted-home");
    /** Delivers one native invitation to every installed root listener. */
    const receive = async (challengeId: string) => act(() => {
      for (const listener of listeners) listener({url: `riddlequest://race?challengeId=${challengeId}`});
    });
    await receive(first); await waitFor(() => expect(screen.getByTestId("route-race-challenge")).toHaveTextContent(first));
    await press("route-race-active");
    await receive(second); await receive(first);
    expect(screen.getByTestId("route-race-challenge")).toHaveTextContent(first);
    await press("route-race-retired");
    await waitFor(() => expect(screen.getByTestId("route-race-challenge")).toHaveTextContent(second));
    listenerSpy.mockRestore();
  });

  it("restores an unaccepted Play invitation on ordinary cold launch and does not replay it after dismissal", async () => {
    /** Opaque server-issued private lobby handle, independently checked before joining. */
    const challengeId = `live_${"d".repeat(64)}`;
    jest.mocked(readPlayInstallReferrer).mockResolvedValue(`rq_entry=${encodeURIComponent(`riddlequest://race?challengeId=${challengeId}`)}`);
    await renderRoot(createClient({provisioning: [created]}));
    await waitFor(() => expect(screen.getByTestId("route-race-challenge")).toHaveTextContent(challengeId));
    await screen.unmount();
    await renderRoot(createClient({provisioning: [created]}));
    await waitFor(() => expect(screen.getByTestId("route-race-challenge")).toHaveTextContent(challengeId));
    await press("route-race-retired"); await expectScreen("screen-hosted-home");
    await screen.unmount();
    await renderRoot(createClient({provisioning: [created]}));
    await expectScreen("screen-hosted-home");
    expect(screen.queryByTestId("route-race")).toBeNull();
  });

  it("replaces a restored unaccepted preview when a newer cold direct link arrives", async () => {
    /** Stored preview must remain replaceable until an actual join begins. */
    const previous = `live_${"1".repeat(64)}`, latest = `live_${"2".repeat(64)}`;
    await AsyncStorage.setItem(ANDROID_ENTRY_INBOX_KEY, JSON.stringify({version: 1, pending: {id: "previous-preview", url: `riddlequest://race?challengeId=${previous}`}, consumedInstallEntryUrl: null}));
    /** Native initial URL can resolve after persisted state is displayed. */
    let deliver: (url: string | null) => void = () => {};
    jest.spyOn(Linking, "getInitialURL").mockImplementation(() => new Promise(resolve => {deliver = resolve;}));
    await renderRoot(createClient({provisioning: [created]}));
    await waitFor(() => expect(screen.getByTestId("route-race-challenge")).toHaveTextContent(previous));
    await act(() => {deliver(`riddlequest://race?challengeId=${latest}`);});
    await waitFor(() => expect(screen.getByTestId("route-race-challenge")).toHaveTextContent(latest));
  });

  it("keeps hosted startup independent of a slow Play read and prioritizes a direct invitation", async () => {
    /** Deferred optional Play read, deliberately resolved after a direct invitation. */
    let deliver: (value: string | null) => void = () => {};
    jest.mocked(readPlayInstallReferrer).mockImplementation(() => new Promise(resolve => {deliver = resolve;}));
    /** Newer direct input that must outrank optional installation metadata. */
    const direct = `live_${"e".repeat(64)}`, installed = `live_${"f".repeat(64)}`;
    jest.spyOn(Linking, "getInitialURL").mockResolvedValue(`riddlequest://race?challengeId=${direct}`);
    await renderRoot(createClient({provisioning: [created]}));
    await waitFor(() => expect(screen.getByTestId("route-race-challenge")).toHaveTextContent(direct));
    await act(() => {deliver(`rq_entry=${encodeURIComponent(`riddlequest://race?challengeId=${installed}`)}`);});
    expect(screen.getByTestId("route-race-challenge")).toHaveTextContent(direct);
    await press("route-race-retired"); await expectScreen("screen-hosted-home");
    expect(screen.queryByTestId("route-race")).toBeNull();
  });

  it("refreshes a pre-provision placeholder balance even when Play Billing is unavailable", async () => {
    /** Fresh account provisioning returns the actual starting balance. */
    const client = createClient({provisioning: [created]});
    /** Auth can observe a uid before the backend account document exists. */
    const placeholder: BridgeProfile = {username: "Player", coins: 0, level: 1, xp: 0, winStreak: 0, gamesPlayed: 0, wins: 0, achievements: [], classicIndex: 1};
    /** The existing shared mapper may temporarily publish its empty-document fallback. */
    let snapshot: AuthSnapshot = {user: {uid: "device-uid", isAnonymous: true}, profile: placeholder};
    /** Native root and home receive the same account-owned profile publications. */
    const observers = new Set<(value: AuthSnapshot) => void>();
    /** Explicit profile reads are independent of optional commerce recovery. */
    const loadProfile = jest.fn<HostServices["loadProfile"]>(async () => {
      expect(client.recorded).toContain("provision");
      /** Canonical document loaded only after provisioning has completed. */
      const profile = {...placeholder, username: "Android", coins: 300};
      snapshot = {...snapshot, profile};
      for (const listener of observers) listener(snapshot);
      return profile;
    });
    /** Authenticated services retain a placeholder until their explicit authoritative refresh. */
    const services: HostServices = {...createFakeHostServices(), loadProfile, auth: {subscribe: listener => {
      observers.add(listener); listener(snapshot); return () => {observers.delete(listener);};
    }}};
    await render(<SafeAreaProvider><AndroidApp sdk={createPort()} contentSource={contentSource} client={client} services={services} billing={null} /></SafeAreaProvider>);
    await expectScreen("screen-hosted-home");
    await waitFor(() => expect(screen.getByTestId("hosted-coins")).toHaveTextContent(/300$/u));
    expect(loadProfile).toHaveBeenCalledWith("device-uid");
  });

});
