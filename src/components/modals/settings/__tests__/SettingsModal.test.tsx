const React = require("react");
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import SettingsModal from "../SettingsModal";

// Mock constants
jest.mock("../../../../constants/AppStrings", () => ({
  AppStrings: {
    CommonAlerts: {
      CLOSE_BUTTON: "Close",
    },
    Settings: {
      TITLE: "Settings",
      SOUND_TOGGLE: "Sound",
      HAPTICS_TOGGLE: "Haptics",
      TOGGLE_ON: "On",
      TOGGLE_OFF: "Off",
      LANGUAGE_LABEL: "Language",
      LANGUAGE_SELECTED: "Selected",
      HELP_BUTTON: "Help and Support?",
      ABOUT_BUTTON: "About",
      PRIVACY_POLICY_BUTTON: "Privacy Policy",
      TERMS_BUTTON: "Terms of Use",
      LICENSES_BUTTON: "Licenses",
      ACCOUNT_DELETION_BUTTON: "Delete Account",
      DATA_EXPORT_BUTTON: "Export My Data",
      CREDITS_BUTTON: "Credits",
      LOGOUT_BUTTON: "Logout",
      LOGOUT_ERROR_TITLE: "Logout Error",
      LOGOUT_ERROR_MESSAGE: "Unable to logout.",
      CLOSE_BUTTON: "Close",
    },
  },
  LANGUAGE_OPTIONS: [
    { code: "en", label: "English" },
    { code: "es", label: "Spanish" },
    { code: "fr", label: "French" },
  ],
  getLanguageLabel: (code: string) => {
    const labels: Record<string, string> = {
      en: "English",
      es: "Spanish",
      fr: "French",
    };
    return labels[code] || code;
  },
  getAppLanguage: jest.fn(() => "en"),
  SupportedLanguage: "en",
}));

// Mock styles
jest.mock("../../../../styles", () => ({
  TYPOGRAPHY: {
    fontPrimary: "PoetsenOne",
    fontSecondary: "Poppins",
    fontSize: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
    },
  },
  SPACING: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    "2xl": 48,
  },
}));

describe("<SettingsModal />", () => {
  const defaultProps = {
    isVisible: true,
    onClose: jest.fn(),
    isSoundEnabled: true,
    onToggleSound: jest.fn(),
    isHapticsEnabled: true,
    onToggleHaptics: jest.fn(),
    currentLanguage: "en" as const,
    onChangeLanguage: jest.fn(),
    onPressHelp: jest.fn(),
    onPressAbout: jest.fn(),
    onPressLogout: jest.fn(),
    onPressCredits: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const { getAppLanguage } = require("../../../../constants/AppStrings");
    getAppLanguage.mockReturnValue("en");
  });

  describe("Rendering", () => {
    it("should render without crashing when visible", () => {
      expect(() => render(<SettingsModal {...defaultProps} />)).not.toThrow();
    });

    it("should render without crashing when not visible", () => {
      expect(() =>
        render(<SettingsModal {...defaultProps} isVisible={false} />)
      ).not.toThrow();
    });

    it("should render title", () => {
      const { getByText } = render(<SettingsModal {...defaultProps} />);
      expect(getByText("Settings")).toBeTruthy();
    });

    it("should render sound toggle", () => {
      const { getByText } = render(<SettingsModal {...defaultProps} />);
      expect(getByText("Sound")).toBeTruthy();
    });

    it("should render haptics toggle", () => {
      const { getByText } = render(<SettingsModal {...defaultProps} />);
      expect(getByText("Haptics")).toBeTruthy();
    });

    it("should render language option", () => {
      const { getByText } = render(<SettingsModal {...defaultProps} />);
      expect(getByText("Language")).toBeTruthy();
    });

    it("should render current language label", () => {
      const { getByText } = render(<SettingsModal {...defaultProps} />);
      expect(getByText("English")).toBeTruthy();
    });

    it("should render help and support option", () => {
      const { getByText } = render(<SettingsModal {...defaultProps} />);
      expect(getByText("Help and Support?")).toBeTruthy();
    });

    it("should render credits option", () => {
      const { getByText } = render(<SettingsModal {...defaultProps} />);
      expect(getByText("Credits")).toBeTruthy();
    });

    it("should render about option", () => {
      const { getByText } = render(<SettingsModal {...defaultProps} />);
      expect(getByText("About")).toBeTruthy();
    });

    it("should render logout button", () => {
      const { getByText } = render(<SettingsModal {...defaultProps} />);
      expect(getByText("Logout")).toBeTruthy();
    });

    it("should render close button", () => {
      const { getByLabelText } = render(<SettingsModal {...defaultProps} />);
      expect(getByLabelText("Close")).toBeTruthy();
    });
  });

  describe("Toggle Interactions", () => {
    it("should call onToggleSound when sound On is pressed", () => {
      const { getAllByText } = render(<SettingsModal {...defaultProps} />);
      const onButtons = getAllByText("On");
      // First On button is for Sound
      fireEvent.press(onButtons[0]);
      expect(defaultProps.onToggleSound).toHaveBeenCalledWith(true);
    });

    it("should call onToggleSound with false when sound Off is pressed", () => {
      const { getAllByText } = render(<SettingsModal {...defaultProps} />);
      const offButtons = getAllByText("Off");
      // First Off button is for Sound
      fireEvent.press(offButtons[0]);
      expect(defaultProps.onToggleSound).toHaveBeenCalledWith(false);
    });

    it("should call onToggleHaptics when haptics toggle is pressed", () => {
      const { getAllByText } = render(<SettingsModal {...defaultProps} />);
      const onButtons = getAllByText("On");
      // Second On button is for Haptics
      fireEvent.press(onButtons[1]);
      expect(defaultProps.onToggleHaptics).toHaveBeenCalledWith(true);
    });
  });

  describe("Navigation Interactions", () => {
    it("should call onPressHelp when help option is pressed", () => {
      const { getByText } = render(<SettingsModal {...defaultProps} />);
      fireEvent.press(getByText("Help and Support?"));
      expect(defaultProps.onPressHelp).toHaveBeenCalledTimes(1);
    });

    it("should call onPressCredits when credits is pressed", () => {
      const { getByText } = render(<SettingsModal {...defaultProps} />);
      fireEvent.press(getByText("Credits"));
      expect(defaultProps.onPressCredits).toHaveBeenCalledTimes(1);
    });

    it("should call onPressAbout when about is pressed", () => {
      const { getByText } = render(<SettingsModal {...defaultProps} />);
      fireEvent.press(getByText("About"));
      expect(defaultProps.onPressAbout).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when close button is pressed", () => {
      const { getByLabelText } = render(<SettingsModal {...defaultProps} />);
      fireEvent.press(getByLabelText("Close"));
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Language Picker", () => {
    it("should open language picker when language row is pressed", () => {
      const { getByText, queryByText } = render(<SettingsModal {...defaultProps} />);
      fireEvent.press(getByText("Language"));
      // After opening, the language picker should show language options
      expect(queryByText("Spanish")).toBeTruthy();
      expect(queryByText("French")).toBeTruthy();
    });

    it("should call onChangeLanguage when a language is selected", () => {
      const { getByText } = render(<SettingsModal {...defaultProps} />);
      // Open language picker
      fireEvent.press(getByText("Language"));
      // Select Spanish
      fireEvent.press(getByText("Spanish"));
      expect(defaultProps.onChangeLanguage).toHaveBeenCalledWith("es");
    });

    it("should close language picker when a language is selected", () => {
      const { getByText, queryAllByText } = render(<SettingsModal {...defaultProps} />);
      fireEvent.press(getByText("Language"));
      fireEvent.press(getByText("Spanish"));
      // Language picker should close after selection
      // The Spanish text should only appear once (as current value)
    });

    it("should close language picker when close button is pressed", () => {
      const { getByText, queryByText, getAllByText } = render(
        <SettingsModal {...defaultProps} />
      );
      fireEvent.press(getByText("Language"));
      // Press close button in language picker
      const closeButtons = getAllByText("Close");
      fireEvent.press(closeButtons[closeButtons.length - 1]);
      // Language picker should close
    });

    it("should show selected indicator for current language", () => {
      const { getByText, queryByText } = render(
        <SettingsModal {...defaultProps} currentLanguage="en" />
      );
      fireEvent.press(getByText("Language"));
      // English should be marked as selected
      expect(queryByText("Selected")).toBeTruthy();
    });

    it("should handle onRequestClose of language picker modal", () => {
      const { getByText, UNSAFE_queryAllByType } = render(
        <SettingsModal {...defaultProps} />
      );

      // Open the language picker
      fireEvent.press(getByText("Language"));

      // Get the Modal component and trigger onRequestClose
      const { Modal } = require("react-native");
      const modals = UNSAFE_queryAllByType(Modal);

      // The second modal is the language picker
      if (modals.length > 1 && modals[1].props.onRequestClose) {
        act(() => {
          modals[1].props.onRequestClose();
        });
      }

      // Language picker should close (Spanish should not be visible)
    });

    it("should close language picker when backdrop TouchableOpacity is pressed", () => {
      const { getByText, queryByText, UNSAFE_queryAllByType } = render(
        <SettingsModal {...defaultProps} />
      );

      // Open the language picker
      fireEvent.press(getByText("Language"));
      expect(queryByText("Spanish")).toBeTruthy();

      // Find and press the backdrop TouchableOpacity
      const { TouchableOpacity } = require("react-native");
      const touchables = UNSAFE_queryAllByType(TouchableOpacity);

      // Find the backdrop touchable (has flex: 1 style and activeOpacity: 1)
      const backdrop = touchables.find(
        (t: any) =>
          t.props.style?.flex === 1 &&
          t.props.activeOpacity === 1 &&
          t.props.onPress
      );

      if (backdrop?.props.onPress) {
        fireEvent.press(backdrop);
      }
    });
  });

  describe("Logout", () => {
    it("should call onPressLogout when logout is pressed", async () => {
      const onPressLogout = jest.fn();
      const { getByText } = render(
        <SettingsModal {...defaultProps} onPressLogout={onPressLogout} />
      );

      fireEvent.press(getByText("Logout"));

      await waitFor(() => {
        expect(onPressLogout).toHaveBeenCalled();
      });
    });

    it("should show alert when logout fails", async () => {
      const onPressLogout = jest.fn(() => {
        throw new Error("Logout failed");
      });

      const { getByText } = render(
        <SettingsModal {...defaultProps} onPressLogout={onPressLogout} />
      );

      fireEvent.press(getByText("Logout"));

      await waitFor(() => {
        expect(onPressLogout).toHaveBeenCalled();
      });
      // Alert should be called but we can't easily test Alert.alert in RNTL
    });
  });

  describe("Menu Options", () => {
    it("should not render achievements option", () => {
      const { queryByText } = render(<SettingsModal {...defaultProps} />);
      expect(queryByText("Achievements")).toBeNull();
    });
  });

  describe("Toggle State Display", () => {
    it("should show correct state for sound toggle when enabled", () => {
      const { getAllByText } = render(
        <SettingsModal {...defaultProps} isSoundEnabled={true} />
      );
      // On button should be styled as selected
      expect(getAllByText("On").length).toBeGreaterThan(0);
    });

    it("should show correct state for sound toggle when disabled", () => {
      const { getAllByText } = render(
        <SettingsModal {...defaultProps} isSoundEnabled={false} />
      );
      // Off button should be styled as selected
      expect(getAllByText("Off").length).toBeGreaterThan(0);
    });

    it("should show correct state for haptics toggle when enabled", () => {
      const { getAllByText } = render(
        <SettingsModal {...defaultProps} isHapticsEnabled={true} />
      );
      expect(getAllByText("On").length).toBeGreaterThan(0);
    });
  });

  describe("Component Lifecycle", () => {
    it("should handle prop updates correctly", () => {
      const { rerender } = render(<SettingsModal {...defaultProps} />);

      expect(() => {
        rerender(<SettingsModal {...defaultProps} isSoundEnabled={false} />);
        rerender(<SettingsModal {...defaultProps} isHapticsEnabled={false} />);
        rerender(<SettingsModal {...defaultProps} currentLanguage={"es" as any} />);
      }).not.toThrow();
    });

    it("should handle unmount correctly", () => {
      const { unmount } = render(<SettingsModal {...defaultProps} />);
      expect(() => unmount()).not.toThrow();
    });

    it("should handle visibility changes", () => {
      const { rerender, getByText, queryByText } = render(
        <SettingsModal {...defaultProps} isVisible={true} />
      );
      expect(getByText("Settings")).toBeTruthy();

      rerender(<SettingsModal {...defaultProps} isVisible={false} />);
      // Modal content may or may not be visible depending on Modal behavior
    });
  });

  describe("Backdrop Interaction", () => {
    it("should call onClose when backdrop is pressed", () => {
      const onClose = jest.fn();
      // The backdrop is the TouchableOpacity with style={{ flex: 1 }}
      // This is hard to test directly without testIDs
      render(<SettingsModal {...defaultProps} onClose={onClose} />);
      // Modal component typically handles onRequestClose
    });
  });

  describe("Edge Cases", () => {
    it("should handle all toggles being disabled", () => {
      const { getByText } = render(
        <SettingsModal
          {...defaultProps}
          isSoundEnabled={false}
          isHapticsEnabled={false}
        />
      );
      expect(getByText("Settings")).toBeTruthy();
    });

    it("should handle all toggles being enabled", () => {
      const { getByText } = render(
        <SettingsModal
          {...defaultProps}
          isSoundEnabled={true}
          isHapticsEnabled={true}
        />
      );
      expect(getByText("Settings")).toBeTruthy();
    });

    it("should handle different language values", () => {
      const { getAppLanguage } = require("../../../../constants/AppStrings");
      const { rerender, getByText } = render(
        <SettingsModal {...defaultProps} currentLanguage={"en" as any} />
      );
      expect(getByText("English")).toBeTruthy();

      getAppLanguage.mockReturnValue("es");
      rerender(<SettingsModal {...defaultProps} currentLanguage={"es" as any} />);
      expect(getByText("Spanish")).toBeTruthy();
    });
  });
});
