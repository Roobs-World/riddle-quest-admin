import {describe, expect, jest, test} from "@jest/globals";
import {FacebookPurchaseRecovery, parseFacebookUnconsumedPurchases, type FacebookSignedPurchaseGrant} from "../FacebookPurchaseRecovery";

/** Provides purchase behavior. */
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
  test.each([1787220000, "1787220000"])("normalizes Meta Unix-second purchase times %p", (purchaseTime) => {
    expect(parseFacebookUnconsumedPurchases([purchase({purchaseTime})])[0].purchaseTime).toBe(1787220000);
  });

  test.each([0, -1, 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "0", "-1", "1.5", "1e9", " ", true, null])(
    "rejects invalid Meta purchase time %p before granting or consuming", (purchaseTime) => {
      expect(() => parseFacebookUnconsumedPurchases([purchase({purchaseTime})])).toThrow("facebook-purchase-invalid");
    },
  );
  test("recovers receipts with Meta's deprecated null developerPayload", async () => {
    /** Provider fixture returns the documented nullable legacy field. */
    const payments = {
      getPurchasesAsync: jest.fn(async () => [purchase({developerPayload: null})]),
      consumePurchaseAsync: jest.fn(async () => undefined),
    };
    /** Records the authoritative grant before consumption. */
    const grant = jest.fn(async () => ({granted: true as const, providerReceiptId: "receipt-1", consume: true}));
    await expect(new FacebookPurchaseRecovery(payments, grant).recover()).resolves.toEqual({
      status: "success",
      value: undefined,
    });
    expect(grant).toHaveBeenCalledWith({signedRequest: "signature.payload"});
    expect(payments.consumePurchaseAsync).toHaveBeenCalledWith("purchase-token-1");
  });

  test("grants each signed request before consuming its token", async () => {
    /** Provides events behavior. */
    const events: string[] = [];
    /** Provides payments behavior. */
    /** Provider fixture returns the documented nullable legacy field. */
    const payments = {
      getPurchasesAsync: jest.fn(async () => [
        purchase(),
        purchase({
          paymentID: "payment-2",
          purchaseToken: "purchase-token-2",
          signedRequest: "signature.payload-2",
        }),
      ]),
      consumePurchaseAsync: jest.fn(async (token: string) => {
        events.push(`consume:${token}`);
      }),
    };
    /** Provides grant behavior. */
    const grant = jest.fn(
      async ({
        signedRequest,
      }: {
        /** Stores signed request. */ /** Stores signed request. */ /** Stores signed request. */
        /** Stores signed request. */
        signedRequest: string;
      }) => {
        events.push(`grant:${signedRequest}`);
        return {granted: true as const, providerReceiptId: `receipt-${events.length}`, consume: true};
      },
    );
    await expect(new FacebookPurchaseRecovery(payments, grant).recover()).resolves.toEqual({
      status: "success",
      value: undefined,
    });
    expect(events).toEqual([
      "grant:signature.payload",
      "consume:purchase-token-1",
      "grant:signature.payload-2",
      "consume:purchase-token-2",
    ]);
  });

  test("never consumes when authoritative grant fails or returns an invalid boundary", async () => {
    /** Provides consume purchase async behavior. */
    const consumePurchaseAsync = jest.fn(async () => undefined);
    /** Provides payments behavior. */
    /** Provider fixture returns the documented nullable legacy field. */
    const payments = {getPurchasesAsync: async () => [purchase()], consumePurchaseAsync};
    await expect(
      new FacebookPurchaseRecovery(payments, async () => {
        throw new Error("verifier-offline");
      }).recover(),
    ).resolves.toEqual({status: "retryable-failure", message: "verifier-offline"});
    expect(consumePurchaseAsync).not.toHaveBeenCalled();
    await expect(
      new FacebookPurchaseRecovery(payments, async () => ({
        granted: true,
        providerReceiptId: "",
        consume: true,
      })).recover(),
    ).resolves.toEqual({status: "terminal-failure", message: "facebook-purchase-grant-invalid"});
    expect(consumePurchaseAsync).not.toHaveBeenCalled();
  });

  test("retries an interrupted post-grant consumption through the idempotent verifier", async () => {
    /** Provides consume attempts behavior. */
    let consumeAttempts = 0;
    /** Provides payments behavior. */
    /** Provider fixture returns the documented nullable legacy field. */
    const payments = {
      getPurchasesAsync: async () => [purchase()],
      consumePurchaseAsync: async () => {
        consumeAttempts += 1;
        if (consumeAttempts === 1) throw new Error("consume-interrupted");
      },
    };
    /** Provides grant behavior. */
    /** Records the authoritative grant before consumption. */
    const grant = jest.fn(async () => ({granted: true as const, providerReceiptId: "receipt-1", consume: true}));
    /** Provides recovery behavior. */
    const recovery = new FacebookPurchaseRecovery(payments, grant);
    await expect(recovery.recover()).resolves.toEqual({
      status: "retryable-failure",
      message: "consume-interrupted",
    });
    await expect(recovery.recover()).resolves.toEqual({status: "success", value: undefined});
    expect(grant).toHaveBeenCalledTimes(2);
    expect(consumeAttempts).toBe(2);
  });

  test("coalesces concurrent startup and resume recovery calls", async () => {
    /** Provides release purchases behavior. */
    let releasePurchases: (() => void) | undefined;
    /** Provides purchases ready behavior. */
    const purchasesReady = new Promise<void>((resolve) => {
      releasePurchases = resolve;
    });
    /** Provides payments behavior. */
    /** Provider fixture returns the documented nullable legacy field. */
    const payments = {
      getPurchasesAsync: jest.fn(async () => {
        await purchasesReady;
        return [purchase()];
      }),
      consumePurchaseAsync: jest.fn(async () => undefined),
    };
    /** Provides grant behavior. */
    /** Records the authoritative grant before consumption. */
    const grant = jest.fn(async () => ({granted: true as const, providerReceiptId: "receipt-1", consume: true}));
    /** Provides recovery behavior. */
    const recovery = new FacebookPurchaseRecovery(payments, grant);

    /** Starts up. */
    const startup = recovery.recover();
    /** Provides resume behavior. */
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
    /** Provides payments behavior. */
    /** Provider fixture returns the documented nullable legacy field. */
    const payments = {
      getCatalogAsync: jest.fn(),
      purchaseAsync: jest.fn(),
      getPurchasesAsync: jest.fn(async () => [purchase()]),
      consumePurchaseAsync: jest.fn(async () => undefined),
    };
    /** Provides recovery behavior. */
    const recovery = new FacebookPurchaseRecovery(payments, async () => ({
      granted: true,
      providerReceiptId: "receipt-durable",
      consume: false,
    }));

    await expect(recovery.recover()).resolves.toEqual({status: "success", value: undefined});
    expect(payments.consumePurchaseAsync).not.toHaveBeenCalled();
  });

  test("ignores SDK refunds and their matching charge while recovering another valid charge", async () => {
    /** Records actual fulfillment ordering across mixed SDK history. */
    const events: string[] = [];
    /** Keeps a charge and refund for the same provider token ahead of a valid charge. */
    const purchases = [purchase(), purchase({paymentActionType: "refund"}), purchase({
      paymentID: "payment-2", purchaseToken: "purchase-token-2", signedRequest: "signature.payload-2",
    })];
    /** Supplies SDK history without interpreting refund metadata as a grant. */
    const payments = {
      getPurchasesAsync: async () => purchases,
      consumePurchaseAsync: async (token: string) => {events.push(`consume:${token}`);},
    };
    /** Models the authoritative grant for the remaining valid charge. */
    const grant = jest.fn<FacebookSignedPurchaseGrant>(async input => {
      events.push(`grant:${input.signedRequest}`);
      return {granted: true, providerReceiptId: "receipt-2", consume: true};
    });
    await expect(new FacebookPurchaseRecovery(payments, grant).recover()).resolves.toEqual({status: "success", value: undefined});
    expect(events).toEqual(["grant:signature.payload-2", "consume:purchase-token-2"]);
    expect(grant).toHaveBeenCalledWith({signedRequest: "signature.payload-2"});
  });

  test("quarantines a server-rejected generation only in its owner session and recovers later charges", async () => {
    /** Preserves the old SDK receipt after account recreation. */
    const oldPurchase = purchase({paymentID: "old-payment", purchaseToken: "old-token", signedRequest: "old.signature"});
    /** Removes only a successfully consumed current-account charge from SDK history. */
    let pending = [oldPurchase, purchase()];
    /** Records all grant and completion attempts. */
    const events: string[] = [];
    /** Simulates Meta retaining the old receipt indefinitely. */
    const payments = {
      getPurchasesAsync: async () => pending,
      consumePurchaseAsync: async (token: string) => {
        events.push(`consume:${token}`);
        pending = pending.filter(item => item.purchaseToken !== token);
      },
    };
    /** Rejects the old generation through the server's permanent RPC category. */
    const grant = jest.fn<FacebookSignedPurchaseGrant>(async input => {
      events.push(`grant:${input.signedRequest}`);
      if (input.signedRequest === "old.signature") throw Object.assign(new Error("old-generation"), {code: "functions/failed-precondition"});
      return {granted: true, providerReceiptId: "receipt-1", consume: true};
    });
    /** Owns the quarantine for this account session. */
    const recovery = new FacebookPurchaseRecovery(payments, grant);
    await expect(recovery.recover()).resolves.toEqual({status: "success", value: undefined});
    await expect(recovery.recover()).resolves.toEqual({status: "success", value: undefined});
    expect(events).toEqual(["grant:old.signature", "grant:signature.payload", "consume:purchase-token-1"]);
    await expect(new FacebookPurchaseRecovery(payments, grant).recover()).resolves.toEqual({status: "success", value: undefined});
    expect(events).toEqual(["grant:old.signature", "grant:signature.payload", "consume:purchase-token-1", "grant:old.signature"]);
  });

  test.each([undefined, "functions/unavailable", "functions/unauthenticated", "functions/permission-denied", "failed-precondition"])(
    "blocks and retries unknown or recoverable grant failure %p before later receipts", async code => {
      /** Makes the next owner-session retry recover after a temporary outage. */
      let offline = true;
      /** Records exact server grant and consumption order. */
      const events: string[] = [];
      /** Supplies two distinct unconsumed charges. */
      const payments = {
        getPurchasesAsync: async () => [purchase(), purchase({paymentID: "payment-2", purchaseToken: "token-2", signedRequest: "signature-2"})],
        consumePurchaseAsync: async (token: string) => {events.push(`consume:${token}`);},
      };
      /** Keeps all categories except the proven permanent RPC rejection retryable. */
      const grant = jest.fn<FacebookSignedPurchaseGrant>(async input => {
        events.push(`grant:${input.signedRequest}`);
        if (offline) throw Object.assign(new Error("offline"), {code});
        return {granted: true, providerReceiptId: "receipt-1", consume: true};
      });
      /** Holds no quarantine for an unavailable or unclassified failure. */
      const recovery = new FacebookPurchaseRecovery(payments, grant);
      await expect(recovery.recover()).resolves.toEqual({status: "retryable-failure", message: "offline"});
      expect(events).toEqual(["grant:signature.payload"]);
      offline = false;
      await expect(recovery.recover()).resolves.toEqual({status: "success", value: undefined});
      expect(events).toEqual(["grant:signature.payload", "grant:signature.payload", "consume:purchase-token-1", "grant:signature-2", "consume:token-2"]);
    },
  );

  test.each(["get", "consume"])("does not quarantine a %s SDK failure even if its code resembles an RPC rejection", async stage => {
    /** Retries the identical receipt once the SDK call recovers. */
    let failed = false;
    /** Records that every successful consumption still follows a grant. */
    const events: string[] = [];
    /** Places the permanent-looking code outside the authoritative grant boundary. */
    const payments = {
      getPurchasesAsync: async () => {
        if (stage === "get" && !failed) {failed = true; throw Object.assign(new Error("sdk-offline"), {code: "functions/failed-precondition"});}
        return [purchase()];
      },
      consumePurchaseAsync: async (token: string) => {
        if (stage === "consume" && !failed) {failed = true; throw Object.assign(new Error("sdk-offline"), {code: "functions/failed-precondition"});}
        events.push(`consume:${token}`);
      },
    };
    /** Models an idempotent authoritative verifier across the SDK retry. */
    const grant = jest.fn<FacebookSignedPurchaseGrant>(async () => {
      events.push("grant");
      return {granted: true, providerReceiptId: "receipt-1", consume: true};
    });
    /** Reuses the same session so an incorrect quarantine would skip the retry. */
    const recovery = new FacebookPurchaseRecovery(payments, grant);
    await expect(recovery.recover()).resolves.toEqual({status: "retryable-failure", message: "sdk-offline"});
    await expect(recovery.recover()).resolves.toEqual({status: "success", value: undefined});
    expect(events).toEqual(stage === "get" ? ["grant", "consume:purchase-token-1"] : ["grant", "grant", "consume:purchase-token-1"]);
  });

  test("bounds session quarantine while rechecking evicted receipts through the server", async () => {
    /** Changes the single returned SDK receipt across this owner session. */
    let pending = purchase();
    /** Counts authoritative checks without granting any stale charge. */
    const grant = jest.fn<FacebookSignedPurchaseGrant>(async () => {
      throw Object.assign(new Error("old-generation"), {code: "functions/failed-precondition"});
    });
    /** Never authorizes consumption of a permanently rejected receipt. */
    const payments = {getPurchasesAsync: async () => [pending], consumePurchaseAsync: jest.fn(async () => undefined)};
    /** Retains at most the SDK's bounded pending-history count in memory. */
    const recovery = new FacebookPurchaseRecovery(payments, grant);
    for (let index = 0; index < 101; index += 1) {
      pending = purchase({paymentID: `payment-${index}`, purchaseToken: `token-${index}`, signedRequest: `signature-${index}`});
      await expect(recovery.recover()).resolves.toEqual({status: "success", value: undefined});
    }
    pending = purchase({paymentID: "payment-100", purchaseToken: "token-100", signedRequest: "signature-100"});
    await expect(recovery.recover()).resolves.toEqual({status: "success", value: undefined});
    expect(grant).toHaveBeenCalledTimes(101);
    pending = purchase({paymentID: "payment-0", purchaseToken: "token-0", signedRequest: "signature-0"});
    await expect(recovery.recover()).resolves.toEqual({status: "success", value: undefined});
    expect(grant).toHaveBeenCalledTimes(102);
    expect(grant).toHaveBeenLastCalledWith({signedRequest: "signature-0"});
    expect(payments.consumePurchaseAsync).not.toHaveBeenCalled();
  });

  test.each([
    {entries: [purchase({paymentActionType: "refund"}), purchase({signedRequest: ""})], message: "facebook-purchase-invalid"},
    {entries: [purchase({paymentActionType: "refund"}), purchase(), purchase()], message: "facebook-purchases-duplicate"},
  ])("retains malformed-charge and duplicate-charge guards beside refund history", ({entries, message}) => {
    expect(() => parseFacebookUnconsumedPurchases(entries)).toThrow(message);
  });

  test.each([
    null,
    {},
    Array.from({length: 101}, () => purchase()),
    [purchase({isConsumed: true})],
    [purchase({paymentActionType: "unknown"})],
    [purchase({signedRequest: ""})],
    [purchase({purchaseTime: "not-a-time"})],
    [purchase({rawPlayerId: "forbidden-extra-field"})],
    [purchase(), purchase()],
  ])("rejects malformed or unsafe unconsumed purchase responses", (value) => {
    expect(() => parseFacebookUnconsumedPurchases(value)).toThrow();
  });
});
