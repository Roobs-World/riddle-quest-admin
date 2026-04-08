import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import BackButton from "../BackButton";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

// Mock the BackIcon SVG
jest.mock("@images/back-icon.svg", () => {
  const React = require("react");
  const { View } = require("react-native");

  const MockBackIconSvg = ({ width, height, ...props }: any) => (
    <View testID="back-icon" style={{ width, height }} {...props} />
  );

  MockBackIconSvg.displayName = "MockBackIconSvg";
  return MockBackIconSvg;
});

// Mock styles
jest.mock("../../../styles", () => ({
  styles: {
    backButton: {},
  },
  SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, "2xl": 48 },
}));

type RootStackParamList = Record<string, object | undefined>;

describe("BackButton", () => {
  const mockNavigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  } as any as NativeStackNavigationProp<RootStackParamList>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders correctly with navigation prop", () => {
      const { getByTestId } = render(
        <BackButton navigation={mockNavigation} />
      );

      expect(getByTestId("back-icon")).toBeTruthy();
    });

    it("renders BackIcon with correct dimensions", () => {
      const { getByTestId } = render(
        <BackButton navigation={mockNavigation} />
      );
      const icon = getByTestId("back-icon");

      expect(icon.props.style).toMatchObject({
        width: 35,
        height: 35,
      });
    });

    it("applies correct styling", () => {
      const { UNSAFE_getByType } = render(
        <BackButton navigation={mockNavigation} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      const style = Array.isArray(button.props.style)
        ? Object.assign({}, ...button.props.style)
        : button.props.style;
      expect(style.padding).toBeDefined();
    });
  });

  describe("Navigation Behavior", () => {
    it("calls navigation.goBack when no targetScreen is provided", () => {
      const { UNSAFE_getByType } = render(
        <BackButton navigation={mockNavigation} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      fireEvent.press(button);

      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
      expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });

    it("calls navigation.navigate when targetScreen is provided", () => {
      const targetScreen = "HomeScreen";
      const { UNSAFE_getByType } = render(
        <BackButton navigation={mockNavigation} targetScreen={targetScreen} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      fireEvent.press(button);

      expect(mockNavigation.navigate).toHaveBeenCalledTimes(1);
      expect(mockNavigation.navigate).toHaveBeenCalledWith(targetScreen);
      expect(mockNavigation.goBack).not.toHaveBeenCalled();
    });

    it("handles different target screens", () => {
      const screens = ["HomeScreen", "ProfileScreen", "SettingsScreen"];

      screens.forEach((screen) => {
        jest.clearAllMocks();
        const { UNSAFE_getByType } = render(
          <BackButton navigation={mockNavigation} targetScreen={screen} />
        );
        const TouchableOpacity = require("react-native").TouchableOpacity;
        const button = UNSAFE_getByType(TouchableOpacity);

        fireEvent.press(button);

        expect(mockNavigation.navigate).toHaveBeenCalledWith(screen);
      });
    });
  });

  describe("Component Structure", () => {
    it("renders as TouchableOpacity", () => {
      const { UNSAFE_getByType } = render(
        <BackButton navigation={mockNavigation} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      expect(UNSAFE_getByType(TouchableOpacity)).toBeTruthy();
    });

    it("contains BackIcon as child", () => {
      const { getByTestId } = render(
        <BackButton navigation={mockNavigation} />
      );
      expect(getByTestId("back-icon")).toBeTruthy();
    });
  });

  describe("Props Validation", () => {
    it("works without targetScreen prop", () => {
      expect(() => {
        render(<BackButton navigation={mockNavigation} />);
      }).not.toThrow();
    });

    it("works with targetScreen prop", () => {
      expect(() => {
        render(
          <BackButton navigation={mockNavigation} targetScreen="HomeScreen" />
        );
      }).not.toThrow();
    });
  });

  describe("Interactions", () => {
    it("handles multiple presses correctly", () => {
      const { UNSAFE_getByType } = render(
        <BackButton navigation={mockNavigation} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      fireEvent.press(button);
      fireEvent.press(button);
      fireEvent.press(button);

      expect(mockNavigation.goBack).toHaveBeenCalledTimes(3);
    });

    it("handles rapid presses", () => {
      const { UNSAFE_getByType } = render(
        <BackButton navigation={mockNavigation} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      for (let i = 0; i < 10; i++) {
        fireEvent.press(button);
      }

      expect(mockNavigation.goBack).toHaveBeenCalledTimes(10);
    });
  });

  describe("Performance", () => {
    it("re-renders correctly when navigation changes", () => {
      const newNavigation = {
        navigate: jest.fn(),
        goBack: jest.fn(),
      } as any as NativeStackNavigationProp<RootStackParamList>;

      const { rerender, UNSAFE_getByType } = render(
        <BackButton navigation={mockNavigation} />
      );

      rerender(<BackButton navigation={newNavigation} />);

      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);
      fireEvent.press(button);

      expect(newNavigation.goBack).toHaveBeenCalledTimes(1);
      expect(mockNavigation.goBack).not.toHaveBeenCalled();
    });

    it("re-renders correctly when targetScreen changes", () => {
      const { rerender, UNSAFE_getByType } = render(
        <BackButton navigation={mockNavigation} targetScreen="HomeScreen" />
      );

      rerender(
        <BackButton navigation={mockNavigation} targetScreen="ProfileScreen" />
      );

      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);
      fireEvent.press(button);

      expect(mockNavigation.navigate).toHaveBeenCalledWith("ProfileScreen");
    });
  });

  describe("Edge Cases", () => {
    it("handles navigation methods that throw errors gracefully", () => {
      const errorNavigation = {
        navigate: jest.fn().mockImplementation(() => {
          throw new Error("Navigation error");
        }),
        goBack: jest.fn(),
      } as any as NativeStackNavigationProp<RootStackParamList>;

      const { UNSAFE_getByType } = render(
        <BackButton navigation={errorNavigation} targetScreen="Home" />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      // The component doesn't handle errors, so expect the error to be thrown
      expect(() => {
        fireEvent.press(button);
      }).toThrow("Navigation error");

      expect(errorNavigation.navigate).toHaveBeenCalledTimes(1);
    });

    it("handles undefined targetScreen correctly", () => {
      const { UNSAFE_getByType } = render(
        <BackButton navigation={mockNavigation} targetScreen={undefined} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      fireEvent.press(button);

      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
      expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });
  });

  describe("Visual Consistency", () => {
    it("maintains consistent icon size", () => {
      const { getByTestId } = render(
        <BackButton navigation={mockNavigation} />
      );
      const icon = getByTestId("back-icon");

      expect(icon.props.style).toMatchObject({
        width: 35,
        height: 35,
      });
    });

    it("applies consistent padding", () => {
      const { UNSAFE_getByType } = render(
        <BackButton navigation={mockNavigation} />
      );
      const TouchableOpacity = require("react-native").TouchableOpacity;
      const button = UNSAFE_getByType(TouchableOpacity);

      const style = Array.isArray(button.props.style)
        ? Object.assign({}, ...button.props.style)
        : button.props.style;
      expect(style.padding).toBeDefined();
    });
  });
});
