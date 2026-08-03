import type {RaceRunView} from "@qwordly/core/race";

/** Non-null riddle prompt presented during an active race. */
type RaceRiddle = NonNullable<RaceRunView["currentRiddle"]>;

/** Formats milliseconds as the minute-and-tenths display used by Race to 10. */
export const formatRaceTime = (milliseconds: number): string => {
  /** Non-negative elapsed time expressed in seconds. */
  const seconds = Math.max(0, milliseconds) / 1_000;
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
};

/** Creates an editable answer attempt populated with server-revealed letters. */
export const createRaceAttempt = (riddle: RaceRiddle | null): string[] => {
  if (!riddle) return [];
  /** Server-authoritative letters indexed by their answer position. */
  const revealed = new Map(riddle.revealedLetters.map(({index, letter}) => [index, letter]));
  return Array.from({length: riddle.answerLength}, (_, index) => revealed.get(index) ?? "");
};

/** Finds the first answer slot that has not been revealed by the server. */
export const findFirstEditableRaceSlot = (riddle: RaceRiddle | null): number => {
  if (!riddle) return 0;
  /** Answer positions already fixed by server-authoritative hints. */
  const revealed = new Set(riddle.revealedLetters.map(({index}) => index));
  return Array.from({length: riddle.answerLength}, (_, position) => position)
    .find((position) => !revealed.has(position)) ?? 0;
};
