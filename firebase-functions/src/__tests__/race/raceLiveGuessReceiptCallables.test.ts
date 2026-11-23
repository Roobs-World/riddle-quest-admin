import type {CallableRequest} from "firebase-functions/v2/https";

/** Preserve the real validation and authentication wrapper while observing mutation-lease admission. */
const mockConfirm = jest.fn(), mockLease = jest.fn();
jest.mock("../../race/live/raceLiveGuessReceipt", () => ({confirmLiveGuessReceiptForUser: mockConfirm}));
jest.mock("../../shared/sentry", () => ({captureException: jest.fn(), flushSentry: jest.fn()}));
jest.mock("../../shared/accountDeletion", () => ({...jest.requireActual("../../shared/accountDeletion"), runWithJestAccountOperationLease: mockLease}));
jest.mock("firebase-functions/v2/https", () => ({...jest.requireActual("firebase-functions/v2/https"), onCall: jest.fn((options, handler) => Object.assign(handler, {deploymentOptions: options}))}));
import {confirmLiveGuessReceipt} from "../../race/api/raceLiveCallables";
/** Verified identity is absent from the historical request locator. */
const OWNER = `jest_${"a".repeat(40)}`, input = {ticketId: "a".repeat(64), requestId: "original-guess-001", riddleId: "riddle-1", position: 0, guessesUsedBefore: 0};
/** Actual wrapped callable callback uses the established onCall test seam. */
const handler = confirmLiveGuessReceipt as unknown as (request: CallableRequest<unknown>) => Promise<unknown>;
beforeEach(() => {jest.clearAllMocks(); mockConfirm.mockResolvedValue({status: "accepted"});});
it("dispatches the verified actor without a mutation lease", async () => {
  await expect(handler({auth: {uid: OWNER}, data: input} as never)).resolves.toEqual({status: "accepted"});
  expect(mockConfirm).toHaveBeenCalledWith(OWNER, input);
  expect(mockLease).not.toHaveBeenCalled();
});
it("rejects unauthenticated lookup before reading domain authority", async () => {
  await expect(handler({data: input} as never)).rejects.toMatchObject({code: "unauthenticated"});
  expect(mockConfirm).not.toHaveBeenCalled();
});
it.each([{...input, requestId: "x"}, {...input, userId: OWNER}, {...input, guess: "word"}, {...input, action: "guess"}, {...input, guessesUsedBefore: 4}])("rejects malformed locators or command selectors: %p", async data => {
  await expect(handler({auth: {uid: OWNER}, data} as never)).rejects.toMatchObject({code: "invalid-argument"});
  expect(mockConfirm).not.toHaveBeenCalled();
  expect(mockLease).not.toHaveBeenCalled();
});
it("validates the private acknowledgement before returning it", async () => {
  mockConfirm.mockResolvedValueOnce({status: "unconfirmed"});
  await expect(handler({auth: {uid: OWNER}, data: input} as never)).resolves.toEqual({status: "unconfirmed"});
  mockConfirm.mockResolvedValueOnce({status: "accepted", guess: "answer"});
  await expect(handler({auth: {uid: OWNER}, data: input} as never)).rejects.toMatchObject({code: "internal"});
});
