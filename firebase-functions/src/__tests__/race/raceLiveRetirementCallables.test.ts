import type {CallableRequest} from "firebase-functions/v2/https";

/** Wrapped callable tests isolate only domain authority, preserving schema, identity and lease behavior. */
const mockRetire = jest.fn(), mockAccess = jest.fn(), mockLease = jest.fn(async (_owner: string, _timeout: number, operation: () => Promise<unknown>) => operation());
jest.mock("../../race/live/raceLiveRetirement", () => ({retireLiveRaceJoinForUser: mockRetire}));
jest.mock("../../race/access/raceRollout", () => ({assertRaceAccess: mockAccess}));
jest.mock("../../shared/sentry", () => ({captureException: jest.fn(), flushSentry: jest.fn()}));
jest.mock("../../shared/accountDeletion", () => ({...jest.requireActual("../../shared/accountDeletion"), runWithAccountOperationLease: mockLease}));
jest.mock("firebase-functions/v2/https", () => ({...jest.requireActual("firebase-functions/v2/https"), onCall: jest.fn((options, handler) => Object.assign(handler, {deploymentOptions: options}))}));
import {retireLiveRaceJoin} from "../../race/api/raceLiveCallables";
/** Canonical verified identity remains distinct from all untrusted request fields. */
const OWNER = `facebook_${"a".repeat(40)}`, input = {requestId: "original-join-request", expectedOwnerId: OWNER};
/** Actual onCall wrapper exposes its callback in the established unit seam. */
const handler = retireLiveRaceJoin as unknown as (request: CallableRequest<unknown>) => Promise<unknown>;
beforeEach(() => {jest.clearAllMocks(); mockRetire.mockResolvedValue({status: "retired"});});
it("dispatches only the verified actor and keeps existing account-operation admission", async () => {
  await expect(handler({auth: {uid: OWNER}, data: input} as never)).resolves.toEqual({status: "retired"});
  expect(mockRetire).toHaveBeenCalledWith(OWNER, input, {authorize: expect.any(Function)});
  expect(mockLease).toHaveBeenCalledWith(OWNER, 60, expect.any(Function));
});
it("rejects unauthenticated retirement before domain authority", async () => {
  await expect(handler({data: input} as never)).rejects.toMatchObject({code: "unauthenticated"}); expect(mockRetire).not.toHaveBeenCalled();
});
it.each([{requestId: "x"}, {...input, ticketId: "a".repeat(64)}, {...input, userId: OWNER}, {...input, coins: 50}])("rejects malformed or extra authority fields: %p", data => {
  return expect(handler({auth: {uid: OWNER}, data} as never)).rejects.toMatchObject({code: "invalid-argument"});
});
it("supplies fresh rollout authorization inside the authority operation", async () => {
  mockAccess.mockRejectedValueOnce(new Error("rollout-disabled")); mockRetire.mockImplementationOnce(async (_owner, _input, options) => {await options.authorize(); return {status: "retired"};});
  await expect(handler({auth: {uid: OWNER}, data: input} as never)).rejects.toThrow("rollout-disabled"); expect(mockAccess).toHaveBeenCalledWith(OWNER);
});
it("validates superseded acknowledgement without exposing ticket or economy facts", async () => {
  mockRetire.mockResolvedValueOnce({status: "superseded"}); await expect(handler({auth: {uid: OWNER}, data: input} as never)).resolves.toEqual({status: "superseded"});
  mockRetire.mockResolvedValueOnce({status: "retired", ticketId: "a".repeat(64)}); await expect(handler({auth: {uid: OWNER}, data: input} as never)).rejects.toMatchObject({code: "internal"});
});
