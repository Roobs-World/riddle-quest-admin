const transactionGet = jest.fn();
const transactionCreate = jest.fn();
const receiptUpdate = jest.fn();
const runTransaction = jest.fn(async (operation: (transaction: unknown) => Promise<unknown>) =>
  operation({get: transactionGet, create: transactionCreate}),
);
const receiptRef = {update: receiptUpdate};
const doc = jest.fn(() => receiptRef);
const collection = jest.fn(() => ({doc}));
const firestore = Object.assign(jest.fn(() => ({collection, runTransaction})), {
  FieldValue: {serverTimestamp: jest.fn(() => "server-time")},
});

jest.mock("../shared/firebaseAdmin", () => ({admin: {firestore}}));

import {gameCompletionReceiptId, runGameCompletionOnce} from "../gameplay/gameCompletionGuard";

describe("game completion replay protection", () => {
  beforeEach(() => {
    transactionGet.mockReset();
    transactionCreate.mockReset();
    receiptUpdate.mockReset();
  });

  it("creates stable, player-scoped opaque receipt identifiers", () => {
    expect(gameCompletionReceiptId("player-1", "classic", "riddle-1")).toHaveLength(64);
    expect(gameCompletionReceiptId("player-1", "classic", "riddle-1")).toBe(
      gameCompletionReceiptId("player-1", "classic", "riddle-1"),
    );
    expect(gameCompletionReceiptId("player-2", "classic", "riddle-1")).not.toBe(
      gameCompletionReceiptId("player-1", "classic", "riddle-1"),
    );
  });

  it("runs new completion side effects once and stores the authoritative result", async () => {
    transactionGet.mockResolvedValueOnce({exists: false});
    const operation = jest.fn().mockResolvedValue({coinsEarned: 50});

    await expect(runGameCompletionOnce("player-1", "classic", "riddle-1", operation)).resolves.toEqual({
      coinsEarned: 50,
    });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(transactionCreate).toHaveBeenCalledWith(receiptRef, expect.objectContaining({status: "processing"}));
    expect(receiptUpdate).toHaveBeenCalledWith(expect.objectContaining({status: "completed", result: {coinsEarned: 50}}));
  });

  it("returns a cached result without replaying side effects", async () => {
    transactionGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({status: "completed", result: {coinsEarned: 50}}),
    });
    const operation = jest.fn();

    await expect(runGameCompletionOnce("player-1", "classic", "riddle-1", operation)).resolves.toEqual({
      coinsEarned: 50,
    });
    expect(operation).not.toHaveBeenCalled();
  });

  it("fails closed while another completion is processing", async () => {
    transactionGet.mockResolvedValueOnce({exists: true, data: () => ({status: "processing"})});
    await expect(
      runGameCompletionOnce("player-1", "classic", "riddle-1", jest.fn()),
    ).rejects.toMatchObject({code: "aborted"});
  });
});
