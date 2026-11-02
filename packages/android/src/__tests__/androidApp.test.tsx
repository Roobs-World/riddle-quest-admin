import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import type {YouTubeLocale, YouTubeSdkPort} from "@riddle-quest/solo";
import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {AndroidApp} from "../AndroidApp";
import type {HostedFirebaseClient, ProvisionedAccount} from "../hosted/firebaseClient";
import {calls, createFakeHostServices, subscribers} from "../test/fakeHostServices";
import {contentSource, createPort, expectScreen, press} from "../test/harness";

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
  beforeEach(() => {
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
    expect(calls).toEqual(["loadRiddle:classic:authoritative"]);
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
});
