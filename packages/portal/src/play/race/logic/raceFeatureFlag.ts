import {hasTrustedTestHarnessMarker} from "../../../testHarness";

/** Query-string harness identifier for the standard multiplayer flow. */
export const RACE_HARNESS_NAME = "race";
/** Query-string harness identifier for the authenticated multiplayer flow. */
export const RACE_AUTH_HARNESS_NAME = "race-auth";

/** Returns whether Race to 10 is enabled by configuration or a trusted test harness. */
export function isRaceTo10Enabled({
  search = "",
  envValue,
  testHarnessEnabled = hasTrustedTestHarnessMarker(),
}: {
  search?: string;
  envValue?: string;
  testHarnessEnabled?: boolean;
} = {}): boolean {
  /** Parsed query parameters used to inspect trusted harness selection. */
  const params = new URLSearchParams(search);
  return (
    envValue === "1" ||
    (testHarnessEnabled &&
      (params.get("harness") === RACE_HARNESS_NAME || params.get("harness") === RACE_AUTH_HARNESS_NAME))
  );
}

/** Returns whether the URL selects a trusted Race to 10 browser harness. */
export function isRaceHarness(
  search = "",
  testHarnessEnabled = hasTrustedTestHarnessMarker(),
): boolean {
  if (!testHarnessEnabled) return false;
  /** Harness name requested by the current URL. */
  const harness = new URLSearchParams(search).get("harness");
  return harness === RACE_HARNESS_NAME || harness === RACE_AUTH_HARNESS_NAME;
}
