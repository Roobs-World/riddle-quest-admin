type TestHarnessWindow = Window & {
  __RIDDLE_QUEST_BROWSER_TEST__?: boolean;
  __RIDDLE_QUEST_JEST_AUTH_TEST__?: unknown;
};

export const hasTrustedTestHarnessMarker = (): boolean => {
  if (typeof window === "undefined") return false;
  const markedWindow = window as TestHarnessWindow;
  return markedWindow.__RIDDLE_QUEST_BROWSER_TEST__ === true || markedWindow.__RIDDLE_QUEST_JEST_AUTH_TEST__ !== undefined;
};

const TEST_HARNESS_NAMES = new Set(["jest", "jest-auth", "race", "race-auth", "dev"]);

export const shouldUseFakeHostServices = ({
  search,
  development,
  testHarnessEnabled,
}: {
  search: string;
  development: boolean;
  testHarnessEnabled: boolean;
}): boolean => {
  if (development) return true;
  const harness = new URLSearchParams(search).get("harness");
  return testHarnessEnabled && harness !== null && TEST_HARNESS_NAMES.has(harness);
};
