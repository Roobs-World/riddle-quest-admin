import {describe, expect, it} from "@jest/globals";
import {resetDevelopmentFirstRunState} from "../developmentFirstRun";

const createStorage = (initial: Record<string, string>) => {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    entries() {
      return Object.fromEntries(values);
    },
  };
};

describe("development first-run reset", () => {
  it("clears Riddle Quest progress and preferences without touching unrelated storage", () => {
    const localStorage = createStorage({
      "riddleQuest:onboarding:jest-guest": "seen",
      "riddleQuest:mockJestPlayerData": "{\"level\":3}",
      "riddleQuest:soundEnabled": "false",
      appLanguage: "fr",
      unrelated: "preserved",
    });
    const sessionStorage = createStorage({
      "riddleQuest:welcomeSession:jest-guest": "seen",
      unrelatedSession: "preserved",
    });

    resetDevelopmentFirstRunState(localStorage, sessionStorage);

    expect(localStorage.entries()).toEqual({unrelated: "preserved"});
    expect(sessionStorage.entries()).toEqual({unrelatedSession: "preserved"});
  });
});
