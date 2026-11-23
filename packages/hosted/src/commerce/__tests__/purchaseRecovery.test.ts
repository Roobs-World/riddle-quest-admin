import {describe, expect, it, jest} from "@jest/globals";
import {createPurchaseRecovery} from "../purchaseRecovery";

describe("purchase recovery", () => {
  it("reconciles another update received during recovery without overlapping grants", async () => {
    /** Retains release for this operation. */
    let release: () => void = () => {};
    /** Retains first for this operation. */
    const first = new Promise<void>(resolve => { release = resolve; });
    /** Retains restore for this operation. */
    const restore = jest.fn<() => Promise<unknown>>().mockImplementationOnce(() => first).mockResolvedValue(undefined);
    /** Retains on recovered for this operation. */
    const onRecovered = jest.fn<() => Promise<unknown>>().mockResolvedValue(undefined);
    /** Retains recovery for this operation. */
    const recovery = createPurchaseRecovery({restore, onRecovered});
    /** Retains completed for this operation. */
    const completed = recovery.request();
    await Promise.resolve();
    void recovery.request();
    expect(restore).toHaveBeenCalledTimes(1);
    release();
    await completed;
    expect(restore).toHaveBeenCalledTimes(2);
    expect(onRecovered).toHaveBeenCalledTimes(2);
  });

  it("retries after a transport failure and never refreshes an abandoned account", async () => {
    /** Retains release for this operation. */
    let release: () => void = () => {};
    /** Retains restore for this operation. */
    const restore = jest.fn<() => Promise<unknown>>().mockRejectedValueOnce(new Error("offline"))
      .mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
    /** Retains on recovered for this operation. */
    const onRecovered = jest.fn<() => Promise<unknown>>().mockResolvedValue(undefined);
    /** Retains recovery for this operation. */
    const recovery = createPurchaseRecovery({restore, onRecovered});
    await recovery.request();
    /** Retains completed for this operation. */
    const completed = recovery.request();
    await Promise.resolve();
    recovery.dispose();
    release();
    await completed;
    await recovery.request();
    expect(restore).toHaveBeenCalledTimes(2);
    expect(onRecovered).not.toHaveBeenCalled();
  });
});
