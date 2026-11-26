import {beforeEach, describe, expect, it, jest} from "@jest/globals";
import type {Functions} from "firebase/functions";

/** Callables bound by the Android account adapter. */
const mockBindings = new Map<string, string>();

jest.mock("firebase/functions", () => ({
  httpsCallable: (functions: string, name: string) => {
    mockBindings.set(name, functions);
    return async () => ({data: {ok: true}});
  },
}));

import {createAndroidAccountFunctions} from "../androidAccountFunctions";

/** Region handle represented by its name, preserving the existing transport fixture. */
const gameplay = "gameplay" as unknown as Functions;

describe("createAndroidAccountFunctions", () => {
  beforeEach(() => mockBindings.clear());

  it("binds the Android-only account callable beside solo gameplay", () => {
    /** Android account surface. */
    const android = createAndroidAccountFunctions(gameplay);
    expect(mockBindings.get("provisionAndroidAccount")).toBe("gameplay");
    expect(typeof android.provisionAndroidAccount).toBe("function");
  });

});
