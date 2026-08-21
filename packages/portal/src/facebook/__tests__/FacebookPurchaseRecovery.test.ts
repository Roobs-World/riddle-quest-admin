import {describe, expect, jest, test} from "@jest/globals";
import {FacebookPurchaseRecovery, parseFacebookUnconsumedPurchases} from "../FacebookPurchaseRecovery";

const purchase = (overrides: Record<string, unknown> = {}) => ({
  isConsumed: false,
  paymentActionType: "charge",
  paymentID: "payment-1",
  productID: "coins_250",
  purchasePlatform: "FB",
  purchasePrice: {amount: "0.99", currency: "USD"},
  purchaseTime: "1787220000",
  purchaseToken: "purchase-token-1",
  signedRequest: "signature.payload",
  ...overrides,
});

describe("Facebook purchase recovery", () => {
  test("grants each signed request before consuming its token", async () => {
    const events: string[] = [];
    const payments = {
      getPurchasesAsync: jest.fn(async () => [purchase(), purchase({
        paymentID: "payment-2", purchaseToken: "purchase-token-2", signedRequest: "signature.payload-2",
      })]),
      consumePurchaseAsync: jest.fn(async (token: string) => { events.push(`consume:${token}`); }),
    };
    const grant = jest.fn(async ({signedRequest}: {signedRequest: string}) => {
      events.push(`grant:${signedRequest}`);
      return {granted: true as const, providerReceiptId: `receipt-${events.length}`, consume: true};
    });
    await expect(new FacebookPurchaseRecovery(payments, grant).recover()).resolves.toEqual({
      status: "success", value: undefined,
    });
    expect(events).toEqual([
      "grant:signature.payload",
      "consume:purchase-token-1",
      "grant:signature.payload-2",
      "consume:purchase-token-2",
    ]);
  });

  test("never consumes when authoritative grant fails or returns an invalid boundary", async () => {
    const consumePurchaseAsync = jest.fn(async () => undefined);
    const payments = {getPurchasesAsync: async () => [purchase()], consumePurchaseAsync};
    await expect(new FacebookPurchaseRecovery(payments, async () => {
      throw new Error("verifier-offline");
    }).recover()).resolves.toEqual({status: "retryable-failure", message: "verifier-offline"});
    expect(consumePurchaseAsync).not.toHaveBeenCalled();
    await expect(new FacebookPurchaseRecovery(payments, async () => ({
      granted: true, providerReceiptId: "", consume: true,
    })).recover()).resolves.toEqual({status: "terminal-failure", message: "facebook-purchase-grant-invalid"});
    expect(consumePurchaseAsync).not.toHaveBeenCalled();
  });

  test("retries an interrupted post-grant consumption through the idempotent verifier", async () => {
    let consumeAttempts = 0;
    const payments = {
      getPurchasesAsync: async () => [purchase()],
      consumePurchaseAsync: async () => {
        consumeAttempts += 1;
        if (consumeAttempts === 1) throw new Error("consume-interrupted");
      },
    };
    const grant = jest.fn(async () => ({granted: true as const, providerReceiptId: "receipt-1", consume: true}));
    const recovery = new FacebookPurchaseRecovery(payments, grant);
    await expect(recovery.recover()).resolves.toEqual({
      status: "retryable-failure", message: "consume-interrupted",
    });
    await expect(recovery.recover()).resolves.toEqual({status: "success", value: undefined});
    expect(grant).toHaveBeenCalledTimes(2);
    expect(consumeAttempts).toBe(2);
  });

  test("coalesces concurrent startup and resume recovery calls", async () => {
    let releasePurchases: (() => void) | undefined;
    const purchasesReady = new Promise<void>((resolve) => { releasePurchases = resolve; });
    const payments = {
      getPurchasesAsync: jest.fn(async () => {
        await purchasesReady;
        return [purchase()];
      }),
      consumePurchaseAsync: jest.fn(async () => undefined),
    };
    const grant = jest.fn(async () => ({granted: true as const, providerReceiptId: "receipt-1", consume: true}));
    const recovery = new FacebookPurchaseRecovery(payments, grant);

    const startup = recovery.recover();
    const resume = recovery.recover();
    releasePurchases?.();

    await expect(Promise.all([startup, resume])).resolves.toEqual([
      {status: "success", value: undefined},
      {status: "success", value: undefined},
    ]);
    expect(payments.getPurchasesAsync).toHaveBeenCalledTimes(1);
    expect(grant).toHaveBeenCalledTimes(1);
    expect(payments.consumePurchaseAsync).toHaveBeenCalledTimes(1);
  });

  test("does not consume a server-classified durable purchase", async () => {
    const payments = {
      getCatalogAsync: jest.fn(),
      purchaseAsync: jest.fn(),
      getPurchasesAsync: jest.fn(async () => [purchase()]),
      consumePurchaseAsync: jest.fn(async () => undefined),
    };
    const recovery = new FacebookPurchaseRecovery(payments, async () => ({
      granted: true, providerReceiptId: "receipt-durable", consume: false,
    }));

    await expect(recovery.recover()).resolves.toEqual({status: "success", value: undefined});
    expect(payments.consumePurchaseAsync).not.toHaveBeenCalled();
  });

  test.each([
    null,
    {},
    Array.from({length: 101}, () => purchase()),
    [purchase({isConsumed: true})],
    [purchase({paymentActionType: "refund"})],
    [purchase({signedRequest: ""})],
    [purchase({purchaseTime: "not-a-time"})],
    [purchase({rawPlayerId: "forbidden-extra-field"})],
    [purchase(), purchase()],
  ])("rejects malformed or unsafe unconsumed purchase responses", (value) => {
    expect(() => parseFacebookUnconsumedPurchases(value)).toThrow();
  });
});
