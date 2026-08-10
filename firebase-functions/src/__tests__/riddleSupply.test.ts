/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import {beforeEach, describe, expect, it, jest} from "@jest/globals";

const mockGet = jest.fn();
const mockCreate = jest.fn();
const mockDelete = jest.fn();
const mockGenerateForLocale = jest.fn();
const mockLimit = jest.fn();
const mockOrderBy = jest.fn();
const mockWhere = jest.fn();
const mockDoc = jest.fn();
const mockCollection = jest.fn();
const mockCaptureException = jest.fn();

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
    mockCollection.mockImplementation((path: string) => (path === "riddleSupplyRequests" ? {doc: mockDoc} : query));
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

  it("claims and replenishes a low locale exactly once", async () => {
    mockGet.mockResolvedValue({empty: false, docs: [{data: () => ({classicIndex: 11})}]});

    await triggerClassicRiddleGenerationIfNeeded("player-1", 10, "fr");

    expect(mockDoc).toHaveBeenCalledWith("fr_11");
    expect(mockCreate).toHaveBeenCalledWith({locale: "fr", highestClassicIndex: 11, requestedAt: "server-time"});
    expect(mockGenerateForLocale).toHaveBeenCalledTimes(1);
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

  it("releases the claim after failed generation so a later request can retry", async () => {
    mockGet.mockResolvedValue({empty: false, docs: [{data: () => ({classicIndex: 11})}]});
    mockGenerateForLocale.mockRejectedValue(new Error("generation failed"));

    await triggerClassicRiddleGenerationIfNeeded("player-1", 10, "fr");

    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it("reports a failed claim cleanup", async () => {
    const generationError = new Error("generation failed");
    const cleanupError = new Error("cleanup failed");
    mockGet.mockResolvedValue({empty: false, docs: [{data: () => ({classicIndex: undefined})}]});
    mockGenerateForLocale.mockRejectedValue(generationError);
    mockDelete.mockRejectedValue(cleanupError);

    await triggerClassicRiddleGenerationIfNeeded("player-1", 0, "fr");

    expect(mockCaptureException).toHaveBeenCalledWith(cleanupError);
    expect(mockCaptureException).toHaveBeenCalledWith(generationError);
  });

  it("reports a failed highest-index query", async () => {
    const queryError = new Error("query failed");
    mockGet.mockRejectedValue(queryError);

    await triggerClassicRiddleGenerationIfNeeded("player-1", 0, "fr");

    expect(mockCaptureException).toHaveBeenCalledWith(queryError);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
