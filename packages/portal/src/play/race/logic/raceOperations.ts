/** Host operations that can be pending during the multiplayer flow. */
export type RaceOperation =
  | "raceCategories"
  | "raceResume"
  | "raceStart"
  | "raceGuess"
  | "raceHint"
  | "raceSkip"
  | "raceAbandon"
  | "racePublish"
  | "raceInviteReserve"
  | "raceChallenge"
  | "raceOutcome"
  | "raceInbox"
  | "raceBlock"
  | "raceReport";

/** Operations whose server mutations require an idempotency receipt. */
const RECEIPT_OPERATIONS: ReadonlySet<RaceOperation> = new Set([
  "raceStart",
  "raceGuess",
  "raceHint",
  "raceSkip",
  "raceAbandon",
  "racePublish",
  "raceInviteReserve",
]);

/** Returns whether an operation must carry its request identifier in the payload. */
export const raceOperationRequiresReceipt = (operation: RaceOperation): boolean => RECEIPT_OPERATIONS.has(operation);
