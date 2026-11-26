import {expect, it, jest} from "@jest/globals";
import {LocalAccountDeletionGate} from "../LocalAccountDeletionGate";

it("drains accepted work before deletion and rejects later work", async () => {
  /** Provides epoch behavior. */
  let epoch: string | null = null;
  /** Provides gate behavior. */
  const gate = new LocalAccountDeletionGate({
    requireCrossContextLock: false,
    readEpoch: () => epoch,
    writeEpoch: (value) => {
      epoch = value;
    },
  });
  /** Provides release write behavior. */
  let releaseWrite = () => undefined;
  /** Provides write barrier behavior. */
  const writeBarrier = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
  /** Provides events behavior. */
  const events: string[] = [];
  /** Provides write behavior. */
  const write = gate.run(async () => {
    events.push("write-start");
    await writeBarrier;
    events.push("write-end");
  });
  await Promise.resolve();

  gate.close();
  /** Provides deletion behavior. */
  const deletion = gate.runExclusive(async () => {
    events.push("delete");
  });
  await expect(gate.run(async () => events.push("late-write"))).rejects.toThrow("account-deletion-requested");
  expect(events).toEqual(["write-start"]);

  releaseWrite();
  await Promise.all([write, deletion]);
  expect(events).toEqual(["write-start", "write-end", "delete"]);
  expect(gate.isOpen()).toBe(false);
});

it("releases the queue when accepted work fails", async () => {
  /** Provides gate behavior. */
  const gate = new LocalAccountDeletionGate({requireCrossContextLock: false});
  await expect(
    gate.run(async () => {
      throw new Error("write-failed");
    }),
  ).rejects.toThrow("write-failed");
  /** Provides deletion behavior. */
  const deletion = jest.fn(async () => undefined);
  await gate.runExclusive(deletion);
  expect(deletion).toHaveBeenCalledTimes(1);
});

it("invalidates sibling tabs through the durable deletion epoch", async () => {
  /** Provides epoch behavior. */
  let epoch: string | null = null;
  /** Provides options behavior. */
  const options = {
    requireCrossContextLock: false,
    readEpoch: () => epoch,
    writeEpoch: (value: string) => {
      epoch = value;
    },
  };
  /** Provides owner behavior. */
  const owner = new LocalAccountDeletionGate(options);
  /** Provides sibling behavior. */
  const sibling = new LocalAccountDeletionGate(options);
  owner.close();
  expect(sibling.isOpen()).toBe(false);
  await expect(sibling.run(async () => undefined)).rejects.toThrow("account-deletion-requested");
});

it("fails deletion closed without a cross-context lock in a secure runtime", async () => {
  /** Provides gate behavior. */
  const gate = new LocalAccountDeletionGate({crossContextLock: null, requireCrossContextLock: true});
  await expect(gate.runExclusive(async () => undefined)).rejects.toThrow(
    "account-deletion-cross-context-lock-unavailable",
  );
});

it("keeps stale tabs closed after deletion clears the epoch and a new account starts", async () => {
  let epoch: string | null = null;
  const options = {requireCrossContextLock: false, readEpoch: () => epoch, writeEpoch: (value: string) => {epoch = value;}};
  const owner = new LocalAccountDeletionGate(options);
  const sibling = new LocalAccountDeletionGate(options);
  expect(epoch).not.toBeNull();
  owner.close();
  epoch = null;
  expect(sibling.isOpen()).toBe(false);
  const fresh = new LocalAccountDeletionGate(options);
  expect(fresh.isOpen()).toBe(true);
  expect(sibling.isOpen()).toBe(false);
  await expect(sibling.run(async () => undefined)).rejects.toThrow("account-deletion-requested");
});
