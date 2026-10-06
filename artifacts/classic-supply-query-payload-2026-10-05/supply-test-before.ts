/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import {beforeEach, describe, expect, it, jest} from "@jest/globals";

/** Provides mock get behavior. */
const mockGet = jest.fn();
/** Provides mock create behavior. */
const mockCreate = jest.fn();
/** Provides mock delete behavior. */
const mockDelete = jest.fn();
/** Provides mock generate for locale behavior. */
const mockGenerateForLocale = jest.fn();
/** Provides mock limit behavior. */
const mockLimit = jest.fn();
/** Provides mock order by behavior. */
const mockOrderBy = jest.fn();
/** Provides mock where behavior. */
const mockWhere = jest.fn();
/** Provides mock doc behavior. */
const mockDoc = jest.fn();
/** Provides mock collection behavior. */
const mockCollection = jest.fn();
/** Provides mock capture exception behavior. */
const mockCaptureException = jest.fn();

/** Provides query behavior. */
const query = {
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  get: mockGet,
};

mockWhere.mockReturnValue(query);
mockOrderBy.mockReturnValue(query);
mockLimit.mockReturnValue(query);

jest.mock("../shared/firebaseAdmin", () => ({
  admin: {
    firestore: Object.assign(() => ({collection: mockCollection}), {
      FieldValue: {serverTimestamp: jest.fn(() => "server-time")},
    }),
  },
}));

jest.mock("../riddles/riddleGeneration", () => ({
  generateLocalizedClassicRiddlesForLocale: mockGenerateForLocale,
}));

jest.mock("firebase-functions", () => ({
  logger: {info: jest.fn(), error: jest.fn()},
}));

jest.mock("../shared/sentry", () => ({captureException: mockCaptureException}));

import {triggerClassicRiddleGenerationIfNeeded} from "../riddles/riddleSupply";

describe("riddle supply", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWhere.mockReturnValue(query);
    mockOrderBy.mockReturnValue(query);
    mockLimit.mockReturnValue(query);
    mockDoc.mockReturnValue({create: mockCreate, delete: mockDelete});
    mockCollection.mockImplementation((path: string) => (path === "classicSupplyJobs" ? {doc: mockDoc} : query));
    mockCreate.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue(undefined);
    mockGenerateForLocale.mockResolvedValue(undefined);
  });

  it("reads only the highest classic index when supply is healthy", async () => {
    mockGet.mockResolvedValue({empty: false, docs: [{data: () => ({classicIndex: 200})}]});

    await triggerClassicRiddleGenerationIfNeeded("player-1", 10, "en");

    expect(mockOrderBy).toHaveBeenCalledWith("classicIndex", "desc");
    expect(mockLimit).toHaveBeenCalledWith(1);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockGenerateForLocale).not.toHaveBeenCalled();
  });

  it("does not hold gameplay completion open while the model is generating", async () => {
    mockGet.mockResolvedValue({empty: false, docs: [{data: () => ({classicIndex: 20})}]});
    /** Provides release generation behavior. */
    let releaseGeneration: () => void;
    /** Provides model pending behavior. */
    const modelPending = new Promise<void>((resolve) => { releaseGeneration = resolve; });
    mockGenerateForLocale.mockReturnValue(modelPending);
    /** Provides completion behavior. */
    const completion = triggerClassicRiddleGenerationIfNeeded("player-1", 21, "ar");
    /** Provides outcome behavior. */
    const outcome = await Promise.race([
      completion.then(() => "returned"),
      new Promise<string>((resolve) => setTimeout(() => resolve("model-blocked"), 100)),
    ]);
    releaseGeneration!();
    await completion;
    expect(outcome).toBe("returned");
  });

  it("durably queues a low locale without invoking generation", async () => {
    mockGet.mockResolvedValue({empty: false, docs: [{data: () => ({classicIndex: 11})}]});

    await triggerClassicRiddleGenerationIfNeeded("player-1", 10, "fr");

    expect(mockDoc).toHaveBeenCalledWith("fr_11");
    expect(mockCreate).toHaveBeenCalledWith({locale: "fr", highestClassicIndex: 11, requestedAt: "server-time", nextAttemptAtMs: 0});
    expect(mockGenerateForLocale).not.toHaveBeenCalled();
  });

  it("does not duplicate generation when another request owns the claim", async () => {
    mockGet.mockResolvedValue({empty: false, docs: [{data: () => ({classicIndex: 11})}]});
    mockCreate.mockRejectedValue(Object.assign(new Error("already exists"), {code: 6}));

    await triggerClassicRiddleGenerationIfNeeded("player-2", 10, "fr");

    expect(mockGenerateForLocale).not.toHaveBeenCalled();
  });

  it.each(["already-exists", "6"])("recognizes the %s already-exists code", async (code) => {
    mockGet.mockResolvedValue({empty: true, docs: []});
    mockCreate.mockRejectedValue(Object.assign(new Error("already exists"), {code}));

    await triggerClassicRiddleGenerationIfNeeded("player-2", 0, "fr");

    expect(mockDoc).toHaveBeenCalledWith("fr_-1");
    expect(mockGenerateForLocale).not.toHaveBeenCalled();
  });

  it.each([null, "network failure", {code: "permission-denied"}])(
    "reports a non-contention claim failure %#",
    async (failure) => {
      mockGet.mockResolvedValue({empty: false, docs: []});
      mockCreate.mockRejectedValue(failure);

      await triggerClassicRiddleGenerationIfNeeded("player-2", 0, "fr");

      expect(mockCaptureException).toHaveBeenCalledWith(failure);
      expect(mockGenerateForLocale).not.toHaveBeenCalled();
    },
  );

  it("reports a failed highest-index query", async () => {
    /** Provides query error behavior. */
    const queryError = new Error("query failed");
    mockGet.mockRejectedValue(queryError);

    await triggerClassicRiddleGenerationIfNeeded("player-1", 0, "fr");

    expect(mockCaptureException).toHaveBeenCalledWith(queryError);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
