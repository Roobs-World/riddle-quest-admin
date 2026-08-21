import {expect, it, jest} from "@jest/globals";
import {LocalAccountDeletionGate} from "../LocalAccountDeletionGate";

it("drains accepted work before deletion and rejects later work", async () => {
  let epoch: string | null = null;
  const gate = new LocalAccountDeletionGate({
    requireCrossContextLock: false,
    readEpoch: () => epoch,
    writeEpoch: (value) => { epoch = value; },
  });
  let releaseWrite = () => undefined;
  const writeBarrier = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
  const events: string[] = [];
  const write = gate.run(async () => {
    events.push("write-start");
    await writeBarrier;
    events.push("write-end");
  });
  await Promise.resolve();

  gate.close();
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
  const gate = new LocalAccountDeletionGate({requireCrossContextLock: false});
  await expect(gate.run(async () => {
    throw new Error("write-failed");
  })).rejects.toThrow("write-failed");
  const deletion = jest.fn(async () => undefined);
  await gate.runExclusive(deletion);
  expect(deletion).toHaveBeenCalledTimes(1);
});

it("invalidates sibling tabs through the durable deletion epoch", async () => {
  let epoch: string | null = null;
  const options = {
    requireCrossContextLock: false,
    readEpoch: () => epoch,
    writeEpoch: (value: string) => { epoch = value; },
  };
  const owner = new LocalAccountDeletionGate(options);
  const sibling = new LocalAccountDeletionGate(options);
  owner.close();
  expect(sibling.isOpen()).toBe(false);
  await expect(sibling.run(async () => undefined)).rejects.toThrow("account-deletion-requested");
});

it("fails deletion closed without a cross-context lock in a secure runtime", async () => {
  const gate = new LocalAccountDeletionGate({crossContextLock: null, requireCrossContextLock: true});
  await expect(gate.runExclusive(async () => undefined)).rejects.toThrow(
    "account-deletion-cross-context-lock-unavailable",
  );
});
