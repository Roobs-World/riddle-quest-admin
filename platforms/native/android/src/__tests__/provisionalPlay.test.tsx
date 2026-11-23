import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import type {HostServices} from "../../../../../src/hosted/hostTypes";
import {fireEvent, render, screen, waitFor} from "@testing-library/react-native";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {createAndroidPendingPlayStorage, type PendingPlayDeviceStore} from "../hosted/pendingPlayStorage";
import {HostedGameScreen} from "../screens/HostedGameScreen";
import {calls, createFakeHostServices as createServices, issued, score, subscribers} from "../test/fakeHostServices";

/** Journal key the shared journal writes for the fake account in English. */
const JOURNAL_KEY = "riddleQuest:pendingPlay:v1:device-uid:1:en";
/** In-memory device store with its backing map exposed. */
const createStore = () => {
  /** Stored values. */
  const map = new Map<string, string>();
  /** Store facade. */
  const store: PendingPlayDeviceStore = {
    getItem: async (key) => map.get(key) ?? null,
    setItem: async (key, value) => {
      map.set(key, value);
    },
    removeItem: async (key) => {
      map.delete(key);
    },
  };
  return {map, store};
};
/** Records every guess request id the screen sends. */
const trackRequestIds = (services: HostServices): string[] => {
  /** Ids in send order. */
  const ids: string[] = [];
  /** Original delivery. */
  const original = services.submitGuess;
  Object.assign(services, {
    submitGuess: (input: Parameters<HostServices["submitGuess"]>[0]) => {
      ids.push(input.requestId);
      return original(input);
    },
  });
  return ids;
};
/** Renders the hosted screen with a journal. */
const renderBuffered = (services: HostServices, store: PendingPlayDeviceStore) => {
  /** Device-backed journal storage. */
  const journal = createAndroidPendingPlayStorage(store);
  return render(
    <SafeAreaProvider>
      <HostedGameScreen services={services} mode="classic" locale="en" onBack={jest.fn()} journal={journal} />
    </SafeAreaProvider>,
  ).then((rendered) => ({...rendered, journal}));
};
/** Types letters on the on-screen keys. */
const typeLetters = async (letters: string): Promise<void> => {
  for (const letter of letters.toUpperCase()) await fireEvent.press(screen.getByTestId(`key-${letter}`));
};
/** Waits until a node is mounted. */
const expectId = (testID: string) => waitFor(() => expect(screen.getByTestId(testID)).toBeTruthy());

describe("provisional play buffering", () => {
  beforeEach(() => {
    calls.length = 0;
    subscribers.clear();
  });

  it("restores the unsent draft and cursor after a remount", async () => {
    /** Device store fixture. */
    const fixture = createStore();
    /** First mount of the screen. */
    const first = await renderBuffered(createServices(), fixture.store);
    await expectId("screen-hosted-game");
    await typeLetters("ro");
    await first.journal.settled();
    expect(JSON.parse(fixture.map.get(JOURNAL_KEY) ?? "{}")).toMatchObject({version: 1, draft: ["r", "o", "", ""], draftActiveSlotIndex: 2, queue: []});
    await first.unmount();
    await renderBuffered(createServices(), fixture.store);
    await expectId("screen-hosted-game");
    expect(screen.getByTestId("hosted-slot-0")).toHaveTextContent("r");
    expect(screen.getByTestId("hosted-slot-1")).toHaveTextContent("o");
    await typeLetters("me");
    expect(screen.getByTestId("hosted-slot-3")).toHaveTextContent("e");
  });

  it("redelivers a guess that failed in transit with the same request id", async () => {
    /** Device store fixture. */
    const fixture = createStore();
    /** Deliveries attempted by the fake backend. */
    let sends = 0;
    /** Fails the first delivery like a dropped connection. */
    const guess = async (text: string) => {
      sends += 1;
      if (sends === 1) throw new Error("network request failed");
      return score(text, 1);
    };
    /** Scripted services. */
    const services = createServices({guess});
    /** Request ids sent by the first mount. */
    const ids = trackRequestIds(services);
    /** First mount of the screen. */
    const first = await renderBuffered(services, fixture.store);
    await expectId("screen-hosted-game");
    await typeLetters("more");
    await fireEvent.press(screen.getByTestId("hosted-submit"));
    await waitFor(() => expect(screen.getByTestId("hosted-notice")).toBeTruthy());
    await first.journal.settled();
    expect(JSON.parse(fixture.map.get(JOURNAL_KEY) ?? "{}").queue).toHaveLength(1);
    await first.unmount();
    /** Services for the second mount. */
    const again = createServices({guess});
    /** Request ids sent by the second mount. */
    const laterIds = trackRequestIds(again);
    /** Second mount of the screen. */
    const second = await renderBuffered(again, fixture.store);
    await expectId("hosted-guess-row-0");
    expect(laterIds).toEqual([ids[0]]);
    expect(screen.getByTestId("hosted-guess-0-0-yellow")).toBeTruthy();
    await second.journal.settled();
    expect(JSON.parse(fixture.map.get(JOURNAL_KEY) ?? "{}")).toMatchObject({queue: [], draft: ["", "", "", ""]});
    // A draft typed after the redelivered guess survives the next restart too.
    await typeLetters("ro");
    await second.journal.settled();
    expect(JSON.parse(fixture.map.get(JOURNAL_KEY) ?? "{}")).toMatchObject({queue: [], draft: ["r", "o", "", ""]});
    await second.unmount();
    await renderBuffered(createServices({guess}), fixture.store);
    await waitFor(() => expect(screen.getByTestId("hosted-slot-0")).toHaveTextContent("r"));
    expect(screen.getByTestId("hosted-slot-1")).toHaveTextContent("o");
  });

  it.each(["functions/unavailable", "functions/internal", "functions/deadline-exceeded"])(
    "keeps a guess the Firebase SDK reports as %s journaled for redelivery",
    async (code) => {
      /** Device store fixture. */
      const fixture = createStore();
      /** Deliveries attempted by the fake backend. */
      let sends = 0;
      /** Fails the first delivery the way the callable SDK does when the device is offline. */
      const guess = async (text: string) => {
        sends += 1;
        if (sends === 1) throw Object.assign(new Error("offline"), {code});
        return score(text, 1);
      };
      /** First mount of the screen. */
      const first = await renderBuffered(createServices({guess}), fixture.store);
      await expectId("screen-hosted-game");
      await typeLetters("more");
      await fireEvent.press(screen.getByTestId("hosted-submit"));
      await waitFor(() => expect(screen.getByTestId("hosted-notice")).toBeTruthy());
      await first.journal.settled();
      expect(JSON.parse(fixture.map.get(JOURNAL_KEY) ?? "{}").queue).toHaveLength(1);
      await first.unmount();
      await renderBuffered(createServices({guess}), fixture.store);
      await expectId("hosted-guess-row-0");
    },
  );

  it("drops a rejected guess instead of replaying it, and a fresh guess gets a new id", async () => {
    /** Device store fixture. */
    const fixture = createStore();
    /** Rejects the first delivery with a non-retryable code. */
    let sends = 0;
    /** Scripted guess delivery. */
    const guess = async (text: string) => {
      sends += 1;
      if (sends === 1) throw Object.assign(new Error("not enough coins"), {code: "functions/failed-precondition"});
      return score(text, 1);
    };
    /** Scripted services. */
    const services = createServices({guess});
    /** Request ids sent by the first mount. */
    const ids = trackRequestIds(services);
    /** First mount of the screen. */
    const first = await renderBuffered(services, fixture.store);
    await expectId("screen-hosted-game");
    await typeLetters("more");
    await fireEvent.press(screen.getByTestId("hosted-submit"));
    await waitFor(() => expect(screen.getByTestId("hosted-notice")).toHaveTextContent(/coins/iu));
    await first.journal.settled();
    expect(JSON.parse(fixture.map.get(JOURNAL_KEY) ?? "{}").queue).toEqual([]);
    await fireEvent.press(screen.getByTestId("hosted-submit"));
    await expectId("hosted-guess-row-0");
    expect(ids).toHaveLength(2);
    expect(ids[1]).not.toBe(ids[0]);
  });

  it("discards a journal left by another question without sending anything", async () => {
    /** Device store fixture. */
    const fixture = createStore();
    fixture.map.set(
      JOURNAL_KEY,
      JSON.stringify({
        version: 1,
        scope: "device-uid:1:en",
        riddle: issued({sessionToken: "other-session-token-0123456789"}),
        confirmedClassicIndex: 1,
        base: {},
        successors: [],
        queue: [{message: {type: "game:submitGuess", requestId: "guess-stale-0001", payload: {riddleId: "race:history:01", gameMode: "classic", sessionToken: "other-session-token-0123456789", guess: "more", requestId: "guess-stale-0001"}}, attempts: 1, isCorrect: false, gameOver: false, canContinue: false, feedback: []}],
        draft: ["m", "o", "r", "e"],
      }),
    );
    /** Mounted screen with its journal. */
    const rendered = await renderBuffered(createServices(), fixture.store);
    await expectId("screen-hosted-game");
    await rendered.journal.settled();
    expect(fixture.map.has(JOURNAL_KEY)).toBe(false);
    expect(calls.filter((call) => call.startsWith("submitGuess"))).toHaveLength(0);
    expect(screen.getByTestId("hosted-slot-0")).toHaveTextContent("");
  });

  it("clears the journal once the question is settled", async () => {
    /** Device store fixture. */
    const fixture = createStore();
    /** Mounted screen with its journal. */
    const rendered = await renderBuffered(createServices(), fixture.store);
    await expectId("screen-hosted-game");
    await typeLetters("rome");
    await fireEvent.press(screen.getByTestId("hosted-submit"));
    await expectId("screen-hosted-result");
    await rendered.journal.settled();
    expect(fixture.map.has(JOURNAL_KEY)).toBe(false);
  });

  it("keeps playing when the device store fails", async () => {
    /** Store that rejects every operation. */
    const broken: PendingPlayDeviceStore = {
      getItem: async () => {
        throw new Error("disk");
      },
      setItem: async () => {
        throw new Error("disk");
      },
      removeItem: async () => {
        throw new Error("disk");
      },
    };
    /** Mounted screen with its journal. */
    const rendered = await renderBuffered(createServices(), broken);
    await expectId("screen-hosted-game");
    await typeLetters("rome");
    await fireEvent.press(screen.getByTestId("hosted-submit"));
    await expectId("screen-hosted-result");
    await rendered.journal.settled();
  });
});

describe("createAndroidPendingPlayStorage", () => {
  it("serves cached writes synchronously and never lets hydration overwrite them", async () => {
    /** Device store fixture. */
    const fixture = createStore();
    fixture.map.set("riddleQuest:pendingPlay:v1:s", "old");
    /** Storage under test. */
    const storage = createAndroidPendingPlayStorage(fixture.store);
    storage.setItem("riddleQuest:pendingPlay:v1:s", "new");
    expect(storage.getItem("riddleQuest:pendingPlay:v1:s")).toBe("new");
    await storage.hydrate("s");
    await storage.hydrate("s");
    expect(storage.getItem("riddleQuest:pendingPlay:v1:s")).toBe("new");
    expect(fixture.map.get("riddleQuest:pendingPlay:v1:s")).toBe("new");
    storage.removeItem("riddleQuest:pendingPlay:v1:s");
    expect(storage.getItem("riddleQuest:pendingPlay:v1:s")).toBeNull();
    await storage.settled();
    expect(fixture.map.has("riddleQuest:pendingPlay:v1:s")).toBe(false);
  });

  it("hydrates device values that were never written in this process", async () => {
    /** Device store fixture. */
    const fixture = createStore();
    fixture.map.set("riddleQuest:pendingPlayLease:v1:s", "lease");
    /** Storage under test. */
    const storage = createAndroidPendingPlayStorage(fixture.store);
    expect(storage.getItem("riddleQuest:pendingPlayLease:v1:s")).toBeNull();
    await storage.hydrate("s");
    expect(storage.getItem("riddleQuest:pendingPlayLease:v1:s")).toBe("lease");
  });
});
