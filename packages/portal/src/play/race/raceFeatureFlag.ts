export const RACE_HARNESS_NAME = "race";
export const RACE_AUTH_HARNESS_NAME = "race-auth";

export function isRaceTo10Enabled({
  search = "",
  envValue,
}: {
  search?: string;
  envValue?: string;
} = {}): boolean {
  const params = new URLSearchParams(search);
  return (
    envValue === "1" || params.get("harness") === RACE_HARNESS_NAME || params.get("harness") === RACE_AUTH_HARNESS_NAME
  );
}

export function isRaceHarness(search = ""): boolean {
  const harness = new URLSearchParams(search).get("harness");
  return harness === RACE_HARNESS_NAME || harness === RACE_AUTH_HARNESS_NAME;
}
