import {createHash} from "node:crypto";

/** Provides mock delete account for user behavior. */
const mockDeleteAccountForUser = jest.fn();
/** Defines the delete field value. */
const DELETE_FIELD = Symbol("delete-field");
/** Defines the app id value. */
const APP_ID = "meta-app-1";
/** Defines the player id value. */
const PLAYER_ID = "meta-player-1";
/** Defines the uid secret value. */
const UID_SECRET = Buffer.alloc(32, 7).toString("base64");
/** Defines the provider id value. */
const PROVIDER_ID = createHash("sha256").update(`${APP_ID}\0${PLAYER_ID}`).digest("hex");
/** Provides provider ref behavior. */
const providerRef = {path: `providerIdentities/${PROVIDER_ID}`, id: PROVIDER_ID};
/** Provides provider behavior. */
let provider: Record<string, unknown>;

/** Provides snapshot behavior. */
const snapshot = () => ({
  exists: true,
  data: () => ({...provider}),
});
/** Provides mock update behavior. */
const mockUpdate = jest.fn((_ref: unknown, update: Record<string, unknown>) => {
  Object.entries(update).forEach(([key, value]) => {
    if (value === DELETE_FIELD) delete provider[key];
    else provider[key] = value;
  });
});
/** Provides transaction behavior. */
const transaction = {get: jest.fn(async () => snapshot()), update: mockUpdate};
/** Provides mock run transaction behavior. */
const mockRunTransaction = jest.fn(async (callback: (value: typeof transaction) => Promise<unknown>) =>
  callback(transaction),
);
/** Provides query snapshot behavior. */
const querySnapshot = (field: string, value: unknown) => {
  /** Provides matches behavior. */
  const matches = provider[field] === value;
  return {size: matches ? 1 : 0, docs: matches ? [{ref: providerRef, data: () => ({...provider})}] : []};
};

jest.mock("../profile/accountDeletion/deleteAccountData", () => ({deleteAccountForUser: mockDeleteAccountForUser}));
jest.mock("../shared/firebaseAdmin", () => ({
  admin: {
    firestore: Object.assign(
      () => ({
        collection: () => ({
          where: (field: string, _operator: string, value: unknown) => ({
            limit: () => ({
              get: async () => querySnapshot(field, value),
            }),
          }),
        }),
        runTransaction: mockRunTransaction,
      }),
      {
        FieldValue: {
          serverTimestamp: () => "server-timestamp",
          delete: () => DELETE_FIELD,
        },
      },
    ),
  },
}));

import {deleteFacebookAccountGeneration} from "../facebook/facebookAccountDeletion";
import {facebookFirebaseUid, MAX_FACEBOOK_ACCOUNT_GENERATION} from "../facebook/facebookSecurity";

/** Provides uid behavior. */
const uid = facebookFirebaseUid(PLAYER_ID, UID_SECRET, 1);
/** Deletes generation. */
const deleteGeneration = (identity: {
  /** Stores uid. */
  uid: string; /** Stores account generation. */
  /** Stores account generation. */
  accountGeneration: number;
}) => deleteFacebookAccountGeneration(identity, {uidSecret: UID_SECRET});

describe("Facebook account generations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    provider = {
      provider: "facebook",
      appId: APP_ID,
      providerPlayerId: PLAYER_ID,
      uid,
      accountGeneration: 1,
      status: "active",
    };
    mockDeleteAccountForUser.mockResolvedValue(undefined);
  });

  it("quiesces the current identity, deletes it, and advances to a blank generation", async () => {
    await expect(deleteGeneration({uid, accountGeneration: 1})).resolves.toBe(2);
    expect(mockDeleteAccountForUser).toHaveBeenCalledWith(uid);
    expect(provider).toMatchObject({
      provider: "facebook",
      providerPlayerId: "meta-player-1",
      uid: null,
      accountGeneration: 2,
      status: "active",
      lastDeletedAt: "server-timestamp",
      lastDeletedUidHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(provider).not.toHaveProperty("deletionStartedAt");
  });

  it("retains a fail-closed deleting state and can retry the same generation", async () => {
    mockDeleteAccountForUser.mockRejectedValueOnce(new Error("storage-unavailable"));
    await expect(deleteGeneration({uid, accountGeneration: 1})).rejects.toThrow("storage-unavailable");
    expect(provider).toMatchObject({uid, accountGeneration: 1, status: "deleting"});

    await expect(deleteGeneration({uid, accountGeneration: 1})).resolves.toBe(2);
    expect(mockDeleteAccountForUser).toHaveBeenCalledTimes(2);
    expect(provider).toMatchObject({uid: null, accountGeneration: 2, status: "active"});
  });

  it("treats a lost-response retry after generation advancement as complete", async () => {
    await expect(deleteGeneration({uid, accountGeneration: 1})).resolves.toBe(2);
    mockDeleteAccountForUser.mockClear();

    await expect(deleteGeneration({uid, accountGeneration: 1})).resolves.toBe(2);

    expect(mockDeleteAccountForUser).not.toHaveBeenCalled();
    expect(provider).toMatchObject({uid: null, accountGeneration: 2, status: "active"});
  });

  it("never deletes a fresh generation while completing an old-generation retry", async () => {
    await expect(deleteGeneration({uid, accountGeneration: 1})).resolves.toBe(2);
    /** Provides fresh uid behavior. */
    const freshUid = facebookFirebaseUid(PLAYER_ID, UID_SECRET, 2);
    provider.uid = freshUid;
    mockDeleteAccountForUser.mockClear();

    await expect(deleteGeneration({uid, accountGeneration: 1})).resolves.toBe(2);

    expect(mockDeleteAccountForUser).not.toHaveBeenCalled();
    expect(provider).toMatchObject({uid: freshUid, accountGeneration: 2, status: "active"});
  });

  it("rejects a stale generation before deleting any data", async () => {
    await expect(deleteGeneration({uid, accountGeneration: 2})).rejects.toThrow("facebook-provider-identity-conflict");
    expect(mockDeleteAccountForUser).not.toHaveBeenCalled();
  });

  it("deletes the maximum generation into a terminal state and keeps retries idempotent", async () => {
    /** Provides maximum uid behavior. */
    const maximumUid = facebookFirebaseUid(PLAYER_ID, UID_SECRET, MAX_FACEBOOK_ACCOUNT_GENERATION);
    provider.uid = maximumUid;
    provider.accountGeneration = MAX_FACEBOOK_ACCOUNT_GENERATION;
    await expect(
      deleteGeneration({
        uid: maximumUid,
        accountGeneration: MAX_FACEBOOK_ACCOUNT_GENERATION,
      }),
    ).resolves.toBe(MAX_FACEBOOK_ACCOUNT_GENERATION);
    expect(provider).toMatchObject({
      uid: null,
      accountGeneration: MAX_FACEBOOK_ACCOUNT_GENERATION,
      status: "exhausted",
    });
    mockDeleteAccountForUser.mockClear();
    await expect(
      deleteGeneration({
        uid: maximumUid,
        accountGeneration: MAX_FACEBOOK_ACCOUNT_GENERATION,
      }),
    ).resolves.toBe(MAX_FACEBOOK_ACCOUNT_GENERATION);
    expect(mockDeleteAccountForUser).not.toHaveBeenCalled();
  });

  it("rejects a provider document whose app/player scope or deterministic UID is inconsistent", async () => {
    provider.appId = "different-app";
    await expect(deleteGeneration({uid, accountGeneration: 1})).rejects.toThrow("facebook-provider-identity-conflict");
    expect(mockDeleteAccountForUser).not.toHaveBeenCalled();

    provider.appId = APP_ID;
    provider.providerPlayerId = "different-player";
    await expect(deleteGeneration({uid, accountGeneration: 1})).rejects.toThrow("facebook-provider-identity-conflict");
    expect(mockDeleteAccountForUser).not.toHaveBeenCalled();
  });
});
