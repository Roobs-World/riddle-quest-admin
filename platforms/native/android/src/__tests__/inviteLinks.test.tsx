import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {ANDROID_ENTRY_INBOX_KEY, parseAndroidInstallEntry} from "../entries/androidEntryInbox";
import {SUPPORTED_LOCALES} from "../../../../../src/localization/locales";
import {act, renderHook, waitFor} from "@testing-library/react-native";
import {Linking, Share} from "react-native";
import {useAndroidEntries} from "../hosted/useAndroidEntries";
import {readPlayInstallReferrer} from "../hosted/playInstallReferrer";
import {shareAndroidInvite} from "../hosted/inviteShare";
import {shareAndroidRaceChallenge} from "../hosted/raceLinks";
import {androidInviteGuidance} from "../i18n/inviteCopy";

jest.mock("../hosted/playInstallReferrer", () => ({readPlayInstallReferrer: jest.fn(async () => null)}));
/** Native listener payload inferred from React Native's actual API. */
type LinkEvent = Parameters<Parameters<typeof Linking.addEventListener>[1]>[0];
/** Independently issued entry handles exercise native source ordering. */
const first = `riddlequest://race?challengeId=live_${"a".repeat(64)}`;
/** Referral entry proves that the parser dispatches a different recognized destination. */
const newer = `riddlequest://referral?token=${"b".repeat(43)}`;

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.mocked(readPlayInstallReferrer).mockResolvedValue(null);
  jest.spyOn(Linking, "getInitialURL").mockResolvedValue(null);
  jest.spyOn(Linking, "addEventListener").mockImplementation(() => ({remove: () => undefined}));
});

describe("native invite entry adapters", () => {
  it("shares a direct invite and encoded Play fallback with reopen guidance in every supported language", async () => {
    /** Native share-sheet spy checking both direct and install URLs without granting rewards. */
    const share = jest.spyOn(Share, "share").mockResolvedValue({action: Share.sharedAction, activityType: undefined});
    for (const locale of SUPPORTED_LOCALES) {
      await shareAndroidInvite({url: newer, title: "Invite", message: "Join", locale});
      /** Actual native share payload for the current supported language. */
      const content = share.mock.calls.at(-1)?.[0];
      expect(content?.message).toContain(newer);
      expect(content?.message).toContain(androidInviteGuidance(locale));
      /** Store fallback extracted from the shared message for an independent decode check. */
      const storeText = content?.message?.split("\n").find(line => line.startsWith("https://play.google.com/"));
      if (!storeText) throw new Error("missing store fallback");
      expect(parseAndroidInstallEntry(new URL(storeText).searchParams.get("referrer"))?.url).toBe(newer);
    }
    await shareAndroidRaceChallenge(`live_${"a".repeat(64)}`, "Race", "Join", "en");
    expect(share.mock.calls.at(-1)?.[0].message).toContain(first);
    share.mockRejectedValueOnce(new Error("share unavailable"));
    await expect(shareAndroidRaceChallenge(`live_${"a".repeat(64)}`, "Race", "Join", "en")).resolves.toBe("error");
    share.mockRestore();
  });
  it("keeps foreground input when both native cold-entry reads resolve late", async () => {
    /** New controller lifetime hydrating the same device-private storage. */
    let cold: (url: string | null) => void = () => {};
    /** Optional installation delivery awaiting the same serialized storage chain. */
    let install: (value: string | null) => void = () => {};
    /** Captured native foreground-link callback used to deliver a real adapter event. */
    let receive: ((event: LinkEvent) => void) | undefined;
    jest.spyOn(Linking, "getInitialURL").mockImplementation(() => new Promise(resolve => {cold = resolve;}));
    jest.mocked(readPlayInstallReferrer).mockImplementation(() => new Promise(resolve => {install = resolve;}));
    jest.spyOn(Linking, "addEventListener").mockImplementation((_name, listener) => {receive = listener; return {remove: () => undefined};});
    /** Mounted native input adapter and its subscribed durable preview. */
    const hook = await renderHook(() => useAndroidEntries({ignoreEntry: () => false, onDaily: () => {}}));
    await act(() => {receive?.({url: newer});});
    await waitFor(() => expect(hook.result.current.pending?.entry.url).toBe(newer));
    await act(() => {cold(first); install(`rq_entry=${encodeURIComponent(first)}`);});
    expect(hook.result.current.pending?.entry.url).toBe(newer);
    /** Current validated durable preview reconstructed for presentation. */
    const stored = await AsyncStorage.getItem(ANDROID_ENTRY_INBOX_KEY);
    expect(stored).toContain("consumedInstallEntryUrl");
    expect(stored).not.toContain("utm_");
  });
  it("ignores an already displayed race without replacing its distinct queued entry", async () => {
    /** Captured native foreground-link callback used to deliver a real adapter event. */
    let receive: ((event: LinkEvent) => void) | undefined;
    jest.spyOn(Linking, "addEventListener").mockImplementation((_name, listener) => {receive = listener; return {remove: () => undefined};});
    /** Separate Daily navigation callback, with no invitation acceptance semantics. */
    const daily = jest.fn();
    /** Mounted native input adapter and its subscribed durable preview. */
    const hook = await renderHook(() => useAndroidEntries({ignoreEntry: entry => entry.url === first, onDaily: daily}));
    await act(() => {receive?.({url: newer});});
    await waitFor(() => expect(hook.result.current.pending?.entry.url).toBe(newer));
    /** Existing pending preview takes precedence over an unsolicited installation entry. */
    const pending = hook.result.current.pending;
    await act(() => {receive?.({url: first}); receive?.({url: "https://evil.example"}); receive?.({url: "riddlequest://daily"});});
    expect(hook.result.current.pending).toEqual(pending);
    expect(daily).toHaveBeenCalledTimes(1);
  });
  it("keeps explicit Daily navigation when a valid Play invite arrives afterward", async () => {
    /** Delayed optional Play result must not displace an explicit foreground destination. */
    let install: (value: string | null) => void = () => {};
    /** Native URL listener used to open Daily before the store read completes. */
    let receive: ((event: LinkEvent) => void) | undefined;
    jest.mocked(readPlayInstallReferrer).mockImplementation(() => new Promise(resolve => {install = resolve;}));
    jest.spyOn(Linking, "addEventListener").mockImplementation((_name, listener) => {receive = listener; return {remove: () => undefined};});
    /** Daily routing stays independent from invitation receipts and server acceptance. */
    const daily = jest.fn();
    /** Mounted bridge handles the actual foreground-then-Play ordering. */
    const hook = await renderHook(() => useAndroidEntries({ignoreEntry: () => false, onDaily: daily}));
    await act(() => {receive?.({url: "riddlequest://daily"}); install(`rq_entry=${encodeURIComponent(first)}`);});
    expect(daily).toHaveBeenCalledTimes(1); expect(hook.result.current.pending).toBeNull();
    await waitFor(async () => expect(await AsyncStorage.getItem(ANDROID_ENTRY_INBOX_KEY)).toContain("consumedInstallEntryUrl"));
    await hook.unmount();
    /** Another native read on cold startup must not resurrect that superseded Play invitation. */
    jest.mocked(readPlayInstallReferrer).mockResolvedValue(`rq_entry=${encodeURIComponent(first)}`);
    /** New native lifetime must not resurrect the superseded installation entry. */
    const cold = await renderHook(() => useAndroidEntries({ignoreEntry: () => false, onDaily: daily}));
    expect(cold.result.current.pending).toBeNull();
  });

  it("treats failed optional native reads as no entry and removes the listener on retirement", async () => {
    /** Native listener cleanup observed when the adapter retires. */
    const remove = jest.fn();
    jest.spyOn(Linking, "addEventListener").mockImplementation(() => ({remove}));
    jest.spyOn(Linking, "getInitialURL").mockRejectedValue(new Error("native unavailable"));
    jest.mocked(readPlayInstallReferrer).mockRejectedValue(new Error("native unavailable"));
    /** Mounted native input adapter and its subscribed durable preview. */
    const hook = await renderHook(() => useAndroidEntries({ignoreEntry: () => false, onDaily: () => {}}));
    expect(hook.result.current.pending).toBeNull();
    await hook.unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
