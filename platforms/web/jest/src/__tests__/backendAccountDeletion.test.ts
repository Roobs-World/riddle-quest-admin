import {JestBackendClient} from "../backend";
import {parsePayloadEnvelope, protectPayload, readProtectedPayload} from "../../../../../src/platform/transport/payloadProtection";

const originalLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
beforeEach(() => {
  Object.defineProperty(globalThis, "location", {configurable: true, value: {origin: "https://game.example", protocol: "https:"}});
});
afterEach(() => {
  jest.restoreAllMocks();
  if (originalLocation) Object.defineProperty(globalThis, "location", originalLocation);
  else delete (globalThis as Record<string, unknown>).location;
});

it("binds a fresh start and subsequent grants to the replacement account while retrying only the deleted uid", async () => {
  const requests: Array<{operation: string; body: unknown}> = [];
  jest.spyOn(globalThis, "fetch").mockImplementation(async (input, options) => {
    const operation = new URL(String(input)).pathname.split("/").at(-1)!;
    const envelope = parsePayloadEnvelope(JSON.parse(String(options?.body)));
    const context = {operation, requestId: envelope.requestId};
    requests.push({operation, body: await readProtectedPayload(envelope, {...context, direction: "request"})});
    const response = operation === "exchangeJestIdentity"
      ? {customToken: "token", uid: "fresh-uid", accountGeneration: 2, freshAccount: true}
      : operation === "retryJestAccountDeletion"
        ? {accountDeleted: true, deletedUid: "retired-uid", activeAccountUid: "fresh-uid"}
        : {granted: false, purchaseToken: "purchase", coinsAwarded: 0, newCoins: 0};
    return new Response(JSON.stringify(await protectPayload(response, {...context, direction: "response"})));
  });
  const backend = new JestBackendClient("https://game.example/functions");
  await expect(backend.exchangeIdentity("signed", true, "retired-uid")).resolves.toEqual({
    status: "success", customToken: "token", uid: "fresh-uid", accountGeneration: 2, freshAccount: true,
  });
  await expect(backend.retryAccountDeletion("signed", "retired-uid")).resolves.toEqual({
    accountDeleted: true, deletedUid: "retired-uid", activeAccountUid: "fresh-uid",
  });
  await backend.grantPurchase("receipt", "player", "purchase");
  expect(requests).toEqual([
    {operation: "exchangeJestIdentity", body: {playerSigned: "signed", freshStart: true, deletedUid: "retired-uid"}},
    {operation: "retryJestAccountDeletion", body: {playerSigned: "signed", deletedUid: "retired-uid"}},
    {operation: "grantJestPurchase", body: {purchaseSigned: "receipt", playerId: "player", purchaseToken: "purchase", accountUid: "fresh-uid"}},
  ]);
});

it("returns a deleted uid from a protected tombstone without creating a replacement", async () => {
  jest.spyOn(globalThis, "fetch").mockImplementation(async (_input, options) => {
    const envelope = parsePayloadEnvelope(JSON.parse(String(options?.body)));
    return new Response(JSON.stringify(await protectPayload({error: "account-deleted", deletedUid: "retired-uid"}, {
      operation: "exchangeJestIdentity", requestId: envelope.requestId, direction: "response",
    })), {status: 409});
  });
  await expect(new JestBackendClient("https://game.example/functions").exchangeIdentity("signed")).resolves.toEqual({
    status: "account-deleted", deletedUid: "retired-uid",
  });
});
