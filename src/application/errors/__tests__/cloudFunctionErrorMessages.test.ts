jest.mock("../../../i18n", () => {
  const translations: Record<string, string> = {
    "Profile.ALERT_USERNAME_ALREADY_TAKEN": "Username already taken.",
    "Profile.ALERT_AN_ERROR_OCCURRED": "An error occurred.",
  };

  return {
    t: (key: string) => translations[key] ?? key,
  };
});

import {getUpdateUsernameErrorMessage} from "../cloudFunctionErrorMessages";

describe("cloudFunctionErrorMessages", () => {
  it("maps normalized functions codes to friendly copy", () => {
    expect(getUpdateUsernameErrorMessage({code: "functions/already-exists", message: "Username is taken."})).toBe(
      "Username already taken.",
    );
  });

  it("falls back to the generic error copy for unmapped messages", () => {
    expect(getUpdateUsernameErrorMessage({code: "functions/invalid-argument", message: "[x] Invalid payload"})).toBe(
      "An error occurred.",
    );
  });
});
