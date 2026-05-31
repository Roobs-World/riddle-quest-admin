import {getUpdateUsernameErrorMessage} from "../cloudFunctionErrorMessages";

jest.mock("../../../constants/AppStrings", () => ({
  AppStrings: {
    Profile: {
      ALERT_USERNAME_ALREADY_TAKEN: "Username already taken.",
      ALERT_AN_ERROR_OCCURRED: "An error occurred.",
    },
  },
}));

describe("cloudFunctionErrorMessages", () => {
  it("maps normalized functions codes to friendly copy", () => {
    expect(getUpdateUsernameErrorMessage({code: "functions/already-exists", message: "Username is taken."})).toBe(
      "Username already taken.",
    );
  });

  it("strips bracketed prefixes from server messages", () => {
    expect(getUpdateUsernameErrorMessage({code: "functions/invalid-argument", message: "[x] Invalid payload"})).toBe(
      "Invalid payload",
    );
  });
});

