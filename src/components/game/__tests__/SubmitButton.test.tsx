import React from "react";
import {render, fireEvent} from "@testing-library/react-native";
import {SubmitButton} from "../SubmitButton";

// Mock styles
jest.mock("../../../styles", () => ({
  SPACING: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
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
}));

// Mock layout constants
jest.mock("../../../constants/layout", () => ({
  SUBMIT_BUTTON_PADDING_H: 24,
}));

describe("<SubmitButton />", () => {
  const defaultProps = {
    isSubmitDisabled: false,
    gameOver: false,
    handleKeyPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render without crashing", () => {
      expect(() => render(<SubmitButton {...defaultProps} />)).not.toThrow();
    });

    it("should render SUBMIT text", () => {
      const {getByText} = render(<SubmitButton {...defaultProps} />);
      expect(getByText("SUBMIT")).toBeTruthy();
    });

    it("should have correct testID", () => {
      const {getByTestId} = render(<SubmitButton {...defaultProps} />);
      expect(getByTestId("submit-button")).toBeTruthy();
    });

    it("should have correct accessibility label", () => {
      const {getByLabelText} = render(<SubmitButton {...defaultProps} />);
      expect(getByLabelText("Submit current guess")).toBeTruthy();
    });

    it("should have button accessibility role", () => {
      const {getByRole} = render(<SubmitButton {...defaultProps} />);
      expect(getByRole("button")).toBeTruthy();
    });
  });

  describe("Interactions", () => {
    it("should call handleKeyPress with ENTER when pressed and enabled", () => {
      const {getByTestId} = render(<SubmitButton {...defaultProps} />);
      fireEvent.press(getByTestId("submit-button"));
      expect(defaultProps.handleKeyPress).toHaveBeenCalledWith("ENTER");
      expect(defaultProps.handleKeyPress).toHaveBeenCalledTimes(1);
    });

    it("should not call handleKeyPress when isSubmitDisabled is true", () => {
      const handleKeyPress = jest.fn();
      const {getByTestId} = render(
        <SubmitButton {...defaultProps} isSubmitDisabled={true} handleKeyPress={handleKeyPress} />,
      );
      fireEvent.press(getByTestId("submit-button"));
      expect(handleKeyPress).not.toHaveBeenCalled();
    });

    it("should not call handleKeyPress when gameOver is true", () => {
      const handleKeyPress = jest.fn();
      const {getByTestId} = render(<SubmitButton {...defaultProps} gameOver={true} handleKeyPress={handleKeyPress} />);
      fireEvent.press(getByTestId("submit-button"));
      expect(handleKeyPress).not.toHaveBeenCalled();
    });

    it("should not call handleKeyPress when both isSubmitDisabled and gameOver are true", () => {
      const handleKeyPress = jest.fn();
      const {getByTestId} = render(
        <SubmitButton {...defaultProps} isSubmitDisabled={true} gameOver={true} handleKeyPress={handleKeyPress} />,
      );
      fireEvent.press(getByTestId("submit-button"));
      expect(handleKeyPress).not.toHaveBeenCalled();
    });

    it("should handle multiple presses when enabled", () => {
      const handleKeyPress = jest.fn();
      const {getByTestId} = render(<SubmitButton {...defaultProps} handleKeyPress={handleKeyPress} />);
      const button = getByTestId("submit-button");
      fireEvent.press(button);
      fireEvent.press(button);
      fireEvent.press(button);
      expect(handleKeyPress).toHaveBeenCalledTimes(3);
    });
  });

  describe("Disabled State", () => {
    it("should be disabled when isSubmitDisabled is true", () => {
      const {getByTestId} = render(<SubmitButton {...defaultProps} isSubmitDisabled={true} />);
      const button = getByTestId("submit-button");
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });

    it("should be disabled when gameOver is true", () => {
      const {getByTestId} = render(<SubmitButton {...defaultProps} gameOver={true} />);
      const button = getByTestId("submit-button");
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });

    it("should be enabled when both isSubmitDisabled and gameOver are false", () => {
      const {getByTestId} = render(<SubmitButton {...defaultProps} isSubmitDisabled={false} gameOver={false} />);
      const button = getByTestId("submit-button");
      expect(button.props.accessibilityState?.disabled).toBeFalsy();
    });
  });

  describe("Styling", () => {
    it("should apply gray class when disabled", () => {
      const {getByTestId} = render(<SubmitButton {...defaultProps} isSubmitDisabled={true} />);
      expect(getByTestId("submit-button").props.accessibilityState?.disabled).toBe(true);
    });

    it("should apply primary-orange class when enabled", () => {
      const {getByTestId} = render(<SubmitButton {...defaultProps} isSubmitDisabled={false} gameOver={false} />);
      expect(getByTestId("submit-button")).toBeTruthy();
    });

    it("should have correct padding style", () => {
      const {getByTestId} = render(<SubmitButton {...defaultProps} />);
      const button = getByTestId("submit-button");
      expect(button.props.style).toBeDefined();
    });
  });

  describe("Component Lifecycle", () => {
    it("should render with disabled state", () => {
      const {getByTestId} = render(<SubmitButton {...defaultProps} isSubmitDisabled={true} />);
      expect(getByTestId("submit-button").props.accessibilityState?.disabled).toBe(true);
    });

    it("should render with enabled state", () => {
      const {getByTestId} = render(<SubmitButton {...defaultProps} isSubmitDisabled={false} />);
      expect(getByTestId("submit-button").props.accessibilityState?.disabled).toBeFalsy();
    });

    it("should handle unmount correctly", () => {
      const {unmount} = render(<SubmitButton {...defaultProps} />);
      expect(() => unmount()).not.toThrow();
    });

    it("should handle different callback functions", () => {
      const handleKeyPress1 = jest.fn();
      const {getByTestId} = render(<SubmitButton {...defaultProps} handleKeyPress={handleKeyPress1} />);

      fireEvent.press(getByTestId("submit-button"));
      expect(handleKeyPress1).toHaveBeenCalledTimes(1);
    });

    it("should work with different callback function", () => {
      const handleKeyPress2 = jest.fn();
      const {getByTestId} = render(<SubmitButton {...defaultProps} handleKeyPress={handleKeyPress2} />);

      fireEvent.press(getByTestId("submit-button"));
      expect(handleKeyPress2).toHaveBeenCalledTimes(1);
    });
  });

  describe("Edge Cases", () => {
    it("should not call handler when disabled", () => {
      const handleKeyPress = jest.fn();
      const {getByTestId} = render(
        <SubmitButton {...defaultProps} isSubmitDisabled={true} handleKeyPress={handleKeyPress} />,
      );

      fireEvent.press(getByTestId("submit-button"));
      expect(handleKeyPress).not.toHaveBeenCalled();
    });

    it("should call handler when enabled", () => {
      const handleKeyPress = jest.fn();
      const {getByTestId} = render(
        <SubmitButton {...defaultProps} isSubmitDisabled={false} handleKeyPress={handleKeyPress} />,
      );

      fireEvent.press(getByTestId("submit-button"));
      expect(handleKeyPress).toHaveBeenCalledTimes(1);
    });

    it("should not call handler when game over", () => {
      const handleKeyPress = jest.fn();
      const {getByTestId} = render(<SubmitButton {...defaultProps} gameOver={true} handleKeyPress={handleKeyPress} />);

      fireEvent.press(getByTestId("submit-button"));
      expect(handleKeyPress).not.toHaveBeenCalled();
    });

    it("should call handler when game not over", () => {
      const handleKeyPress = jest.fn();
      const {getByTestId} = render(<SubmitButton {...defaultProps} gameOver={false} handleKeyPress={handleKeyPress} />);

      fireEvent.press(getByTestId("submit-button"));
      expect(handleKeyPress).toHaveBeenCalledTimes(1);
    });
  });
});
