import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import UserUsernameInput from "../UserUsernameInput";

// Mock the shared components
jest.mock("../../shared/ReusableTextInput", () => {
  const React = require("react");
  const { View, Text } = require("react-native");

  const MockReusableTextInput = ({
    value,
    onChangeText,
    placeholder,
    autoCapitalize,
    ...props
  }: any) => (
    <View testID="username-input-container">
      <Text
        testID="username-input"
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
        USERNAME_LABEL: "Username",
        USERNAME_PLACEHOLDER: "Enter your username",
      },
      SignUp: {
        USERNAME_LABEL: "Username",
        USERNAME_PLACEHOLDER: "Enter your username",
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

describe("UserUsernameInput", () => {
  const mockSetUsername = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders correctly with required props", () => {
      const { getByText, getByTestId } = render(
        <UserUsernameInput username="" setUsername={mockSetUsername} />
      );

      expect(getByText("Username")).toBeTruthy();
      expect(getByTestId("username-input-container")).toBeTruthy();
    });

    it("displays the correct label text", () => {
      const { getByText } = render(
        <UserUsernameInput username="" setUsername={mockSetUsername} />
      );

      expect(getByText("Username")).toBeTruthy();
    });

    it("displays current username value", () => {
      const testUsername = "johndoe123";
      const { getByText } = render(
        <UserUsernameInput
          username={testUsername}
          setUsername={mockSetUsername}
        />
      );

      expect(getByText(testUsername)).toBeTruthy();
    });

    it("displays placeholder when username is empty", () => {
      const { getByText } = render(
        <UserUsernameInput username="" setUsername={mockSetUsername} />
      );

      expect(getByText("Enter your username")).toBeTruthy();
    });
  });

  describe("Error Handling", () => {
    it("does not show error when errorMessage is not provided", () => {
      const { queryByTestId } = render(
        <UserUsernameInput username="" setUsername={mockSetUsername} />
      );

      expect(queryByTestId("error-message")).toBeNull();
    });

    it("does not show error when errorMessage is null", () => {
      const { queryByTestId } = render(
        <UserUsernameInput
          username=""
          setUsername={mockSetUsername}
          errorMessage={null}
        />
      );

      expect(queryByTestId("error-message")).toBeNull();
    });

    it("shows error when errorMessage is provided", () => {
      const errorMessage = "Username too short";
      const { getByTestId } = render(
        <UserUsernameInput
          username=""
          setUsername={mockSetUsername}
          errorMessage={errorMessage}
        />
      );

      const errorElement = getByTestId("error-message");
      expect(errorElement).toBeTruthy();
      expect(errorElement.props.children).toBe(errorMessage);
    });

    it("displays different error messages correctly", () => {
      const errors = [
        "Username is required",
        "Username must be at least 3 characters",
        "Username already exists",
        "Username contains invalid characters",
      ];

      errors.forEach((error) => {
        const { getByTestId } = render(
          <UserUsernameInput
            username=""
            setUsername={mockSetUsername}
            errorMessage={error}
          />
        );

        const errorElement = getByTestId("error-message");
        expect(errorElement.props.children).toBe(error);
      });
    });
  });

  describe("User Interactions", () => {
    it("calls setUsername when input is interacted with", () => {
      const { getByTestId } = render(
        <UserUsernameInput username="" setUsername={mockSetUsername} />
      );

      const input = getByTestId("username-input");
      fireEvent.press(input);

      expect(mockSetUsername).toHaveBeenCalled();
    });
  });

  describe("Component Structure", () => {
    it("renders main container", () => {
      const { UNSAFE_getAllByType } = render(
        <UserUsernameInput username="" setUsername={mockSetUsername} />
      );

      const View = require("react-native").View;
      const views = UNSAFE_getAllByType(View);
      expect(views.length).toBeGreaterThan(0);
    });

    it("renders label text", () => {
      const { getByText } = render(
        <UserUsernameInput username="" setUsername={mockSetUsername} />
      );

      expect(getByText("Username")).toBeTruthy();
    });

    it("renders ReusableTextInput component", () => {
      const { getByTestId } = render(
        <UserUsernameInput username="" setUsername={mockSetUsername} />
      );

      expect(getByTestId("username-input-container")).toBeTruthy();
    });
  });

  describe("Performance", () => {
    it("re-renders correctly when username prop changes", () => {
      const { rerender, queryByText, getByText } = render(
        <UserUsernameInput username="" setUsername={mockSetUsername} />
      );

      expect(getByText("Enter your username")).toBeTruthy();

      rerender(
        <UserUsernameInput
          username="newusername"
          setUsername={mockSetUsername}
        />
      );

      expect(getByText("newusername")).toBeTruthy();
      expect(queryByText("Enter your username")).toBeNull();
    });

    it("re-renders correctly when errorMessage changes", () => {
      const { rerender, queryByTestId, getByTestId } = render(
        <UserUsernameInput username="" setUsername={mockSetUsername} />
      );

      expect(queryByTestId("error-message")).toBeNull();

      rerender(
        <UserUsernameInput
          username=""
          setUsername={mockSetUsername}
          errorMessage="New error"
        />
      );

      const errorElement = getByTestId("error-message");
      expect(errorElement.props.children).toBe("New error");
    });

    it("handles rapid prop updates", () => {
      const { rerender } = render(
        <UserUsernameInput username="" setUsername={mockSetUsername} />
      );

      // Rapid updates
      for (let i = 0; i < 10; i++) {
        rerender(
          <UserUsernameInput
            username={`username${i}`}
            setUsername={mockSetUsername}
            errorMessage={i % 2 === 0 ? `Error ${i}` : undefined}
          />
        );
      }

      expect(true).toBe(true); // Should not throw errors
    });
  });

  describe("Edge Cases", () => {
    it("handles empty username string", () => {
      const { getByText } = render(
        <UserUsernameInput username="" setUsername={mockSetUsername} />
      );

      expect(getByText("Enter your username")).toBeTruthy();
    });

    it("handles long usernames", () => {
      const longUsername = "verylongusernamethatmightbetoolong123456789";
      const { getByText } = render(
        <UserUsernameInput
          username={longUsername}
          setUsername={mockSetUsername}
        />
      );

      expect(getByText(longUsername)).toBeTruthy();
    });

    it("handles special characters in username", () => {
      const specialUsername = "user_name-123";
      const { getByText } = render(
        <UserUsernameInput
          username={specialUsername}
          setUsername={mockSetUsername}
        />
      );

      expect(getByText(specialUsername)).toBeTruthy();
    });

    it("handles empty error message string", () => {
      const { queryByTestId } = render(
        <UserUsernameInput
          username=""
          setUsername={mockSetUsername}
          errorMessage=""
        />
      );

      // Empty string should not show error component
      expect(queryByTestId("error-message")).toBeNull();
    });

    it("handles undefined error message", () => {
      const { queryByTestId } = render(
        <UserUsernameInput
          username=""
          setUsername={mockSetUsername}
          errorMessage={undefined}
        />
      );

      expect(queryByTestId("error-message")).toBeNull();
    });
  });

  describe("Props Validation", () => {
    it("works with all required props", () => {
      expect(() => {
        render(<UserUsernameInput username="" setUsername={mockSetUsername} />);
      }).not.toThrow();
    });

    it("works with optional errorMessage prop", () => {
      expect(() => {
        render(
          <UserUsernameInput
            username=""
            setUsername={mockSetUsername}
            errorMessage="Test error"
          />
        );
      }).not.toThrow();
    });
  });
});
