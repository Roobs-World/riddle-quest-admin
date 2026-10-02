/** Host operations that can be pending during the multiplayer flow. */
export type RaceOperation =
  | "raceCategories"
  | "raceResume"
  | "raceStart"
  | "raceReady"
  | "raceGuess"
  | "raceHint"
  | "raceSkip"
  | "raceAbandon"
  | "racePublish"
  | "raceChallenge"
  | "raceEntry"
  | "raceInviteCancel"
  | "raceOutcome"
  | "raceInbox"
  | "raceBlock"
  | "raceReport";

/** Operations whose server mutations require an idempotency receipt. */
const RECEIPT_OPERATIONS: ReadonlySet<RaceOperation> = new Set([
  "raceStart",
  "raceReady",
  "raceGuess",
  "raceHint",
  "raceSkip",
  "raceAbandon",
  "racePublish",
  "raceInviteCancel",
]);

/** Returns whether an operation must carry its request identifier in the payload. */
export const raceOperationRequiresReceipt = (operation: RaceOperation): boolean => RECEIPT_OPERATIONS.has(operation);

/** Failed gameplay delivery or recovery leaves the run uncertain until a validated refresh. */
export const raceOperationRequiresRefresh = (operation: RaceOperation): boolean =>
  ["raceGuess", "raceHint", "raceSkip", "raceResume"].includes(operation);
