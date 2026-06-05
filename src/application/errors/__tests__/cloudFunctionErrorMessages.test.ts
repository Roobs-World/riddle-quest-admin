import {getUpdateUsernameErrorMessage} from "../cloudFunctionErrorMessages";

const mockI18n: any = {
  AppStrings: {
    Profile: {
      ALERT_USERNAME_ALREADY_TAKEN: "Username already taken.",
      ALERT_AN_ERROR_OCCURRED: "An error occurred.",
    },
  },
};

mockI18n.t = (key: string) => key.split(".").reduce((current: any, segment: string) => current?.[segment], mockI18n.AppStrings);

jest.mock("../../../i18n", () => mockI18n);

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
