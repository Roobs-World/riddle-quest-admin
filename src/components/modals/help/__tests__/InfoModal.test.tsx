import React from "react";
import {render, fireEvent} from "@testing-library/react-native";
import InfoModal from "../InfoModal";

// Mock Modal to avoid native module errors
jest.mock("react-native/Libraries/Modal/Modal", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: function MockModal({children, visible, onRequestClose}: any) {
      if (!visible) return null;
      return React.createElement("View", {testID: "modal", onRequestClose}, children);
    },
  };
});

// Mock the WideButton component
jest.mock("../../../buttons/WideButton", () => {
  const React = require("react");
  return function MockWideButton({buttonText, onPress, disabled}: any) {
    return React.createElement(
      "View",
      {
        testID: "wide-button",
        accessible: true,
        onPress,
        "data-disabled": disabled,
      },
      React.createElement("Text", null, buttonText),
    );
  };
});

// Mock styles
jest.mock("../../../../styles", () => ({
  TYPOGRAPHY: {
    fontPrimary: "System",
    fontSecondary: "System",
    fontSecondaryBold: "System-Bold",
    fontSize: {sm: 12, lg: 18, title: 24},
  },
  SPACING: {xs: 4, sm: 8, lg: 24, md: 16},
  COLORS: {
    black: "#000000",
  },
}));

// Mock layout constants
jest.mock("../../../../constants/layout", () => ({
  MODAL_WIDTH: 300,
  MODAL_HEIGHT: 400,
  CLOSE_BUTTON_SIZE: 24,
  MODAL_CLOSE_BUTTON_POSITION: {position: "absolute", top: 10, right: 10},
}));

describe("InfoModal", () => {
  const defaultProps = {
    isVisible: true,
    title: "Test Title",
    message: "Test message content",
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe("Component Rendering", () => {
    it("should render correctly when visible", () => {
      const {getByText, getByTestId} = render(<InfoModal {...defaultProps} />);

      expect(getByTestId("modal")).toBeTruthy();
      expect(getByText("Test Title")).toBeTruthy();
      expect(getByText("Test message content")).toBeTruthy();
      expect(getByTestId("wide-button")).toBeTruthy();
    });

    it("should not render when not visible", () => {
      const {queryByTestId, queryByText} = render(<InfoModal {...defaultProps} isVisible={false} />);

      expect(queryByTestId("modal")).toBeNull();
      expect(queryByText("Test Title")).toBeNull();
    });

    it("should render title with correct text", () => {
      const {getByText} = render(<InfoModal {...defaultProps} title="Custom Title" />);

      expect(getByText("Custom Title")).toBeTruthy();
    });

    it("should render message with correct text", () => {
      const {getByText} = render(<InfoModal {...defaultProps} message="Custom message" />);

      expect(getByText("Custom message")).toBeTruthy();
    });

    it("should render OK button", () => {
      const {getByText} = render(<InfoModal {...defaultProps} />);

      expect(getByText("OK")).toBeTruthy();
    });

    it("should render the shared callout shell", () => {
      const {getByTestId} = render(<InfoModal {...defaultProps} />);

      expect(getByTestId("tooltip-callout-shell")).toBeTruthy();
      expect(getByTestId("tooltip-panel")).toBeTruthy();
    });

    it("should render onboarding progress when provided", () => {
      const {getByTestId, queryByText} = render(
        <InfoModal {...defaultProps} onboardingProgress={{current: 2, total: 3}} />,
      );

      expect(getByTestId("onboarding-progress-badge")).toBeTruthy();
      expect(queryByText("2/3")).toBeNull();
    });
  });

  describe("Interactions", () => {
    it("should call onClose when OK button is pressed", () => {
      const mockOnClose = jest.fn();
      const {getByTestId} = render(<InfoModal {...defaultProps} onClose={mockOnClose} />);

      const okButton = getByTestId("wide-button");
      fireEvent.press(okButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Props Validation", () => {
    it("should handle empty title", () => {
      const {queryByTestId} = render(<InfoModal {...defaultProps} title="" />);

      // Modal should still render
      expect(queryByTestId("modal")).toBeTruthy();
    });

    it("should handle empty message", () => {
      const {queryByTestId} = render(<InfoModal {...defaultProps} message="" />);

      // Modal should still render
      expect(queryByTestId("modal")).toBeTruthy();
    });

    it("should handle long title", () => {
      const longTitle = "This is a very long title that might overflow the modal boundaries";
      const {getByText} = render(<InfoModal {...defaultProps} title={longTitle} />);

      expect(getByText(longTitle)).toBeTruthy();
    });

    it("should handle long message", () => {
      const longMessage =
        "This is a very long message that contains a lot of text. " +
        "It should wrap correctly within the modal boundaries and still " +
        "be fully readable by the user.";
      const {getByText} = render(<InfoModal {...defaultProps} message={longMessage} />);

      expect(getByText(longMessage)).toBeTruthy();
    });

    it("should handle special characters in title", () => {
      const specialTitle = "Title with special chars: @#$%^&*()!";
      const {getByText} = render(<InfoModal {...defaultProps} title={specialTitle} />);

      expect(getByText(specialTitle)).toBeTruthy();
    });

    it("should handle special characters in message", () => {
      const specialMessage = "Message with emojis: Success! Check your email.";
      const {getByText} = render(<InfoModal {...defaultProps} message={specialMessage} />);

      expect(getByText(specialMessage)).toBeTruthy();
    });
  });

  describe("Visibility Behavior", () => {
    it("should handle visibility toggle", () => {
      const {rerender, queryByTestId} = render(<InfoModal {...defaultProps} isVisible={true} />);

      expect(queryByTestId("modal")).toBeTruthy();

      rerender(<InfoModal {...defaultProps} isVisible={false} />);

      expect(queryByTestId("modal")).toBeNull();

      rerender(<InfoModal {...defaultProps} isVisible={true} />);

      expect(queryByTestId("modal")).toBeTruthy();
    });

    it("should handle rapid visibility changes", () => {
      const {rerender, queryByTestId} = render(<InfoModal {...defaultProps} isVisible={true} />);

      for (let i = 0; i < 5; i++) {
        expect(() => {
          rerender(<InfoModal {...defaultProps} isVisible={i % 2 === 0} />);
        }).not.toThrow();
      }
    });
  });

  describe("Dynamic Content", () => {
    it("should update title when prop changes", () => {
      const {rerender, getByText, queryByText} = render(<InfoModal {...defaultProps} title="Initial Title" />);

      expect(getByText("Initial Title")).toBeTruthy();

      rerender(<InfoModal {...defaultProps} title="Updated Title" />);

      expect(queryByText("Initial Title")).toBeNull();
      expect(getByText("Updated Title")).toBeTruthy();
    });

    it("should update message when prop changes", () => {
      const {rerender, getByText, queryByText} = render(<InfoModal {...defaultProps} message="Initial message" />);

      expect(getByText("Initial message")).toBeTruthy();

      rerender(<InfoModal {...defaultProps} message="Updated message" />);

      expect(queryByText("Initial message")).toBeNull();
      expect(getByText("Updated message")).toBeTruthy();
    });
  });

  describe("Edge Cases", () => {
    it("should render without crashing with minimal props", () => {
      expect(() => {
        render(<InfoModal {...defaultProps} />);
      }).not.toThrow();
    });

    it("should handle onClose being called multiple times", () => {
      const mockOnClose = jest.fn();
      const {getByTestId} = render(<InfoModal {...defaultProps} onClose={mockOnClose} />);

      const okButton = getByTestId("wide-button");
      fireEvent.press(okButton);
      fireEvent.press(okButton);
      fireEvent.press(okButton);

      expect(mockOnClose).toHaveBeenCalledTimes(3);
    });

    it("should handle multiline message", () => {
      const multilineMessage = "Line 1\nLine 2\nLine 3";
      const {getByText} = render(<InfoModal {...defaultProps} message={multilineMessage} />);

      expect(getByText(multilineMessage)).toBeTruthy();
    });
  });

  describe("Component Structure", () => {
    it("should be a React component", () => {
      expect(InfoModal).toBeDefined();
      expect(typeof InfoModal).toBe("function");
    });

    it("should render with correct modal structure", () => {
      const {getByTestId} = render(<InfoModal {...defaultProps} />);

      const modal = getByTestId("modal");
      expect(modal).toBeTruthy();
    });
  });

  describe("OK Button", () => {
    it("should render OK button with correct text", () => {
      const {getByText} = render(<InfoModal {...defaultProps} />);

      expect(getByText("OK")).toBeTruthy();
    });

    it("should render OK button as enabled", () => {
      const {getByTestId} = render(<InfoModal {...defaultProps} />);

      const okButton = getByTestId("wide-button");
      expect(okButton.props["data-disabled"]).toBe(false);
    });

    it("should render and trigger optional action button", () => {
      const onAction = jest.fn();
      const onClose = jest.fn();
      const {getByText, getAllByTestId} = render(
        <InfoModal {...defaultProps} actionButtonText="Upgrade Account" onAction={onAction} onClose={onClose} />,
      );

      expect(getByText("Upgrade Account")).toBeTruthy();
      const buttons = getAllByTestId("wide-button");
      expect(buttons).toHaveLength(2);
      expect(buttons[0].props["data-disabled"]).toBe(false);
      buttons[0].props.onPress();
      expect(onAction).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should trigger onConfirm before closing when OK is pressed", () => {
      const onConfirm = jest.fn();
      const onClose = jest.fn();
      const {getByText} = render(<InfoModal {...defaultProps} onConfirm={onConfirm} onClose={onClose} />);

      fireEvent.press(getByText("OK"));

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should trigger onConfirm before closing on request close", () => {
      const onConfirm = jest.fn();
      const onClose = jest.fn();
      const {getByTestId} = render(<InfoModal {...defaultProps} onConfirm={onConfirm} onClose={onClose} />);

      getByTestId("modal").props.onRequestClose();

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

  });
});
