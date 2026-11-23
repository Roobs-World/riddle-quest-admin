/** Describes test harness window. */
type TestHarnessWindow = Window & {
  /** Stores riddle quest browser test. */
  __RIDDLE_QUEST_BROWSER_TEST__?: boolean;
  /** Stores riddle quest jest auth test. */
  __RIDDLE_QUEST_JEST_AUTH_TEST__?: unknown;
};

/** Indicates whether has trusted test harness marker. */
export const hasTrustedTestHarnessMarker = (): boolean => {
  if (typeof window === "undefined") return false;
  /** Provides marked window behavior. */
  const markedWindow = window as TestHarnessWindow;
  return (
    markedWindow.__RIDDLE_QUEST_BROWSER_TEST__ === true || markedWindow.__RIDDLE_QUEST_JEST_AUTH_TEST__ !== undefined
  );
};

/** Defines the test harness names value. */
const TEST_HARNESS_NAMES = new Set(["jest", "jest-auth", "race", "race-auth", "dev"]);

/** Indicates whether should use fake host services. */
export const shouldUseFakeHostServices = ({
  search,
  development,
  testHarnessEnabled,
}: {
  /** Stores search. */
  search: string;
  /** Stores development. */
  development: boolean;
  /** Stores test harness enabled. */
  testHarnessEnabled: boolean;
}): boolean => {
  if (development) return true;
  /** Provides harness behavior. */
  const harness = new URLSearchParams(search).get("harness");
  return testHarnessEnabled && harness !== null && TEST_HARNESS_NAMES.has(harness);
};
