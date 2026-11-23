import {expect, it} from "@jest/globals";
import {formatRaceTime} from "../racePresentation";

/** Rounding to the nearest tenth carries into minutes rather than rendering sixty seconds. */
it.each([
  [-1, "0:00.0"], [0, "0:00.0"], [49, "0:00.0"], [50, "0:00.1"],
  [59949, "0:59.9"], [59950, "1:00.0"], [59999, "1:00.0"], [60000, "1:00.0"],
  [61250, "1:01.3"], [119949, "1:59.9"], [119950, "2:00.0"], [599999, "10:00.0"],
])("formats %i milliseconds as %s", (milliseconds, expected) => {
  expect(formatRaceTime(milliseconds)).toBe(expected);
});
