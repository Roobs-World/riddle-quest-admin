import {createEmptyYouTubeSave} from "../../playable/save";
import {YouTubeSaveBlockedError, YouTubeSaveGate} from "../../playable/YouTubeSaveGate";

describe("YouTubeSaveGate", () => {
  it("retains and retries the exact serialized revision after response uncertainty", async () => {
    /** Saves data. */
    const saveData = jest
      .fn<Promise<void>, [string]>()
      .mockRejectedValueOnce(new Error("uncertain"))
      .mockResolvedValue(undefined);
    /** Provides gate behavior. */
    const gate = new YouTubeSaveGate({saveData});
    /** Provides save behavior. */
    const save = createEmptyYouTubeSave("content-v1");
    save.revision = 1;

    await expect(gate.commit(save)).rejects.toThrow("uncertain");
    expect(gate.blocked).toBe(true);
    expect(gate.pendingRevision).toBe(1);
    /** Provides first payload behavior. */
    const firstPayload = saveData.mock.calls[0]?.[0];
    save.progression.coins = 999;

    await gate.retry();
    expect(gate.blocked).toBe(false);
    expect(gate.pendingRevision).toBeNull();
    expect(saveData.mock.calls[1]?.[0]).toBe(firstPayload);
    expect(saveData.mock.calls[1]?.[0]).not.toContain("999");
  });

  it("rejects a new revision while another exact payload is pending", async () => {
    /** Saves data. */
    const saveData = jest.fn(async () => {
      throw new Error("offline");
    });
    /** Provides gate behavior. */
    const gate = new YouTubeSaveGate({saveData});
    /** Provides first behavior. */
    const first = createEmptyYouTubeSave("content-v1");
    first.revision = 1;
    await expect(gate.commit(first)).rejects.toThrow("offline");
    /** Provides second behavior. */
    const second = createEmptyYouTubeSave("content-v1");
    second.revision = 2;
    await expect(gate.commit(second)).rejects.toBeInstanceOf(YouTubeSaveBlockedError);
    expect(saveData).toHaveBeenCalledTimes(1);
  });

  it("normalizes a synchronous SDK throw into the exact retry path", async () => {
    /** Saves data. */
    const saveData = jest
      .fn<Promise<void>, [string]>()
      .mockImplementationOnce(() => {
        throw new Error("sync-provider-failure");
      })
      .mockResolvedValueOnce(undefined);
    /** Provides gate behavior. */
    const gate = new YouTubeSaveGate({saveData});
    /** Provides save behavior. */
    const save = createEmptyYouTubeSave("content-v1");
    save.revision = 1;
    await expect(gate.commit(save)).rejects.toThrow("sync-provider-failure");
    expect(gate.blocked).toBe(true);
    /** Provides exact payload behavior. */
    const exactPayload = saveData.mock.calls[0]?.[0];
    await gate.retry();
    expect(saveData.mock.calls[1]?.[0]).toBe(exactPayload);
    expect(gate.blocked).toBe(false);
  });
});

it("coalesces retries and exit flushes while an exact save is still in flight", async () => {
  /** Provider completion is held independently of the game's local mutation attempts. */
  let release!: () => void;
  /** Only one exact serialized write may reach the provider before that completion. */
  const saveData = jest.fn((_serialized: string) => new Promise<void>(resolve => {release = resolve;}));
  /** The real gate owns serialization, uncertainty and write ordering. */
  const gate = new YouTubeSaveGate({saveData}), save = createEmptyYouTubeSave("content-v1");
  save.revision = 1;
  /** First commit reserves immutable bytes before awaiting the provider. */
  const first = gate.commit(save);
  await Promise.resolve();
  expect(gate.writing).toBe(true);
  expect(gate.pendingRevision).toBe(1);
  /** Mutating caller-owned data cannot change an already reserved revision. */
  const exact = saveData.mock.calls[0]![0];
  save.progression.coins = 999;
  gate.flush();
  /** Explicit retry shares the outstanding write instead of starting another one. */
  const retry = gate.retry();
  /** A newer revision cannot overtake the uncertain original write. */
  const newer = createEmptyYouTubeSave("content-v1"); newer.revision = 2;
  await expect(gate.commit(newer)).rejects.toBeInstanceOf(YouTubeSaveBlockedError);
  expect(saveData).toHaveBeenCalledTimes(1);
  expect(exact).not.toContain("999");
  release();
  await Promise.all([first, retry]);
  expect(gate.writing).toBe(false);
  expect(gate.pendingRevision).toBeNull();
  expect(gate.blocked).toBe(false);
});
