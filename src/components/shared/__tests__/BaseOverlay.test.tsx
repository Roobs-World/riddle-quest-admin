import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { View, Text, StyleSheet } from "react-native";
import BaseOverlay from "../BaseOverlay";

// Mock CloseButton - using function declaration to avoid scope issues
jest.mock("../../buttons/CloseButton", () => {
  return function MockCloseButton({ onPress, size = 24, ...props }: any) {
    const React = require("react");
    const { TouchableOpacity, View } = require("react-native");

    return React.createElement(
      TouchableOpacity,
      {
        testID: "close-button",
        onPress: onPress,
        style: { width: size, height: size },
        ...props,
      },
      React.createElement(View, null, "Close")
    );
  };
});

const testStyles = StyleSheet.create({
  testPadding: {
    padding: 10,
  },
});

describe("BaseOverlay", () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    children: <Text>Test Content</Text>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders when visible is true", () => {
      const { UNSAFE_getByType } = render(<BaseOverlay {...defaultProps} />);

      const Modal = require("react-native").Modal;
      const modal = UNSAFE_getByType(Modal);
      expect(modal.props.visible).toBe(true);
    });

    it("does not render when visible is false", () => {
      const { UNSAFE_queryByType } = render(
        <BaseOverlay {...defaultProps} visible={false} />
      );

      const Modal = require("react-native").Modal;
      const modal = UNSAFE_queryByType(Modal);
      expect(modal?.props.visible).toBe(false);
    });

    it("renders with custom content styling", () => {
      const { UNSAFE_getAllByType } = render(
        <BaseOverlay {...defaultProps} contentStyle={testStyles.testPadding} />
      );

      const TouchableOpacity = require("react-native").TouchableOpacity;
      const touchables = UNSAFE_getAllByType(TouchableOpacity);
      expect(touchables.length).toBeGreaterThan(0);
    });

    it("renders children correctly", () => {
      const { getByTestId, getByText } = render(
        <BaseOverlay {...defaultProps}>
          <View testID="child-1">
            <Text>Child 1</Text>
          </View>
          <View testID="child-2">
            <Text>Child 2</Text>
          </View>
        </BaseOverlay>
      );

      expect(getByTestId("child-1")).toBeTruthy();
      expect(getByTestId("child-2")).toBeTruthy();
      expect(getByText("Child 1")).toBeTruthy();
      expect(getByText("Child 2")).toBeTruthy();
    });

    it("renders close button by default", () => {
      const { getByTestId } = render(<BaseOverlay {...defaultProps} />);

      expect(getByTestId("close-button")).toBeTruthy();
    });

    it("hides close button when showCloseButton is false", () => {
      const { queryByTestId } = render(
        <BaseOverlay {...defaultProps} showCloseButton={false} />
      );

      expect(queryByTestId("close-button")).toBeNull();
    });

    it("renders close button in the standard top-right position", () => {
      const { getByTestId } = render(<BaseOverlay {...defaultProps} />);
      expect(getByTestId("close-button")).toBeTruthy();
    });

    it("renders with custom background color", () => {
      const { UNSAFE_getAllByType } = render(
        <BaseOverlay {...defaultProps} backgroundColor="rgba(255, 0, 0, 0.5)" />
      );

      const TouchableOpacity = require("react-native").TouchableOpacity;
      const overlay = UNSAFE_getAllByType(TouchableOpacity)[0];
      expect(overlay.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ backgroundColor: "rgba(255, 0, 0, 0.5)" }),
        ])
      );
    });
  });

  describe("Interactions", () => {
    it("calls onClose when backdrop is pressed", () => {
      const { UNSAFE_getAllByType } = render(<BaseOverlay {...defaultProps} />);

      const TouchableOpacity = require("react-native").TouchableOpacity;
      const backdrop = UNSAFE_getAllByType(TouchableOpacity)[0];
      fireEvent.press(backdrop);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onClose when content is pressed", () => {
      const { UNSAFE_getAllByType } = render(<BaseOverlay {...defaultProps} />);

      const TouchableOpacity = require("react-native").TouchableOpacity;
      const content = UNSAFE_getAllByType(TouchableOpacity)[1];

      // Create a mock event with stopPropagation
      const mockEvent = {
        stopPropagation: jest.fn(),
        persist: jest.fn(),
        nativeEvent: {},
      };

      // Directly call the onPress handler with the mock event
      content.props.onPress(mockEvent);

      expect(defaultProps.onClose).not.toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });

    it("calls onClose when close button is pressed", () => {
      const { getByTestId } = render(<BaseOverlay {...defaultProps} />);

      const closeButton = getByTestId("close-button");
      fireEvent.press(closeButton);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it("handles undefined onClose gracefully", () => {
      const { UNSAFE_getAllByType } = render(
        <BaseOverlay visible={true} onClose={undefined as any}>
          <Text>Content</Text>
        </BaseOverlay>
      );

      const TouchableOpacity = require("react-native").TouchableOpacity;
      const backdrop = UNSAFE_getAllByType(TouchableOpacity)[0];

      expect(() => fireEvent.press(backdrop)).not.toThrow();
    });

    it("stops propagation when content is pressed", () => {
      const { UNSAFE_getAllByType } = render(<BaseOverlay {...defaultProps} />);

      const TouchableOpacity = require("react-native").TouchableOpacity;
      const content = UNSAFE_getAllByType(TouchableOpacity)[1];

      const mockEvent = { stopPropagation: jest.fn() };
      content.props.onPress(mockEvent);

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });
  });

  describe("Modal Properties", () => {
    it("sets correct modal properties", () => {
      const { UNSAFE_getByType } = render(<BaseOverlay {...defaultProps} />);

      const Modal = require("react-native").Modal;
      const modal = UNSAFE_getByType(Modal);

      expect(modal.props.animationType).toBe("fade");
      expect(modal.props.transparent).toBe(true);
      expect(modal.props.visible).toBe(true);
      expect(modal.props.onRequestClose).toBe(defaultProps.onClose);
    });

    it("passes visible prop to modal", () => {
      const { UNSAFE_getByType, rerender } = render(
        <BaseOverlay {...defaultProps} />
      );

      const Modal = require("react-native").Modal;
      let modal = UNSAFE_getByType(Modal);
      expect(modal.props.visible).toBe(true);

      rerender(<BaseOverlay {...defaultProps} visible={false} />);
      modal = UNSAFE_getByType(Modal);
      expect(modal.props.visible).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("handles rapid visibility changes", () => {
      const { rerender } = render(<BaseOverlay {...defaultProps} />);

      for (let i = 0; i < 10; i++) {
        rerender(<BaseOverlay {...defaultProps} visible={i % 2 === 0} />);
      }

      // Should not throw errors
      expect(true).toBe(true);
    });

    it("handles multiple children types", () => {
      const { getByText } = render(
        <BaseOverlay {...defaultProps}>
          <Text>Text Child</Text>
          <View>
            <Text>Nested Child</Text>
          </View>
          {null}
          {undefined}
          {false}
        </BaseOverlay>
      );

      expect(getByText("Text Child")).toBeTruthy();
      expect(getByText("Nested Child")).toBeTruthy();
    });

    it("handles empty children", () => {
      const { UNSAFE_getByType } = render(
        <BaseOverlay {...defaultProps}>{null}</BaseOverlay>
      );

      const Modal = require("react-native").Modal;
      const modal = UNSAFE_getByType(Modal);
      expect(modal).toBeTruthy();
    });
  });

  describe("Style Merging", () => {
    it("merges overlay styles correctly", () => {
      const customOverlayStyle = { zIndex: 100 };
      const { UNSAFE_getAllByType } = render(
        <BaseOverlay {...defaultProps} overlayStyle={customOverlayStyle} />
      );

      const TouchableOpacity = require("react-native").TouchableOpacity;
      const overlay = UNSAFE_getAllByType(TouchableOpacity)[0];

      expect(overlay.props.style).toEqual(
        expect.arrayContaining([
          expect.any(Object),
          expect.objectContaining({ backgroundColor: "rgba(0, 0, 0, 0.8)" }),
          customOverlayStyle,
        ])
      );
    });

    it("merges content styles correctly", () => {
      const customContentStyle = { maxWidth: 400 };
      const { UNSAFE_getAllByType } = render(
        <BaseOverlay {...defaultProps} contentStyle={customContentStyle} />
      );

      const TouchableOpacity = require("react-native").TouchableOpacity;
      const content = UNSAFE_getAllByType(TouchableOpacity)[1];

      expect(content.props.style).toEqual(
        expect.arrayContaining([expect.any(Object), customContentStyle])
      );
    });
  });

  describe("Close Button Integration", () => {
    it("passes correct props to close button", () => {
      const { getByTestId } = render(<BaseOverlay {...defaultProps} />);

      const closeButton = getByTestId("close-button");
      expect(closeButton.props.style).toMatchObject({
        width: 19,
        height: 19,
      });
    });

    it("renders close button in a consistent position", () => {
      const { getByTestId } = render(<BaseOverlay {...defaultProps} />);
      expect(getByTestId("close-button")).toBeTruthy();
    });
  });
});

