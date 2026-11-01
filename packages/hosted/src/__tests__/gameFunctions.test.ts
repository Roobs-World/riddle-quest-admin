import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import type {Functions} from "firebase/functions";

/** Callables bound so far, keyed by name, with the region handle they were bound to. */
const mockBindings = new Map<string, string>();
/** Inputs received by the fake transport. */
const mockInputs: unknown[] = [];
/** Response the fake transport returns next. */
let mockResponse: unknown = {ok: true};

jest.mock("firebase/functions", () => ({
  httpsCallable: (functions: string, name: string) => {
    mockBindings.set(name, functions);
    return async (input?: unknown) => {
      mockInputs.push(input);
      return {data: mockResponse};
    };
  },
}));

import {createAndroidAccountFunctions, createGameFunctionsClient, DEFAULT_ACCOUNT_REGION, DEFAULT_GAMEPLAY_REGION} from "../gameFunctions";

/** Region handles represented by their names. */
const regions = {
  account: "account" as unknown as Functions,
  gameplay: "gameplay" as unknown as Functions,
  race: "race" as unknown as Functions,
};

describe("createGameFunctionsClient", () => {
  beforeEach(() => {
    mockBindings.clear();
    mockInputs.length = 0;
    mockResponse = {ok: true};
  });

  it("binds every callable to the region its backend serves", () => {
    /** Client under test. */
    const client = createGameFunctionsClient(regions);
    expect(mockBindings.get("getClassicRiddleBuffer")).toBe("gameplay");
    expect(mockBindings.get("completeGame")).toBe("gameplay");
    expect(mockBindings.has("provisionAndroidAccount")).toBe(false);
    expect(mockBindings.get("updateUsername")).toBe("account");
    expect(mockBindings.get("getLeaderboard")).toBe("account");
    expect(mockBindings.get("blockRival")).toBe("account");
    expect(mockBindings.get("startRaceRun")).toBe("race");
    expect(mockBindings.get("updateLiveRace")).toBe("race");
    expect(mockBindings.size).toBe(Object.keys(client).length);
    expect(Object.keys(client).length).toBe(45);
    expect(typeof client.updateLiveRace).toBe("function");
  });

  it("negotiates content protection only for answer-bearing endpoints", async () => {
    /** Client under test. */
    const client = createGameFunctionsClient(regions);
    mockResponse = {challenge: {questions: [], totalQuestions: 0}};
    await client.getCurrentDailyChallenge({locale: "en"});
    expect(mockInputs.at(-1)).toEqual({locale: "en", contentProtection: 1});
    await client.updateUsername({username: "name"});
    expect(mockInputs.at(-1)).toEqual({username: "name"});
  });

  it("passes plaintext protected responses through unchanged", async () => {
    /** Client under test. */
    const client = createGameFunctionsClient(regions);
    mockResponse = {revealedLetter: "r", index: 0, coinsCost: 25};
    /** Hint response from a legacy plaintext backend. */
    const result = await client.getHint({currentAttempt: [], riddleId: "r", sessionToken: "s", requestId: "q", gameMode: "classic"});
    expect(result.data).toEqual({revealedLetter: "r", index: 0, coinsCost: 25});
  });

  it("binds the Android-only account callable beside solo gameplay", () => {
    /** Android account surface. */
    const android = createAndroidAccountFunctions(regions.gameplay);
    expect(mockBindings.get("provisionAndroidAccount")).toBe("gameplay");
    expect(typeof android.provisionAndroidAccount).toBe("function");
  });

  it("exposes the default regions hosts bind before creating the client", () => {
    expect(DEFAULT_GAMEPLAY_REGION).toBe("europe-west1");
    expect(DEFAULT_ACCOUNT_REGION).toBe("us-central1");
  });
});
