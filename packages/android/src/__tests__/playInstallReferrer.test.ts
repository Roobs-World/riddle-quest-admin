import {afterEach, beforeEach, describe, expect, it, jest} from "@jest/globals";
import {NativeModules} from "react-native";
import {readPlayInstallReferrer} from "../hosted/playInstallReferrer";

describe("Play installation entry adapter", () => {
  beforeEach(() => {jest.useFakeTimers(); delete NativeModules.RiddleQuestInstallReferrer;});
  afterEach(() => {jest.useRealTimers(); delete NativeModules.RiddleQuestInstallReferrer;});

  it("returns null when the optional bridge or its method is unavailable", async () => {
    await expect(readPlayInstallReferrer()).resolves.toBeNull();
    NativeModules.RiddleQuestInstallReferrer = {readInstallReferrer: "unsupported"};
    await expect(readPlayInstallReferrer()).resolves.toBeNull();
  });

  it("returns the exact raw provider value without parsing or decoding it", async () => {
    /** Encoded metadata must reach the owning invitation codec unchanged. */
    const value = "rq_entry=riddlequest%3A%2F%2Freferral%3Ftoken%3Dopaque%2526other";
    NativeModules.RiddleQuestInstallReferrer = {readInstallReferrer: async () => value};
    await expect(readPlayInstallReferrer()).resolves.toBe(value);
    expect(jest.getTimerCount()).toBe(0);
    NativeModules.RiddleQuestInstallReferrer = {readInstallReferrer: async () => "r".repeat(4_096)};
    await expect(readPlayInstallReferrer()).resolves.toHaveLength(4_096);
  });

  it.each([null, undefined, "", 42, {}, "r".repeat(4_097)])("ignores malformed or oversized metadata %#", async value => {
    NativeModules.RiddleQuestInstallReferrer = {readInstallReferrer: async () => value};
    await expect(readPlayInstallReferrer()).resolves.toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("resolves null for both synchronous bridge failures and rejected reads", async () => {
    NativeModules.RiddleQuestInstallReferrer = {readInstallReferrer: () => {throw Error("unsupported");}};
    await expect(readPlayInstallReferrer()).resolves.toBeNull();
    NativeModules.RiddleQuestInstallReferrer = {readInstallReferrer: async () => {throw Error("unavailable");}};
    await expect(readPlayInstallReferrer()).resolves.toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("shares overlapping reads, expires a stalled bridge and ignores its late result", async () => {
    /** The native result may arrive after the optional startup deadline. */
    let complete: ((value: unknown) => void) | undefined;
    /** Only one native service connection may exist for overlapping consumers. */
    const read = jest.fn(() => new Promise<unknown>(resolve => {complete = resolve;}));
    NativeModules.RiddleQuestInstallReferrer = {readInstallReferrer: read};
    /** First consumer owns the shared in-flight read. */
    const first = readPlayInstallReferrer();
    expect(readPlayInstallReferrer()).toBe(first);
    await Promise.resolve();
    expect(read).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(5_500);
    await expect(first).resolves.toBeNull();
    complete?.("late-referrer");
    await Promise.resolve();
    expect(jest.getTimerCount()).toBe(0);
    NativeModules.RiddleQuestInstallReferrer = {readInstallReferrer: async () => "fresh-referrer"};
    await expect(readPlayInstallReferrer()).resolves.toBe("fresh-referrer");
  });
});
