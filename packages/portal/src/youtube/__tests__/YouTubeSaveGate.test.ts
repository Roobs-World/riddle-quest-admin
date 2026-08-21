import {createEmptyYouTubeSave} from "../save";
import {YouTubeSaveBlockedError, YouTubeSaveGate} from "../YouTubeSaveGate";

describe("YouTubeSaveGate", () => {
  it("retains and retries the exact serialized revision after response uncertainty", async () => {
    const saveData = jest.fn<Promise<void>, [string]>()
      .mockRejectedValueOnce(new Error("uncertain"))
      .mockResolvedValue(undefined);
    const gate = new YouTubeSaveGate({saveData});
    const save = createEmptyYouTubeSave("content-v1");
    save.revision = 1;

    await expect(gate.commit(save)).rejects.toThrow("uncertain");
    expect(gate.blocked).toBe(true);
    expect(gate.pendingRevision).toBe(1);
    const firstPayload = saveData.mock.calls[0]?.[0];
    save.progression.coins = 999;

    await gate.retry();
    expect(gate.blocked).toBe(false);
    expect(gate.pendingRevision).toBeNull();
    expect(saveData.mock.calls[1]?.[0]).toBe(firstPayload);
    expect(saveData.mock.calls[1]?.[0]).not.toContain("999");
  });

  it("rejects a new revision while another exact payload is pending", async () => {
    const saveData = jest.fn(async () => { throw new Error("offline"); });
    const gate = new YouTubeSaveGate({saveData});
    const first = createEmptyYouTubeSave("content-v1");
    first.revision = 1;
    await expect(gate.commit(first)).rejects.toThrow("offline");
    const second = createEmptyYouTubeSave("content-v1");
    second.revision = 2;
    await expect(gate.commit(second)).rejects.toBeInstanceOf(YouTubeSaveBlockedError);
    expect(saveData).toHaveBeenCalledTimes(1);
  });

  it("normalizes a synchronous SDK throw into the exact retry path", async () => {
    const saveData = jest.fn<Promise<void>, [string]>()
      .mockImplementationOnce(() => { throw new Error("sync-provider-failure"); })
      .mockResolvedValueOnce(undefined);
    const gate = new YouTubeSaveGate({saveData});
    const save = createEmptyYouTubeSave("content-v1");
    save.revision = 1;
    await expect(gate.commit(save)).rejects.toThrow("sync-provider-failure");
    expect(gate.blocked).toBe(true);
    const exactPayload = saveData.mock.calls[0]?.[0];
    await gate.retry();
    expect(saveData.mock.calls[1]?.[0]).toBe(exactPayload);
    expect(gate.blocked).toBe(false);
  });
});
