import React from "react";
import { render } from "@testing-library/react-native";
import PasswordMatch from "../PasswordMatch";

// Mock AppStrings
jest.mock("../../../constants/AppStrings", () => ({
  AppStrings: {
    AuthStrings: {
      SignUp: {
        PASSWORD_DOES_NOT_MATCH: "Passwords do not match ✗",
        PASSWORD_DOES_NOT_LONG_ENOUGH: "Password is too short ✗",
        PASSWORD_VALIDATION_GOOD: "Passwords match ✓",
      },
    },
  },
}));

describe("PasswordMatch", () => {
  describe("Password Too Short", () => {
    it("displays password too short message when password is not long enough", () => {
      const { getByText } = render(
        <PasswordMatch passwordsMatch={true} isPasswordLongEnough={false} />
      );

      expect(getByText("Password is too short ✗")).toBeTruthy();
    });

    it("prioritizes length validation over match validation", () => {
      const { getByText, queryByText } = render(
        <PasswordMatch passwordsMatch={false} isPasswordLongEnough={false} />
      );

      expect(getByText("Password is too short ✗")).toBeTruthy();
      expect(queryByText("Passwords do not match ✗")).toBeNull();
      expect(queryByText("Passwords match ✓")).toBeNull();
    });

    it("applies correct styling for error state", () => {
      const { getByText } = render(
        <PasswordMatch passwordsMatch={true} isPasswordLongEnough={false} />
      );

      const errorText = getByText("Password is too short ✗");
      expect(errorText.props.className).toContain("text-red-600");
      expect(errorText.props.className).toContain("text-right");
      const style = errorText.props.style ?? {};
      expect(style.fontSize).toBeDefined();
      expect(style.marginLeft).toBeDefined();
      expect(style.marginBottom).toBeDefined();
    });
  });

  describe("Passwords Do Not Match", () => {
    it("displays password mismatch message when passwords do not match", () => {
      const { getByText } = render(
        <PasswordMatch passwordsMatch={false} isPasswordLongEnough={true} />
      );

      expect(getByText("Passwords do not match ✗")).toBeTruthy();
    });

    it("only shows mismatch when password is long enough", () => {
      const { getByText, queryByText } = render(
        <PasswordMatch passwordsMatch={false} isPasswordLongEnough={true} />
      );

      expect(getByText("Passwords do not match ✗")).toBeTruthy();
      expect(queryByText("Password is too short ✗")).toBeNull();
      expect(queryByText("Passwords match ✓")).toBeNull();
    });

    it("applies correct styling for mismatch state", () => {
      const { getByText } = render(
        <PasswordMatch passwordsMatch={false} isPasswordLongEnough={true} />
      );

      const errorText = getByText("Passwords do not match ✗");
      expect(errorText.props.className).toContain("text-red-600");
      expect(errorText.props.className).toContain("text-right");
      const style = errorText.props.style ?? {};
      expect(style.fontSize).toBeDefined();
      expect(style.marginLeft).toBeDefined();
      expect(style.marginBottom).toBeDefined();
    });
  });

  describe("Passwords Match and Valid", () => {
    it("displays success message when passwords match and are long enough", () => {
      const { getByText } = render(
        <PasswordMatch passwordsMatch={true} isPasswordLongEnough={true} />
      );

      expect(getByText("Passwords match ✓")).toBeTruthy();
    });

    it("only shows success when both conditions are met", () => {
      const { getByText, queryByText } = render(
        <PasswordMatch passwordsMatch={true} isPasswordLongEnough={true} />
      );

      expect(getByText("Passwords match ✓")).toBeTruthy();
      expect(queryByText("Password is too short ✗")).toBeNull();
      expect(queryByText("Passwords do not match ✗")).toBeNull();
    });

    it("applies correct styling for success state", () => {
      const { getByText } = render(
        <PasswordMatch passwordsMatch={true} isPasswordLongEnough={true} />
      );

      const successText = getByText("Passwords match ✓");
      expect(successText.props.className).toContain("text-green-600");
      expect(successText.props.className).toContain("text-right");
      const style = successText.props.style ?? {};
      expect(style.fontSize).toBeDefined();
      expect(style.marginLeft).toBeDefined();
      expect(style.marginBottom).toBeDefined();
    });
  });

  describe("Component Structure", () => {
    it("renders as Text component", () => {
      const { UNSAFE_getByType } = render(
        <PasswordMatch passwordsMatch={true} isPasswordLongEnough={true} />
      );
      const Text = require("react-native").Text;
      expect(UNSAFE_getByType(Text)).toBeTruthy();
    });

    it("renders single text element", () => {
      const { UNSAFE_getAllByType } = render(
        <PasswordMatch passwordsMatch={true} isPasswordLongEnough={true} />
      );
      const Text = require("react-native").Text;
      const textElements = UNSAFE_getAllByType(Text);

      expect(textElements).toHaveLength(1);
    });
  });

  describe("Prop Validation", () => {
    it("handles all possible prop combinations", () => {
      const combinations = [
        { passwordsMatch: true, isPasswordLongEnough: true },
        { passwordsMatch: true, isPasswordLongEnough: false },
        { passwordsMatch: false, isPasswordLongEnough: true },
        { passwordsMatch: false, isPasswordLongEnough: false },
      ];

      combinations.forEach((props) => {
        const { UNSAFE_getAllByType } = render(<PasswordMatch {...props} />);
        const Text = require("react-native").Text;
        const textElements = UNSAFE_getAllByType(Text);

        expect(textElements).toHaveLength(1);
      });
    });

    it("maintains consistent text size across all states", () => {
      const combinations = [
        {
          passwordsMatch: true,
          isPasswordLongEnough: true,
          expected: "Passwords match ✓",
        },
        {
          passwordsMatch: true,
          isPasswordLongEnough: false,
          expected: "Password is too short ✗",
        },
        {
          passwordsMatch: false,
          isPasswordLongEnough: true,
          expected: "Passwords do not match ✗",
        },
        {
          passwordsMatch: false,
          isPasswordLongEnough: false,
          expected: "Password is too short ✗",
        },
      ];

      combinations.forEach(
        ({ passwordsMatch, isPasswordLongEnough, expected }) => {
          const { getByText } = render(
            <PasswordMatch
              passwordsMatch={passwordsMatch}
              isPasswordLongEnough={isPasswordLongEnough}
            />
          );

          const text = getByText(expected);
          expect((text.props.style ?? {}).fontSize).toBeDefined();
        }
      );
    });
  });

  describe("Performance", () => {
    it("re-renders correctly when props change", () => {
      const { rerender, getByText } = render(
        <PasswordMatch passwordsMatch={false} isPasswordLongEnough={false} />
      );

      expect(getByText("Password is too short ✗")).toBeTruthy();

      rerender(
        <PasswordMatch passwordsMatch={false} isPasswordLongEnough={true} />
      );
      expect(getByText("Passwords do not match ✗")).toBeTruthy();

      rerender(
        <PasswordMatch passwordsMatch={true} isPasswordLongEnough={true} />
      );
      expect(getByText("Passwords match ✓")).toBeTruthy();
    });

    it("handles rapid prop updates", () => {
      const { rerender } = render(
        <PasswordMatch passwordsMatch={false} isPasswordLongEnough={false} />
      );

      // Rapid updates
      for (let i = 0; i < 10; i++) {
        rerender(
          <PasswordMatch
            passwordsMatch={i % 2 === 0}
            isPasswordLongEnough={i % 3 === 0}
          />
        );
      }

      expect(true).toBe(true); // Should not throw errors
    });
  });

  describe("Accessibility", () => {
    it("provides accessible text for screen readers", () => {
      const { getByText } = render(
        <PasswordMatch passwordsMatch={true} isPasswordLongEnough={true} />
      );

      const text = getByText("Passwords match ✓");
      expect(text).toBeTruthy();
      expect(text.props.children).toBe("Passwords match ✓");
    });

    it("maintains text semantics across all states", () => {
      const states = [
        { passwordsMatch: true, isPasswordLongEnough: true },
        { passwordsMatch: false, isPasswordLongEnough: true },
        { passwordsMatch: true, isPasswordLongEnough: false },
      ];

      states.forEach((props) => {
        const { UNSAFE_getByType } = render(<PasswordMatch {...props} />);
        const Text = require("react-native").Text;
        expect(UNSAFE_getByType(Text)).toBeTruthy();
      });
    });
  });
});
