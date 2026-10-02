import type {CallableRequest, CallableResponse} from "firebase-functions/v2/https";

/** Provides mock stream behavior. */
const mockStream = jest.fn(), mockUpdate = jest.fn(), mockAccess = jest.fn();
/** Provides mock lease behavior. */
const mockLease = jest.fn(async (_user: string, _timeout: number, operation: () => Promise<unknown>) => operation());
jest.mock("../../race/raceLiveStream", () => ({streamLiveRaceChanges: mockStream}));
jest.mock("../../race/raceLiveService", () => ({updateLiveRaceForUser: mockUpdate, joinLiveRaceForUser: jest.fn()}));
jest.mock("../../race/raceRollout", () => ({assertRaceAccess: mockAccess}));
jest.mock("../../shared/firebaseAdmin", () => ({admin: {firestore: () => ({name: "server-db"})}}));
jest.mock("../../shared/sentry", () => ({captureException: jest.fn(), flushSentry: jest.fn()}));
jest.mock("../../jest/jestAccountDeletion", () => ({runWithJestAccountOperationLease: mockLease, isJestAccountDeletedError: () => false}));
jest.mock("firebase-functions/v2/https", () => ({...jest.requireActual("firebase-functions/v2/https"),
  onCall: jest.fn((_options, handler) => handler)}));
import {updateLiveRace} from "../../race/raceLiveCallables";
/** Provides handler behavior. */
const handler = updateLiveRace as unknown as (request: CallableRequest<unknown>, response?: CallableResponse) => Promise<unknown>;
/** Provides input behavior. */
const input = {ticketId: "a".repeat(64), action: "poll", requestId: "owned-stream-request"};
beforeEach(() => jest.clearAllMocks());

it("authorizes a read-only stream without admitting scoring or acquiring a mutation lease", async () => {
  /** Provides response behavior. */
  const response = {sendChunk: jest.fn(), signal: new AbortController().signal};
  await expect(handler({auth: {uid: "owner"}, data: input, acceptsStreaming: true} as never, response)).resolves.toBeNull();
  expect(mockAccess).toHaveBeenCalledWith("owner");
  expect(mockStream).toHaveBeenCalledWith({name: "server-db"}, "owner", input.ticketId, response);
  expect(mockUpdate).not.toHaveBeenCalled(); expect(mockLease).not.toHaveBeenCalled();
});

it.each(["guess", "hint", "skip", "leave"])("rejects streaming %s commands before a mutation", async action => {
  await expect(handler({auth: {uid: "owner"}, acceptsStreaming: true,
    data: {...input, action, guess: "piano", riddleId: "q0"}} as never, {sendChunk: jest.fn(), signal: new AbortController().signal}))
    .rejects.toMatchObject({code: "invalid-argument"});
  expect(mockStream).not.toHaveBeenCalled(); expect(mockUpdate).not.toHaveBeenCalled();
});

it("rejects unauthenticated subscriptions and unavailable rollout access", async () => {
  await expect(handler({data: input, acceptsStreaming: true} as never)).rejects.toMatchObject({code: "unauthenticated"});
  mockAccess.mockRejectedValueOnce(new Error("disabled"));
  await expect(handler({auth: {uid: "owner"}, data: input, acceptsStreaming: true} as never,
    {sendChunk: jest.fn(), signal: new AbortController().signal})).rejects.toThrow("disabled");
  expect(mockStream).not.toHaveBeenCalled();
});

it("keeps ordinary progress reads under the existing mutation lease", async () => {
  // Deliberately reject inside authority; lease admission precedes its domain processing.
  mockUpdate.mockRejectedValueOnce(new Error("domain-authority"));
  await expect(handler({auth: {uid: "owner"}, data: input, acceptsStreaming: false} as never)).rejects.toThrow("domain-authority");
  expect(mockLease).toHaveBeenCalledWith("owner", 60, expect.any(Function));
  expect(mockStream).not.toHaveBeenCalled();
});
