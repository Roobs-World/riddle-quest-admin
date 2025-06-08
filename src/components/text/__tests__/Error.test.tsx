import React from "react";
import { render } from "@testing-library/react-native";
import Error from "../Error";

// Mock styles
jest.mock("../../../styles", () => ({
  styles: {
    errorText: {},
  },
}));

describe("Error", () => {
  describe("Rendering", () => {
    it("renders correctly with error message", () => {
      const errorMessage = "This is an error message";
      const { getByText } = render(<Error message={errorMessage} />);

      expect(getByText(errorMessage)).toBeTruthy();
    });

    it("renders with different error messages", () => {
      const messages = [
        "Email is required",
        "Password must be at least 8 characters",
        "Network error occurred",
        "Invalid credentials",
        "User not found",
      ];

      messages.forEach((message) => {
        const { getByText } = render(<Error message={message} />);
        expect(getByText(message)).toBeTruthy();
      });
    });

    it("renders with empty error message", () => {
      const { getByText } = render(<Error message="" />);
      expect(getByText("")).toBeTruthy();
    });

    it("renders with special characters in error message", () => {
      const specialMessage = "Error: Something went wrong! @#$%^&*()";
      const { getByText } = render(<Error message={specialMessage} />);
      expect(getByText(specialMessage)).toBeTruthy();
    });

    it("renders with multiline error message", () => {
      const multilineMessage = "Line 1\nLine 2\nLine 3";
      const { getByText } = render(<Error message={multilineMessage} />);
      expect(getByText(multilineMessage)).toBeTruthy();
    });
  });

  describe("Text Properties", () => {
    it("renders as Text component", () => {
      const { UNSAFE_getByType } = render(<Error message="Test error" />);
      const Text = require("react-native").Text;
      expect(UNSAFE_getByType(Text)).toBeTruthy();
    });

    it("applies correct text style", () => {
      const { getByText } = render(<Error message="Test error" />);
      const errorText = getByText("Test error");

      // Check if the component applies the correct style classes
      expect(errorText.props.className).toContain("text-red-500");
      expect(errorText.props.className).toContain("text-center");
      expect(errorText.props.className).toContain("mb-4");
    });

    it("has proper accessibility role", () => {
      const { getByText } = render(<Error message="Test error" />);
      const errorText = getByText("Test error");

      expect(errorText.props.role).toBe("alert");
    });
  });

  describe("Accessibility", () => {
    it("provides accessible text for screen readers", () => {
      const errorMessage = "Invalid input provided";
      const { getByText } = render(<Error message={errorMessage} />);
      const errorElement = getByText(errorMessage);

      // Error text should be accessible
      expect(errorElement).toBeTruthy();
      expect(errorElement.props.children).toBe(errorMessage);
    });

    it("maintains text semantics for assistive technology", () => {
      const { UNSAFE_getByType } = render(<Error message="Error text" />);
      const Text = require("react-native").Text;
      const textElement = UNSAFE_getByType(Text);

      // Should render as a Text component for proper semantics
      expect(textElement).toBeTruthy();
    });

    it("has alert role for screen readers", () => {
      const { getByRole } = render(<Error message="Alert message" />);
      expect(getByRole("alert")).toBeTruthy();
    });
  });

  describe("Performance", () => {
    it("re-renders correctly when message prop changes", () => {
      const { rerender, getByText } = render(<Error message="Initial error" />);

      expect(getByText("Initial error")).toBeTruthy();

      rerender(<Error message="Updated error" />);
      expect(getByText("Updated error")).toBeTruthy();
    });

    it("handles rapid message updates", () => {
      const { rerender } = render(<Error message="Error 1" />);

      // Rapid updates should not throw errors
      for (let i = 2; i <= 10; i++) {
        rerender(<Error message={`Error ${i}`} />);
      }

      expect(true).toBe(true); // Test passes if no errors thrown
    });
  });

  describe("Component Structure", () => {
    it("maintains consistent component structure", () => {
      const { getByText } = render(<Error message="Test" />);
      const errorElement = getByText("Test");

      // Should be a single Text element
      expect(errorElement).toBeTruthy();
      expect(errorElement.type).toBe("Text");
    });

    it("applies custom styles correctly", () => {
      const { getByText } = render(<Error message="Styled error" />);
      const errorElement = getByText("Styled error");

      // Should have the style prop applied
      expect(errorElement.props.style).toBeDefined();
    });
  });

  describe("Content Validation", () => {
    it("renders exact message content", () => {
      const testMessage = "Exact content validation";
      const { getByText } = render(<Error message={testMessage} />);

      const errorElement = getByText(testMessage);
      expect(errorElement.props.children).toBe(testMessage);
    });

    it("handles long error messages", () => {
      const longMessage =
        "This is a very long error message that might wrap to multiple lines in the UI and should still be rendered correctly without any issues.";
      const { getByText } = render(<Error message={longMessage} />);

      expect(getByText(longMessage)).toBeTruthy();
    });

    it("handles short error messages", () => {
      const shortMessage = "X";
      const { getByText } = render(<Error message={shortMessage} />);

      expect(getByText(shortMessage)).toBeTruthy();
    });
  });
});
