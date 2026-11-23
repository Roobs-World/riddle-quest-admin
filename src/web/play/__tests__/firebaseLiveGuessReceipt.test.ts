import {createFirebaseRaceMatchmaking} from "../firebaseRaceMatchmaking";

/** Isolate only the provider transport; production adapter validation stays active. */
const mockConfirm = jest.fn();
jest.mock("../../firebase", () => ({confirmLiveGuessReceipt: mockConfirm}));
/** Bounded historical locator has no submitted word or account selector. */
const input = {ticketId: "a".repeat(64), requestId: "original-guess-001", riddleId: "riddle-1", position: 0, guessesUsedBefore: 0};
beforeEach(() => {jest.clearAllMocks();});
it("loads no transport until lookup and observes later acceptance without caching the negative result", async () => {
  /** Existing normal play does not depend on the optional endpoint. */
  const adapter = createFirebaseRaceMatchmaking();
  expect(mockConfirm).not.toHaveBeenCalled();
  mockConfirm.mockResolvedValueOnce({data: {status: "unconfirmed"}}).mockResolvedValueOnce({data: {status: "accepted"}});
  await expect(adapter.live!.confirmGuessReceipt!(input)).resolves.toEqual({status: "unconfirmed"});
  await expect(adapter.live!.confirmGuessReceipt!(input)).resolves.toEqual({status: "accepted"});
  expect(mockConfirm).toHaveBeenCalledTimes(2);
  expect(mockConfirm).toHaveBeenLastCalledWith(input);
});
it("rejects extra command fields before transport", async () => {
  await expect(createFirebaseRaceMatchmaking().live!.confirmGuessReceipt!({...input, guess: "word"} as never)).rejects.toThrow();
  expect(mockConfirm).not.toHaveBeenCalled();
});
it("rejects malformed acknowledgements and preserves unavailable-endpoint failure for safe caller fallback", async () => {
  /** Optional recovery owns fallback, while the adapter rejects untrusted responses. */
  const live = createFirebaseRaceMatchmaking().live!;
  mockConfirm.mockResolvedValueOnce({data: {status: "accepted", guess: "answer"}});
  await expect(live.confirmGuessReceipt!(input)).rejects.toThrow();
  mockConfirm.mockRejectedValueOnce(Object.assign(new Error("unavailable"), {code: "functions/not-found"}));
  await expect(live.confirmGuessReceipt!(input)).rejects.toMatchObject({code: "functions/not-found"});
});
