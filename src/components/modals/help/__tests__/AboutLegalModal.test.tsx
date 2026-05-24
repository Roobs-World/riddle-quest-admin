import React from "react";
import {Alert, Linking} from "react-native";
import {fireEvent, render, waitFor} from "@testing-library/react-native";
import AboutLegalModal from "../AboutLegalModal";

jest.mock("../../../../constants/AppStrings", () => ({
  AppStrings: {
    AboutLegal: {
      TITLE: "About / Legal",
      RIDDLE_QUEST_WEBSITE: "Riddle Quest Website",
      PRIVACY_POLICY: "Privacy Policy",
      TERMS_OF_USE: "Terms of Use",
      ACCOUNT_DELETION: "Account Deletion",
      DATA_EXPORT: "Data Export",
      THIRD_PARTY_LICENSES: "Third-Party Licenses",
      SUPPORT: "Support",
    },
    CommonAlerts: {
      CLOSE_BUTTON: "Close",
      UNABLE_TO_OPEN_TITLE: "Unable to Open",
      COULD_NOT_OPEN_PREFIX: "Could not open ",
      COULD_NOT_OPEN_TRY_AGAIN: ". Please try again later.",
    },
  },
  getAppLanguage: jest.fn(() => "en"),
}));

jest.mock("../../../../styles", () => ({
  TYPOGRAPHY: {
    fontPrimary: "PoetsenOne",
    fontSecondary: "Poppins",
    fontSize: {
      base: 16,
      "4xl": 32,
    },
  },
  SPACING: {
    sm: 8,
    md: 16,
    lg: 24,
    "2xl": 48,
  },
}));

describe("<AboutLegalModal />", () => {
  const mockOpenURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);

  const defaultProps = {
    isVisible: true,
    onClose: jest.fn(),
  };

  const expectedLinks = [
    ["Riddle Quest Website", "https://www.roobsworld.com/riddle-quest/en"],
    ["Privacy Policy", "https://www.roobsworld.com/riddle-quest/en/privacy-policy"],
    ["Terms of Use", "https://www.roobsworld.com/riddle-quest/en/terms-of-use"],
    ["Account Deletion", "https://www.roobsworld.com/riddle-quest/en/account-deletion"],
    ["Data Export", "https://www.roobsworld.com/riddle-quest/en/data-export"],
    ["Third-Party Licenses", "https://www.roobsworld.com/riddle-quest/en/third-party-licenses"],
    ["Support", "https://www.roobsworld.com/riddle-quest/en/support"],
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenURL.mockResolvedValue(undefined);
    jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
    const {getAppLanguage} = require("../../../../constants/AppStrings");
    getAppLanguage.mockReturnValue("en");
  });

  afterAll(() => {
    mockOpenURL.mockRestore();
  });

  it("renders all expected legal link labels", () => {
    const {getByText} = render(<AboutLegalModal {...defaultProps} />);

    expect(getByText("About / Legal")).toBeTruthy();
    expectedLinks.forEach(([label]) => {
      expect(getByText(label)).toBeTruthy();
    });
  });

  it.each(expectedLinks)("opens %s externally", async (label, url) => {
    const {getByText} = render(<AboutLegalModal {...defaultProps} />);

    fireEvent.press(getByText(label));

    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalledWith(url);
    });
  });

  it("opens URLs for the current app language", async () => {
    const {getAppLanguage} = require("../../../../constants/AppStrings");
    getAppLanguage.mockReturnValue("es");
    const {getByText} = render(<AboutLegalModal {...defaultProps} />);

    fireEvent.press(getByText("Terms of Use"));

    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalledWith("https://www.roobsworld.com/riddle-quest/es/terms-of-use");
    });
  });

  it("handles URL open failures without crashing", async () => {
    mockOpenURL.mockRejectedValueOnce(new Error("No browser"));
    const {getByText} = render(<AboutLegalModal {...defaultProps} />);

    expect(() => fireEvent.press(getByText("Support"))).not.toThrow();

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Unable to Open",
        "Could not open Support. Please try again later."
      );
    });
  });
});
