import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import UserPasswordInput from "../UserPasswordInput";

// Mock the shared components
jest.mock("../../shared/ReusableTextInput", () => {
  const React = require("react");
  const { View, Text } = require("react-native");

  const MockReusableTextInput = ({
    value,
    onChangeText,
    placeholder,
    secureTextEntry,
    ...props
  }: any) => (
    <View testID="password-input-container">
      <Text
        testID="password-input"
        onPress={() => onChangeText && onChangeText(value)}
      >
        {secureTextEntry && value ? "••••••••" : value || placeholder}
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
        PASSWORD_LABEL: "Password",
        PASSWORD_PLACEHOLDER: "Enter your password",
      },
    },
  },
}));

// Mock styles
jest.mock("../../../styles", () => ({
  styles: {
    labelText: {},
  },
  SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, "2xl": 48 },
}));

describe("UserPasswordInput", () => {
  const mockSetPassword = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders correctly with required props", () => {
      const { getByText, getByTestId } = render(
        <UserPasswordInput password="" setPassword={mockSetPassword} />
      );

      expect(getByText("Password")).toBeTruthy();
      expect(getByTestId("password-input-container")).toBeTruthy();
    });

    it("displays the correct label text", () => {
      const { getByText } = render(
        <UserPasswordInput password="" setPassword={mockSetPassword} />
      );

      expect(getByText("Password")).toBeTruthy();
    });

    it("displays current password value as masked", () => {
      const testPassword = "mypassword123";
      const { getByText } = render(
        <UserPasswordInput
          password={testPassword}
          setPassword={mockSetPassword}
        />
      );

      expect(getByText("••••••••")).toBeTruthy();
    });

    it("displays placeholder when password is empty", () => {
      const { getByText } = render(
        <UserPasswordInput password="" setPassword={mockSetPassword} />
      );

      expect(getByText("Enter your password")).toBeTruthy();
    });
  });

  describe("Error Handling", () => {
    it("does not show error when errorMessage is not provided", () => {
      const { queryByTestId } = render(
        <UserPasswordInput password="" setPassword={mockSetPassword} />
      );

      expect(queryByTestId("error-message")).toBeNull();
    });

    it("does not show error when errorMessage is null", () => {
      const { queryByTestId } = render(
        <UserPasswordInput
          password=""
          setPassword={mockSetPassword}
          errorMessage={null}
        />
      );

      expect(queryByTestId("error-message")).toBeNull();
    });

    it("shows error when errorMessage is provided", () => {
      const errorMessage = "Password too short";
      const { getByTestId } = render(
        <UserPasswordInput
          password=""
          setPassword={mockSetPassword}
          errorMessage={errorMessage}
        />
      );

      const errorElement = getByTestId("error-message");
      expect(errorElement).toBeTruthy();
      expect(errorElement.props.children).toBe(errorMessage);
    });

    it("displays different error messages correctly", () => {
      const errors = [
        "Password is required",
        "Password must be at least 8 characters",
        "Password must contain a number",
        "Password must contain an uppercase letter",
      ];

      errors.forEach((error) => {
        const { getByTestId } = render(
          <UserPasswordInput
            password=""
            setPassword={mockSetPassword}
            errorMessage={error}
          />
        );

        const errorElement = getByTestId("error-message");
        expect(errorElement.props.children).toBe(error);
      });
    });
  });

  describe("User Interactions", () => {
    it("calls setPassword when input is interacted with", () => {
      const { getByTestId } = render(
        <UserPasswordInput password="" setPassword={mockSetPassword} />
      );

      const input = getByTestId("password-input");
      fireEvent.press(input);

      expect(mockSetPassword).toHaveBeenCalled();
    });
  });

  describe("Component Structure", () => {
    it("renders main container", () => {
      const { UNSAFE_getAllByType } = render(
        <UserPasswordInput password="" setPassword={mockSetPassword} />
      );

      const View = require("react-native").View;
      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it("renders label text", () => {
      const { getByText } = render(
        <UserPasswordInput password="" setPassword={mockSetPassword} />
      );

      expect(getByText("Password")).toBeTruthy();
    });

    it("renders ReusableTextInput component", () => {
      const { getByTestId } = render(
        <UserPasswordInput password="" setPassword={mockSetPassword} />
      );

      expect(getByTestId("password-input-container")).toBeTruthy();
    });
  });

  describe("Performance", () => {
    it("re-renders correctly when password prop changes", () => {
      const { rerender, queryByText, getByText } = render(
        <UserPasswordInput password="" setPassword={mockSetPassword} />
      );

      expect(getByText("Enter your password")).toBeTruthy();

      rerender(
        <UserPasswordInput
          password="newpassword"
          setPassword={mockSetPassword}
        />
      );

      expect(getByText("••••••••")).toBeTruthy();
      expect(queryByText("Enter your password")).toBeNull();
    });

    it("re-renders correctly when errorMessage changes", () => {
      const { rerender, queryByTestId, getByTestId } = render(
        <UserPasswordInput password="" setPassword={mockSetPassword} />
      );

      expect(queryByTestId("error-message")).toBeNull();

      rerender(
        <UserPasswordInput
          password=""
          setPassword={mockSetPassword}
          errorMessage="New error"
        />
      );

      const errorElement = getByTestId("error-message");
      expect(errorElement.props.children).toBe("New error");
    });

    it("handles rapid prop updates", () => {
      const { rerender } = render(
        <UserPasswordInput password="" setPassword={mockSetPassword} />
      );

      // Rapid updates
      for (let i = 0; i < 10; i++) {
        rerender(
          <UserPasswordInput
            password={`password${i}`}
            setPassword={mockSetPassword}
            errorMessage={i % 2 === 0 ? `Error ${i}` : undefined}
          />
        );
      }

      expect(true).toBe(true); // Should not throw errors
    });
  });

  describe("Edge Cases", () => {
    it("handles empty password string", () => {
      const { getByText } = render(
        <UserPasswordInput password="" setPassword={mockSetPassword} />
      );

      expect(getByText("Enter your password")).toBeTruthy();
    });

    it("handles long passwords", () => {
      const longPassword = "verylongpasswordwithmancharacters123456789";
      const { getByText } = render(
        <UserPasswordInput
          password={longPassword}
          setPassword={mockSetPassword}
        />
      );

      expect(getByText("••••••••")).toBeTruthy();
    });

    it("handles empty error message string", () => {
      const { queryByTestId } = render(
        <UserPasswordInput
          password=""
          setPassword={mockSetPassword}
          errorMessage=""
        />
      );

      // Empty string should not show error component
      expect(queryByTestId("error-message")).toBeNull();
    });

    it("handles undefined error message", () => {
      const { queryByTestId } = render(
        <UserPasswordInput
          password=""
          setPassword={mockSetPassword}
          errorMessage={undefined}
        />
      );

      expect(queryByTestId("error-message")).toBeNull();
    });
  });

  describe("Props Validation", () => {
    it("works with all required props", () => {
      expect(() => {
        render(<UserPasswordInput password="" setPassword={mockSetPassword} />);
      }).not.toThrow();
    });

    it("works with optional errorMessage prop", () => {
      expect(() => {
        render(
          <UserPasswordInput
            password=""
            setPassword={mockSetPassword}
            errorMessage="Test error"
          />
        );
      }).not.toThrow();
    });
  });
});
