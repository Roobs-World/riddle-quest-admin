import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import UserEmailInput from "../UserEmailInput";

// Mock the shared components with simpler mocks
jest.mock("../../shared/ReusableTextInput", () => {
  const React = require("react");
  const { View, Text } = require("react-native");

  const MockReusableTextInput = ({
    value,
    onChangeText,
    placeholder,
    keyboardType,
    autoCapitalize,
    ...props
  }: any) => (
    <View testID="email-input-container">
      <Text
        testID="email-input"
        onPress={() => onChangeText && onChangeText(value)}
      >
        {value || placeholder}
      </Text>
    </View>
  );

  MockReusableTextInput.displayName = "MockReusableTextInput";
  return MockReusableTextInput;
});

jest.mock("../../text/Error", () => {
  const React = require("react");
  const { Text } = require("react-native");

  const MockError = ({ message }: any) =>
    message ? <Text testID="error-message">{message}</Text> : null;

  MockError.displayName = "MockError";
  return MockError;
});

// Mock AppStrings
jest.mock("../../../constants/AppStrings", () => ({
  AppStrings: {
    AuthStrings: {
      Login: {
        EMAIL_LABEL: "Email Address",
        EMAIL_PLACEHOLDER: "Enter your email",
      },
    },
  },
}));

// Mock styles
jest.mock("../../../styles", () => ({
  styles: {
    labelText: {},
  },
}));

describe("UserEmailInput", () => {
  const mockSetEmail = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders correctly with required props", () => {
      const { getByText, getByTestId } = render(
        <UserEmailInput email="" setEmail={mockSetEmail} />
      );

      expect(getByText("Email Address")).toBeTruthy();
      expect(getByTestId("email-input-container")).toBeTruthy();
    });

    it("displays the correct label text", () => {
      const { getByText } = render(
        <UserEmailInput email="" setEmail={mockSetEmail} />
      );

      expect(getByText("Email Address")).toBeTruthy();
    });

    it("displays current email value", () => {
      const testEmail = "test@example.com";
      const { getByText } = render(
        <UserEmailInput email={testEmail} setEmail={mockSetEmail} />
      );

      expect(getByText(testEmail)).toBeTruthy();
    });

    it("displays placeholder when email is empty", () => {
      const { getByText } = render(
        <UserEmailInput email="" setEmail={mockSetEmail} />
      );

      expect(getByText("Enter your email")).toBeTruthy();
    });
  });

  describe("Error Handling", () => {
    it("does not show error when errorMessage is not provided", () => {
      const { queryByTestId } = render(
        <UserEmailInput email="" setEmail={mockSetEmail} />
      );

      expect(queryByTestId("error-message")).toBeNull();
    });

    it("does not show error when errorMessage is null", () => {
      const { queryByTestId } = render(
        <UserEmailInput email="" setEmail={mockSetEmail} errorMessage={null} />
      );

      expect(queryByTestId("error-message")).toBeNull();
    });

    it("shows error when errorMessage is provided", () => {
      const errorMessage = "Invalid email format";
      const { getByTestId } = render(
        <UserEmailInput
          email=""
          setEmail={mockSetEmail}
          errorMessage={errorMessage}
        />
      );

      const errorElement = getByTestId("error-message");
      expect(errorElement).toBeTruthy();
      expect(errorElement.props.children).toBe(errorMessage);
    });

    it("displays different error messages correctly", () => {
      const errors = [
        "Email is required",
        "Invalid email format",
        "Email already exists",
        "Please enter a valid email address",
      ];

      errors.forEach((error) => {
        const { getByTestId } = render(
          <UserEmailInput
            email=""
            setEmail={mockSetEmail}
            errorMessage={error}
          />
        );

        const errorElement = getByTestId("error-message");
        expect(errorElement.props.children).toBe(error);
      });
    });
  });

  describe("User Interactions", () => {
    it("calls setEmail when input is interacted with", () => {
      const { getByTestId } = render(
        <UserEmailInput email="" setEmail={mockSetEmail} />
      );

      const input = getByTestId("email-input");
      fireEvent.press(input);

      expect(mockSetEmail).toHaveBeenCalled();
    });
  });

  describe("Component Structure", () => {
    it("renders main container", () => {
      const { UNSAFE_getAllByType } = render(
        <UserEmailInput email="" setEmail={mockSetEmail} />
      );

      const View = require("react-native").View;
      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it("renders label text", () => {
      const { getByText } = render(
        <UserEmailInput email="" setEmail={mockSetEmail} />
      );

      expect(getByText("Email Address")).toBeTruthy();
    });

    it("renders ReusableTextInput component", () => {
      const { getByTestId } = render(
        <UserEmailInput email="" setEmail={mockSetEmail} />
      );

      expect(getByTestId("email-input-container")).toBeTruthy();
    });
  });

  describe("Performance", () => {
    it("re-renders correctly when email prop changes", () => {
      const { rerender, queryByText, getByText } = render(
        <UserEmailInput email="" setEmail={mockSetEmail} />
      );

      expect(getByText("Enter your email")).toBeTruthy();

      rerender(
        <UserEmailInput email="updated@example.com" setEmail={mockSetEmail} />
      );

      expect(getByText("updated@example.com")).toBeTruthy();
      expect(queryByText("Enter your email")).toBeNull();
    });

    it("re-renders correctly when errorMessage changes", () => {
      const { rerender, queryByTestId, getByTestId } = render(
        <UserEmailInput email="" setEmail={mockSetEmail} />
      );

      expect(queryByTestId("error-message")).toBeNull();

      rerender(
        <UserEmailInput
          email=""
          setEmail={mockSetEmail}
          errorMessage="New error"
        />
      );

      const errorElement = getByTestId("error-message");
      expect(errorElement.props.children).toBe("New error");
    });

    it("handles rapid prop updates", () => {
      const { rerender } = render(
        <UserEmailInput email="" setEmail={mockSetEmail} />
      );

      // Rapid updates
      for (let i = 0; i < 10; i++) {
        rerender(
          <UserEmailInput
            email={`test${i}@example.com`}
            setEmail={mockSetEmail}
            errorMessage={i % 2 === 0 ? `Error ${i}` : undefined}
          />
        );
      }

      expect(true).toBe(true); // Should not throw errors
    });
  });

  describe("Edge Cases", () => {
    it("handles empty email string", () => {
      const { getByText } = render(
        <UserEmailInput email="" setEmail={mockSetEmail} />
      );

      expect(getByText("Enter your email")).toBeTruthy();
    });

    it("handles long email addresses", () => {
      const longEmail =
        "very.long.email.address.that.might.overflow@example.com";
      const { getByText } = render(
        <UserEmailInput email={longEmail} setEmail={mockSetEmail} />
      );

      expect(getByText(longEmail)).toBeTruthy();
    });

    it("handles special characters in email", () => {
      const specialEmail = "test+special.chars@sub-domain.example.com";
      const { getByText } = render(
        <UserEmailInput email={specialEmail} setEmail={mockSetEmail} />
      );

      expect(getByText(specialEmail)).toBeTruthy();
    });

    it("handles empty error message string", () => {
      const { queryByTestId } = render(
        <UserEmailInput email="" setEmail={mockSetEmail} errorMessage="" />
      );

      // Empty string should not show error component
      expect(queryByTestId("error-message")).toBeNull();
    });

    it("handles undefined error message", () => {
      const { queryByTestId } = render(
        <UserEmailInput
          email=""
          setEmail={mockSetEmail}
          errorMessage={undefined}
        />
      );

      expect(queryByTestId("error-message")).toBeNull();
    });
  });

  describe("Props Validation", () => {
    it("works with all required props", () => {
      expect(() => {
        render(<UserEmailInput email="" setEmail={mockSetEmail} />);
      }).not.toThrow();
    });

    it("works with optional errorMessage prop", () => {
      expect(() => {
        render(
          <UserEmailInput
            email=""
            setEmail={mockSetEmail}
            errorMessage="Test error"
          />
        );
      }).not.toThrow();
    });
  });
});
