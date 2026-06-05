import React from "react";
import {Alert, Linking} from "react-native";
import {fireEvent, render, waitFor} from "@testing-library/react-native";
import AboutLegalModal from "../AboutLegalModal";

jest.mock("../../../../i18n", () => {
  const actual = jest.requireActual("../../../../i18n");

  return {
    ...actual,
    getLocale: jest.fn(() => "en"),
    getAppLanguage: jest.fn(() => "en"),
    setLocale: jest.fn(),
    setAppLanguage: jest.fn(),
  };
});

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
    const {getLocale} = require("../../../../i18n");
    getLocale.mockReturnValue("en");
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
    const {getLocale} = require("../../../../i18n");
    getLocale.mockReturnValue("es");
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
      expect(Alert.alert).toHaveBeenCalledWith("Unable to Open", "Could not open Support. Please try again later.");
    });
  });
});
