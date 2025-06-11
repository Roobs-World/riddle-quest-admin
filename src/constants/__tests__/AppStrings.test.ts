import { AppStrings } from "../AppStrings";

describe("AppStrings", () => {
  describe("structure", () => {
    it("should export AppStrings object", () => {
      expect(AppStrings).toBeDefined();
      expect(typeof AppStrings).toBe("object");
    });

    it("should have AuthStrings section", () => {
      expect(AppStrings).toHaveProperty("AuthStrings");
      expect(typeof AppStrings.AuthStrings).toBe("object");
    });

    it("should have Navigation section", () => {
      expect(AppStrings).toHaveProperty("Navigation");
      expect(typeof AppStrings.Navigation).toBe("object");
    });

    it("should have Settings section", () => {
      expect(AppStrings).toHaveProperty("Settings");
      expect(typeof AppStrings.Settings).toBe("object");
    });

    it("should have Profile section", () => {
      expect(AppStrings).toHaveProperty("Profile");
      expect(typeof AppStrings.Profile).toBe("object");
    });

    it("should have GameMessages section", () => {
      expect(AppStrings).toHaveProperty("GameMessages");
      expect(typeof AppStrings.GameMessages).toBe("object");
    });

    it("should have ErrorMessages section", () => {
      expect(AppStrings).toHaveProperty("ErrorMessages");
      expect(typeof AppStrings.ErrorMessages).toBe("object");
    });
  });

  describe("AuthStrings section", () => {
    it("should have Login subsection", () => {
      expect(AppStrings.AuthStrings).toHaveProperty("Login");
      expect(typeof AppStrings.AuthStrings.Login).toBe("object");
    });

    it("should have SignUp subsection", () => {
      expect(AppStrings.AuthStrings).toHaveProperty("SignUp");
      expect(typeof AppStrings.AuthStrings.SignUp).toBe("object");
    });

    it("should have Landing subsection", () => {
      expect(AppStrings.AuthStrings).toHaveProperty("Landing");
      expect(typeof AppStrings.AuthStrings.Landing).toBe("object");
    });

    it("should have NewPassword subsection", () => {
      expect(AppStrings.AuthStrings).toHaveProperty("NewPassword");
      expect(typeof AppStrings.AuthStrings.NewPassword).toBe("object");
    });

    it("should contain login form strings", () => {
      expect(AppStrings.AuthStrings.Login).toHaveProperty("TITLE");
      expect(AppStrings.AuthStrings.Login).toHaveProperty("EMAIL_PLACEHOLDER");
      expect(AppStrings.AuthStrings.Login).toHaveProperty(
        "PASSWORD_PLACEHOLDER"
      );
      expect(AppStrings.AuthStrings.Login).toHaveProperty("LOGIN_BUTTON");

      expect(typeof AppStrings.AuthStrings.Login.TITLE).toBe("string");
      expect(typeof AppStrings.AuthStrings.Login.EMAIL_PLACEHOLDER).toBe(
        "string"
      );
      expect(typeof AppStrings.AuthStrings.Login.PASSWORD_PLACEHOLDER).toBe(
        "string"
      );
      expect(typeof AppStrings.AuthStrings.Login.LOGIN_BUTTON).toBe("string");
    });

    it("should contain signup form strings", () => {
      expect(AppStrings.AuthStrings.SignUp).toHaveProperty("TITLE");
      expect(AppStrings.AuthStrings.SignUp).toHaveProperty(
        "USERNAME_PLACEHOLDER"
      );
      expect(AppStrings.AuthStrings.SignUp).toHaveProperty("EMAIL_PLACEHOLDER");
      expect(AppStrings.AuthStrings.SignUp).toHaveProperty(
        "PASSWORD_PLACEHOLDER"
      );

      expect(typeof AppStrings.AuthStrings.SignUp.TITLE).toBe("string");
      expect(typeof AppStrings.AuthStrings.SignUp.USERNAME_PLACEHOLDER).toBe(
        "string"
      );
      expect(typeof AppStrings.AuthStrings.SignUp.EMAIL_PLACEHOLDER).toBe(
        "string"
      );
      expect(typeof AppStrings.AuthStrings.SignUp.PASSWORD_PLACEHOLDER).toBe(
        "string"
      );
    });
  });

  describe("Navigation section", () => {
    it("should contain navigation route names", () => {
      expect(AppStrings.Navigation).toHaveProperty("LOGIN");
      expect(AppStrings.Navigation).toHaveProperty("SIGN_UP");
      expect(AppStrings.Navigation).toHaveProperty("GAME");
      expect(AppStrings.Navigation).toHaveProperty("CREDITS");

      expect(typeof AppStrings.Navigation.LOGIN).toBe("string");
      expect(typeof AppStrings.Navigation.SIGN_UP).toBe("string");
      expect(typeof AppStrings.Navigation.GAME).toBe("string");
      expect(typeof AppStrings.Navigation.CREDITS).toBe("string");
    });

    it("should contain button labels", () => {
      expect(AppStrings.Navigation).toHaveProperty("PLAY_BUTTON");
      expect(AppStrings.Navigation).toHaveProperty("PROFILE_BUTTON");
      expect(AppStrings.Navigation).toHaveProperty("SETTINGS_BUTTON");
      expect(AppStrings.Navigation).toHaveProperty("HINT_BUTTON");

      expect(typeof AppStrings.Navigation.PLAY_BUTTON).toBe("string");
      expect(typeof AppStrings.Navigation.PROFILE_BUTTON).toBe("string");
      expect(typeof AppStrings.Navigation.SETTINGS_BUTTON).toBe("string");
      expect(typeof AppStrings.Navigation.HINT_BUTTON).toBe("string");
    });
  });

  describe("Settings section", () => {
    it("should contain settings strings", () => {
      expect(AppStrings.Settings).toHaveProperty("TITLE");
      expect(AppStrings.Settings).toHaveProperty("SOUND_TOGGLE");
      expect(AppStrings.Settings).toHaveProperty("HAPTICS_TOGGLE");
      expect(AppStrings.Settings).toHaveProperty("LOGOUT_BUTTON");

      expect(typeof AppStrings.Settings.TITLE).toBe("string");
      expect(typeof AppStrings.Settings.SOUND_TOGGLE).toBe("string");
      expect(typeof AppStrings.Settings.HAPTICS_TOGGLE).toBe("string");
      expect(typeof AppStrings.Settings.LOGOUT_BUTTON).toBe("string");
    });
  });

  describe("Profile section", () => {
    it("should contain profile strings", () => {
      expect(AppStrings.Profile).toHaveProperty("TITLE");
      expect(AppStrings.Profile).toHaveProperty("USERNAME_LABEL");
      expect(AppStrings.Profile).toHaveProperty("SAVE_BUTTON");
      expect(AppStrings.Profile).toHaveProperty("EDIT_BUTTON");

      expect(typeof AppStrings.Profile.TITLE).toBe("string");
      expect(typeof AppStrings.Profile.USERNAME_LABEL).toBe("string");
      expect(typeof AppStrings.Profile.SAVE_BUTTON).toBe("string");
      expect(typeof AppStrings.Profile.EDIT_BUTTON).toBe("string");
    });

    it("should contain stats strings", () => {
      expect(AppStrings.Profile).toHaveProperty("STATS_TITLE");
      expect(AppStrings.Profile).toHaveProperty("DAILY_PUZZLES_STAT");
      expect(AppStrings.Profile).toHaveProperty("BEST_STREAK_STAT");
      expect(AppStrings.Profile).toHaveProperty("WIN_RATE_STAT");

      expect(typeof AppStrings.Profile.STATS_TITLE).toBe("string");
      expect(typeof AppStrings.Profile.DAILY_PUZZLES_STAT).toBe("string");
      expect(typeof AppStrings.Profile.BEST_STREAK_STAT).toBe("string");
      expect(typeof AppStrings.Profile.WIN_RATE_STAT).toBe("string");
    });
  });

  describe("GameMessages section", () => {
    it("should contain game outcome messages", () => {
      expect(AppStrings.GameMessages).toHaveProperty("GAME_WON");
      expect(AppStrings.GameMessages).toHaveProperty("GAME_LOST");
      expect(AppStrings.GameMessages).toHaveProperty("COINS_EARNED");
      expect(AppStrings.GameMessages).toHaveProperty("HINT_USED");

      expect(typeof AppStrings.GameMessages.GAME_WON).toBe("string");
      expect(typeof AppStrings.GameMessages.GAME_LOST).toBe("string");
      expect(typeof AppStrings.GameMessages.COINS_EARNED).toBe("string");
      expect(typeof AppStrings.GameMessages.HINT_USED).toBe("string");
    });
  });

  describe("ErrorMessages section", () => {
    it("should contain error messages", () => {
      expect(AppStrings.ErrorMessages).toHaveProperty("UNABLE_TO_LOAD_RIDDLES");
      expect(typeof AppStrings.ErrorMessages.UNABLE_TO_LOAD_RIDDLES).toBe(
        "string"
      );
    });
  });

  describe("string quality", () => {
    it("should not have empty strings", () => {
      const getAllStrings = (obj: any): string[] => {
        const strings: string[] = [];
        Object.values(obj).forEach((value) => {
          if (typeof value === "string") {
            strings.push(value);
          } else if (typeof value === "object" && value !== null) {
            strings.push(...getAllStrings(value));
          }
        });
        return strings;
      };

      const allStrings = getAllStrings(AppStrings);
      allStrings.forEach((str) => {
        expect(str).toBeTruthy();
        expect(str.trim().length).toBeGreaterThan(0);
      });
    });

    it("should have properly formatted button text", () => {
      const buttonTexts = [
        AppStrings.Navigation.PLAY_BUTTON,
        AppStrings.Navigation.PROFILE_BUTTON,
        AppStrings.Navigation.SETTINGS_BUTTON,
        AppStrings.Profile.SAVE_BUTTON,
        AppStrings.Profile.EDIT_BUTTON,
        AppStrings.Settings.LOGOUT_BUTTON,
      ];

      buttonTexts.forEach((text) => {
        // Button text should be concise
        expect(text.length).toBeLessThan(20);
        // Should start with capital letter
        expect(text.charAt(0)).toMatch(/[A-Z]/);
      });
    });

    it("should have informative error messages", () => {
      const errorMessages = Object.values(AppStrings.ErrorMessages);
      errorMessages.forEach((error) => {
        // Error messages should be informative
        expect(error.length).toBeGreaterThan(10);
        // Should start with capital letter or warning emoji
        expect(error.charAt(0)).toMatch(/[A-Z]|⚠/);
      });
    });
  });

  describe("consistency", () => {
    it("should have consistent title formatting", () => {
      const titles = [
        AppStrings.AuthStrings.Login.TITLE,
        AppStrings.AuthStrings.SignUp.TITLE,
        AppStrings.Settings.TITLE,
        AppStrings.Profile.TITLE,
      ];

      titles.forEach((title) => {
        // Titles should start with capital letter
        expect(title.charAt(0)).toMatch(/[A-Z]/);
        // Titles should be short
        expect(title.length).toBeLessThan(30);
      });
    });

    it("should use consistent button naming", () => {
      const allStrings = JSON.stringify(AppStrings);

      // Should use "Button" or "BUTTON" consistently in button names
      const buttonCount = (allStrings.match(/button/gi) || []).length;
      expect(buttonCount).toBeGreaterThan(0);
    });
  });

  describe("completeness", () => {
    it("should have all required auth strings", () => {
      expect(AppStrings.AuthStrings.Login.TITLE).toBeDefined();
      expect(AppStrings.AuthStrings.SignUp.TITLE).toBeDefined();
      expect(AppStrings.AuthStrings.NewPassword.TITLE).toBeDefined();
    });

    it("should have all required navigation strings", () => {
      expect(AppStrings.Navigation.LOGIN).toBeDefined();
      expect(AppStrings.Navigation.GAME).toBeDefined();
      expect(AppStrings.Navigation.PROFILE_BUTTON).toBeDefined();
    });

    it("should have test strings for mocking", () => {
      expect(AppStrings.TestStrings.MOCK_SVG_TEXT).toBeDefined();
      expect(typeof AppStrings.TestStrings.MOCK_SVG_TEXT).toBe("string");
    });
  });

  describe("AuthStrings", () => {
    describe("Landing", () => {
      it("should have all required landing strings", () => {
        expect(AppStrings.AuthStrings.Landing.TAGLINE_1).toBe(
          "Join millions of people to play QWORDLY."
        );
        expect(AppStrings.AuthStrings.Landing.TAGLINE_2).toBe(
          "Ready to have fun while training your mind?"
        );
        expect(AppStrings.AuthStrings.Landing.SIGN_IN_BUTTON).toBe("Sign in");
        expect(AppStrings.AuthStrings.Landing.OR_SIGN_IN_WITH).toBe(
          "or Sign in with"
        );
        expect(AppStrings.AuthStrings.Landing.NO_ACCOUNT_PROMPT).toBe(
          "Don't have an account? "
        );
      });

      it("should have all strings as non-empty values", () => {
        Object.values(AppStrings.AuthStrings.Landing).forEach((value) => {
          expect(typeof value).toBe("string");
          expect(value.length).toBeGreaterThan(0);
        });
      });
    });

    describe("Login", () => {
      it("should have all required login strings", () => {
        expect(AppStrings.AuthStrings.Login.TITLE).toBe("Log in");
        expect(AppStrings.AuthStrings.Login.EMAIL_LABEL).toBe("Email");
        expect(AppStrings.AuthStrings.Login.EMAIL_PLACEHOLDER).toBe(
          "Enter your email"
        );
        expect(AppStrings.AuthStrings.Login.PASSWORD_LABEL).toBe("Password");
        expect(AppStrings.AuthStrings.Login.PASSWORD_PLACEHOLDER).toBe(
          "Enter your password"
        );
        expect(AppStrings.AuthStrings.Login.FORGOT_PASSWORD).toBe(
          "Forgot password?"
        );
        expect(AppStrings.AuthStrings.Login.LOGIN_BUTTON).toBe("Log In");
      });

      it("should have social login strings", () => {
        expect(AppStrings.AuthStrings.Login.CONTINUE_WITH_GOOGLE).toBe(
          "Continue with Google"
        );
        expect(AppStrings.AuthStrings.Login.CONTINUE_WITH_FACEBOOK).toBe(
          "Continue with Facebook"
        );
        expect(AppStrings.AuthStrings.Login.OR_LOGIN_WITH).toBe(
          "Or login with"
        );
      });

      it("should have error messages", () => {
        expect(AppStrings.AuthStrings.Login.INVALID_EMAIL_FORMAT_ERROR).toBe(
          "Invalid email format ✗"
        );
        expect(AppStrings.AuthStrings.Login.USER_NOT_FOUND_ERROR).toBe(
          "User not found. Please check your email."
        );
        expect(AppStrings.AuthStrings.Login.WRONG_PASSWORD_ERROR).toBe(
          "Incorrect password. Please try again."
        );
        expect(AppStrings.AuthStrings.Login.USER_DISABLED_ERROR).toBe(
          "This account has been disabled."
        );
      });

      it("should have all strings as non-empty values", () => {
        Object.values(AppStrings.AuthStrings.Login).forEach((value) => {
          expect(typeof value).toBe("string");
          expect(value.length).toBeGreaterThan(0);
        });
      });
    });

    describe("SignUp", () => {
      it("should have all required signup strings", () => {
        expect(AppStrings.AuthStrings.SignUp.TITLE).toBe("Create your account");
        expect(AppStrings.AuthStrings.SignUp.USERNAME_LABEL).toBe("Username");
        expect(AppStrings.AuthStrings.SignUp.EMAIL_LABEL).toBe("Email");
        expect(AppStrings.AuthStrings.SignUp.PASSWORD_LABEL).toBe("Password");
        expect(AppStrings.AuthStrings.SignUp.CONFIRM_PASSWORD_LABEL).toBe(
          "Confirm Password"
        );
      });

      it("should have validation messages", () => {
        expect(AppStrings.AuthStrings.SignUp.PASSWORD_DOES_NOT_MATCH).toBe(
          "Passwords do not match ✗"
        );
        expect(
          AppStrings.AuthStrings.SignUp.PASSWORD_DOES_NOT_LONG_ENOUGH
        ).toBe("Password is too short ✗");
        expect(AppStrings.AuthStrings.SignUp.PASSWORD_VALIDATION_GOOD).toBe(
          "Passwords match ✓"
        );
      });

      it("should have terms agreement strings", () => {
        expect(AppStrings.AuthStrings.SignUp.TERMS_AGREEMENT_PART1).toBe(
          "I agree to the "
        );
        expect(AppStrings.AuthStrings.SignUp.TERMS_USER_AGREEMENT).toBe(
          "user agreement"
        );
        expect(AppStrings.AuthStrings.SignUp.TERMS_AGREEMENT_PART2).toBe(
          " and "
        );
        expect(AppStrings.AuthStrings.SignUp.TERMS_PRIVACY_POLICY).toBe(
          "privacy policy"
        );
      });

      it("should have all strings as non-empty values", () => {
        Object.values(AppStrings.AuthStrings.SignUp).forEach((value) => {
          expect(typeof value).toBe("string");
          expect(value.length).toBeGreaterThan(0);
        });
      });
    });

    describe("NewPassword", () => {
      it("should have all required new password strings", () => {
        expect(AppStrings.AuthStrings.NewPassword.TITLE).toBe(
          "Set New Password"
        );
        expect(
          AppStrings.AuthStrings.NewPassword.NEW_PASSWORD_DESCRIPTION
        ).toBe("Reset your password to recovery & login to your account.");
        expect(AppStrings.AuthStrings.NewPassword.NEW_PASSWORD_LABEL).toBe(
          "New Password"
        );
        expect(AppStrings.AuthStrings.NewPassword.SET_PASSWORD_BUTTON).toBe(
          "Confirm"
        );
      });

      it("should have all strings as non-empty values", () => {
        Object.values(AppStrings.AuthStrings.NewPassword).forEach((value) => {
          expect(typeof value).toBe("string");
          expect(value.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe("Navigation", () => {
    it("should have all navigation route names", () => {
      expect(AppStrings.Navigation.LOGIN).toBe("Login");
      expect(AppStrings.Navigation.SIGN_UP).toBe("SignUp");
      expect(AppStrings.Navigation.LANDING).toBe("Landing");
      expect(AppStrings.Navigation.FORGOT_PASSWORD).toBe("ForgotPassword");
      expect(AppStrings.Navigation.NEW_PASSWORD).toBe("NewPassword");
      expect(AppStrings.Navigation.GAME).toBe("Game");
      expect(AppStrings.Navigation.CREDITS).toBe("Credits");
    });

    it("should have button labels", () => {
      expect(AppStrings.Navigation.PLAY_BUTTON).toBe("Play");
      expect(AppStrings.Navigation.PROFILE_BUTTON).toBe("Profile");
      expect(AppStrings.Navigation.SETTINGS_BUTTON).toBe("Settings");
      expect(AppStrings.Navigation.HINT_BUTTON).toBe("Hint");
    });

    it("should have all strings as non-empty values", () => {
      Object.values(AppStrings.Navigation).forEach((value) => {
        expect(typeof value).toBe("string");
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });

  describe("NavigationMessages", () => {
    it("should have error and informational messages", () => {
      expect(AppStrings.NavigationMessages.NO_CLASSIC_RIDDLE_FOUND).toBe(
        "⚠️ No classic riddle found at index "
      );
      expect(AppStrings.NavigationMessages.SERVER_GENERATES_RIDDLES).toBe(
        ". Server will generate new riddles automatically when you submit guesses."
      );
      expect(AppStrings.NavigationMessages.ERROR_LOADING_NEXT_RIDDLE).toBe(
        "Error loading next classic riddle:"
      );
    });

    it("should have all strings as non-empty values", () => {
      Object.values(AppStrings.NavigationMessages).forEach((value) => {
        expect(typeof value).toBe("string");
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Settings", () => {
    it("should have settings screen strings", () => {
      expect(AppStrings.Settings.TITLE).toBe("Settings");
      expect(AppStrings.Settings.SOUND_TOGGLE).toBe("Sound");
      expect(AppStrings.Settings.HAPTICS_TOGGLE).toBe("Haptics");
      expect(AppStrings.Settings.HELP_BUTTON).toBe("Help");
      expect(AppStrings.Settings.LOGOUT_BUTTON).toBe("Logout");
      expect(AppStrings.Settings.CREDITS_BUTTON).toBe("Credits");
      expect(AppStrings.Settings.CLOSE_BUTTON).toBe("Close");
    });

    it("should have test crash functionality strings", () => {
      expect(AppStrings.Settings.TEST_CRASH_BUTTON).toBe("Test Crash");
      expect(AppStrings.Settings.TEST_CRASH_ALERT_TITLE).toBe("Test Crash");
      expect(AppStrings.Settings.TEST_CRASH_ALERT_CANCEL).toBe("Cancel");
      expect(AppStrings.Settings.TEST_CRASH_ALERT_CRASH).toBe("Crash");
    });

    it("should have all strings as non-empty values", () => {
      Object.values(AppStrings.Settings).forEach((value) => {
        expect(typeof value).toBe("string");
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Credits", () => {
    it("should have credits screen strings", () => {
      expect(AppStrings.Credits.TITLE).toBe("Credits");
      expect(AppStrings.Credits.SUBTITLE).toBe(
        "Meet the amazing team behind Qwordly"
      );
      expect(AppStrings.Credits.THANK_YOU_TITLE).toBe("Thank You!");
      expect(AppStrings.Credits.THANK_YOU_TEXT).toBe(
        "Special thanks to all our contributors who made Qwordly possible. Your creativity, dedication, and passion brought this project to life."
      );
    });

    it("should have all strings as non-empty values", () => {
      Object.values(AppStrings.Credits).forEach((value) => {
        expect(typeof value).toBe("string");
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Profile", () => {
    it("should have profile screen strings", () => {
      expect(AppStrings.Profile.TITLE).toBe("Profile");
      expect(AppStrings.Profile.USERNAME_LABEL).toBe("Username:");
      expect(AppStrings.Profile.SAVE_BUTTON).toBe("Save");
      expect(AppStrings.Profile.EDIT_BUTTON).toBe("Edit");
      expect(AppStrings.Profile.LOADING_MESSAGE).toBe(
        "Loading profile data..."
      );
    });

    it("should have stats strings", () => {
      expect(AppStrings.Profile.STATS_TITLE).toBe("Stats");
      expect(AppStrings.Profile.DAILY_PUZZLES_STAT).toBe("Daily Puzzles");
      expect(AppStrings.Profile.BEST_STREAK_STAT).toBe("Best Streak");
      expect(AppStrings.Profile.WORDS_GUESSED_STAT).toBe("Words Guessed");
      expect(AppStrings.Profile.WIN_RATE_STAT).toBe("Win Rate");
      expect(AppStrings.Profile.AVG_GUESSES_STAT).toBe("Avg. Guesses");
    });

    it("should have avatar functionality strings", () => {
      expect(AppStrings.Profile.CHANGE_AVATAR_TITLE).toBe("Change Avatar");
      expect(AppStrings.Profile.SELECT_PRELOADED_AVATAR_SUBTITLE).toBe(
        "Select a Preloaded Avatar:"
      );
      expect(AppStrings.Profile.UPLOAD_CUSTOM_AVATAR_SUBTITLE).toBe(
        "Or Upload Your Own:"
      );
      expect(AppStrings.Profile.CHOOSE_FROM_GALLERY_BUTTON).toBe(
        "Choose from Gallery"
      );
    });

    it("should have all strings as non-empty values", () => {
      Object.values(AppStrings.Profile).forEach((value) => {
        expect(typeof value).toBe("string");
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });

  describe("TestStrings", () => {
    it("should have test strings", () => {
      expect(AppStrings.TestStrings.MOCK_SVG_TEXT).toBe("Mock SVG Text");
    });

    it("should have all strings as non-empty values", () => {
      Object.values(AppStrings.TestStrings).forEach((value) => {
        expect(typeof value).toBe("string");
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });

  describe("RewardedAdPrompts", () => {
    it("should have rewarded ad strings", () => {
      expect(AppStrings.RewardedAdPrompts.OUT_OF_GUESSES_PROMPT).toBe(
        "You're out of guesses! Watch an ad to earn some coins?"
      );
      expect(AppStrings.RewardedAdPrompts.WATCH_AD_BUTTON).toBe("Watch Ad");
      expect(AppStrings.RewardedAdPrompts.NO_THANKS_BUTTON).toBe("No Thanks");
    });

    it("should have all strings as non-empty values", () => {
      Object.values(AppStrings.RewardedAdPrompts).forEach((value) => {
        expect(typeof value).toBe("string");
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });

  describe("ErrorMessages", () => {
    it("should have error messages", () => {
      expect(AppStrings.ErrorMessages.UNABLE_TO_LOAD_RIDDLES).toBe(
        "Unable to load any riddles. Please check your connection and try again."
      );
    });

    it("should have all strings as non-empty values", () => {
      Object.values(AppStrings.ErrorMessages).forEach((value) => {
        expect(typeof value).toBe("string");
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });

  describe("GameMessages", () => {
    it("should have game messages", () => {
      expect(AppStrings.GameMessages.GAME_WON).toBe("Game Won: Attempts - ");
      expect(AppStrings.GameMessages.IN_MODE).toBe(" in ");
      expect(AppStrings.GameMessages.MODE_SUFFIX).toBe(" mode.");
      expect(AppStrings.GameMessages.COINS_EARNED).toBe("Coins Earned: ");
      expect(AppStrings.GameMessages.GAME_LOST).toBe(
        "Game Lost: Correct Answer - "
      );
      expect(AppStrings.GameMessages.HINT_USED).toBe("Hint Used: Cost - ");
      expect(AppStrings.GameMessages.RETRY_BUTTON_PRESSED).toBe(
        "Retry button pressed"
      );
    });

    it("should have all strings as non-empty values", () => {
      Object.values(AppStrings.GameMessages).forEach((value) => {
        expect(typeof value).toBe("string");
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });

  describe("LogMessages", () => {
    it("should have log messages", () => {
      expect(AppStrings.LogMessages.SHOWING_LOADING_SPINNER_USER_DATA).toBe(
        "⏳ Showing loading spinner - Loading user data..."
      );
      expect(AppStrings.LogMessages.TIMESTAMP).toBe("timestamp:");
      expect(AppStrings.LogMessages.SHOWING_LOADING_SPINNER_AUTH).toBe(
        "⏳ Showing loading spinner - authentication state being determined"
      );
      expect(AppStrings.LogMessages.NAVIGATION_RENDERING).toBe(
        "🧭 Navigation rendering - isAuthenticated:"
      );
      expect(AppStrings.LogMessages.IS_LOADING).toBe("isLoading:");
      expect(AppStrings.LogMessages.SHOWING_NAVIGATION_STACK).toBe(
        "🎯 Showing navigation stack - initialRoute:"
      );
    });

    it("should have all strings as non-empty values", () => {
      Object.values(AppStrings.LogMessages).forEach((value) => {
        expect(typeof value).toBe("string");
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });

  describe("GameScreenAlerts", () => {
    it("should have game screen alert strings", () => {
      expect(AppStrings.GameScreenAlerts.SUBMIT_GUESS_ERROR_TITLE).toBe(
        "Error"
      );
      expect(AppStrings.GameScreenAlerts.SUBMIT_GUESS_ERROR_MESSAGE).toBe(
        "Could not submit guess. Please try again."
      );
      expect(AppStrings.GameScreenAlerts.NOT_ENOUGH_COINS_TITLE).toBe(
        "Not enough coins"
      );
      expect(AppStrings.GameScreenAlerts.NOT_ENOUGH_COINS_MESSAGE).toBe(
        "You need more coins to use a hint."
      );
      expect(AppStrings.GameScreenAlerts.HINT_ERROR_TITLE).toBe("Error");
    });

    it("should have all strings as non-empty values", () => {
      Object.values(AppStrings.GameScreenAlerts).forEach((value) => {
        expect(typeof value).toBe("string");
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });

  describe("AppStrings Structure", () => {
    it("should be readonly (as const)", () => {
      // This test ensures the object is properly typed as const
      expect(typeof AppStrings).toBe("object");
      expect(AppStrings).toBeDefined();
    });

    it("should have all main sections", () => {
      expect(AppStrings.AuthStrings).toBeDefined();
      expect(AppStrings.Navigation).toBeDefined();
      expect(AppStrings.NavigationMessages).toBeDefined();
      expect(AppStrings.Settings).toBeDefined();
      expect(AppStrings.Profile).toBeDefined();
      expect(AppStrings.TestStrings).toBeDefined();
      expect(AppStrings.RewardedAdPrompts).toBeDefined();
      expect(AppStrings.ErrorMessages).toBeDefined();
      expect(AppStrings.GameMessages).toBeDefined();
      expect(AppStrings.LogMessages).toBeDefined();
      expect(AppStrings.GameScreenAlerts).toBeDefined();
    });

    it("should have consistent structure for auth strings", () => {
      expect(AppStrings.AuthStrings.Landing).toBeDefined();
      expect(AppStrings.AuthStrings.Login).toBeDefined();
      expect(AppStrings.AuthStrings.SignUp).toBeDefined();
      expect(AppStrings.AuthStrings.NewPassword).toBeDefined();
    });
  });
});
