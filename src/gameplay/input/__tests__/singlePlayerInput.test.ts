import {GameRequestHintMessageSchema, GameSubmitGuessMessageSchema} from "../../../platform/bridge/messages";
import {GetHintRequestSchema, SubmitGuessRequestDataSchema, SubmitSinglePlayerGuessRequestDataSchema} from "../../../platform/contracts/requestSchemas";
import {SubmitSinglePlayerGuessInputSchema} from "../../contracts/cloudFunctionsSchemas";
import {SinglePlayerGuessSchema, SinglePlayerAttemptCellSchema} from "../singlePlayerInput";

/** Exact receipt binding used by the supported keyboard regression. */
const binding = {riddleId: "classic-1", gameMode: "classic", sessionToken: "00000000-0000-4000-8000-000000000001", requestId: "keyboard-request-0001"};

it.each(["İZMİR", "ISIK", "ı", "PIANO"])("preserves supported submitted bytes: %s", guess => {
  expect(SinglePlayerGuessSchema.parse(guess)).toBe(guess);
  expect(GameSubmitGuessMessageSchema.parse({type: "game:submitGuess", requestId: binding.requestId, payload: {...binding, guess}}).payload.guess).toBe(guess);
  expect(SubmitSinglePlayerGuessRequestDataSchema.parse({...binding, guess}).guess).toBe(guess);
  expect(SubmitSinglePlayerGuessInputSchema.parse({...binding, guess}).guess).toBe(guess);
  expect(SubmitGuessRequestDataSchema.parse({riddleId: binding.riddleId, gameMode: "classic", attempts: 1, guess}).guess).toBe(guess);
});
it.each(["İ", "ı", "I", "i", ""])("preserves supported partial cells: %s", letter => {
  /** A current attempt may contain displayed hints and empty slots. */
  const payload = {...binding, currentAttempt: [letter, "", "", "", ""]};
  expect(SinglePlayerAttemptCellSchema.parse(letter)).toBe(letter);
  expect(GetHintRequestSchema.parse(payload).currentAttempt).toEqual(payload.currentAttempt);
  expect(GameRequestHintMessageSchema.parse({type: "game:requestHint", requestId: binding.requestId, payload}).payload.currentAttempt).toEqual(payload.currentAttempt);
});
it.each(["", "ABCDEFGH", "é", "界", "ß", "A\n", "A ", "A1", "A\u200d"])("rejects unsupported submitted input: %s", guess => {
  expect(SinglePlayerGuessSchema.safeParse(guess).success).toBe(false);
  expect(SubmitSinglePlayerGuessInputSchema.safeParse({...binding, guess}).success).toBe(false);
});
it.each(["II", "é", "界", "\n", " ", "1", "I\u0307"])("rejects unsupported partial cells: %s", letter => {
  expect(SinglePlayerAttemptCellSchema.safeParse(letter).success).toBe(false);
  expect(GetHintRequestSchema.safeParse({...binding, currentAttempt: [letter]}).success).toBe(false);
});
it("retains the seven-slot partial-attempt budget", () => {
  expect(GetHintRequestSchema.safeParse({...binding, currentAttempt: Array(8).fill("")}).success).toBe(false);
});
