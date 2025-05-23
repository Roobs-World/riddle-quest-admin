import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import WideButton from "../WideButton";
// No longer need View, Text import here as it will be required in the mock factory
// Import the original path to spy on it
import ButtonBackground from "@images/button.svg";

// Mock the SVG component using jest.fn()
jest.mock("@images/button.svg", () => {
  const { View, Text } = require("react-native");
  // Return a jest.fn() that, when called, returns the mock JSX
  return jest.fn((props: any) => (
    <View {...props}>
      <Text>Mock SVG Text</Text>
    </View>
  ));
});

describe("<WideButton />", () => {
  const defaultProps = {
    onPress: jest.fn(),
    buttonText: "Test Button",
  };

  beforeEach(() => {
    defaultProps.onPress.mockClear();
    // Clear the mock calls for ButtonBackground before each test
    (ButtonBackground as jest.Mock).mockClear();
  });

  it("renders the button text correctly", () => {
    const { getByText } = render(<WideButton {...defaultProps} />);
    expect(getByText("Test Button")).toBeTruthy();
  });

  it("calls onPress handler when clicked", () => {
    const { getByText } = render(<WideButton {...defaultProps} />);
    fireEvent.press(getByText("Test Button"));
    expect(defaultProps.onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress handler when disabled and clicked", () => {
    const { getByText } = render(<WideButton {...defaultProps} disabled />);
    fireEvent.press(getByText("Test Button"));
    expect(defaultProps.onPress).not.toHaveBeenCalled();
  });

  it("applies disabled style (opacity) when disabled", () => {
    const { getByRole } = render(<WideButton {...defaultProps} disabled />);
    // Get the button by its accessibility role
    const touchableOpacity = getByRole("button");
    expect(touchableOpacity.props.style).toEqual(
      expect.objectContaining({ opacity: 0.5 })
    );
  });

  it("applies default opacity when not disabled", () => {
    const { getByRole } = render(<WideButton {...defaultProps} />);
    // Get the button by its accessibility role
    const touchableOpacity = getByRole("button");
    expect(touchableOpacity.props.style).toEqual(
      expect.objectContaining({ opacity: 1 })
    );
  });

  it("applies custom className to TouchableOpacity", () => {
    const customClass = "my-custom-class";
    const { UNSAFE_getByProps } = render(
      <WideButton {...defaultProps} className={customClass} />
    );
    const touchableOpacity = UNSAFE_getByProps({ disabled: false });
    expect(touchableOpacity.props.className).toContain(customClass);
    expect(touchableOpacity.props.className).toContain(
      "w-full mb-4 rounded-lg"
    ); // Check default classes too
  });

  it("renders the ButtonBackground SVG mock", () => {
    const { getByText } = render(<WideButton {...defaultProps} />);
    // Check if the text from our mock is rendered
    expect(getByText("Mock SVG Text")).toBeTruthy();
  });

  it("passes width and height to ButtonBackground SVG mock", () => {
    render(<WideButton {...defaultProps} />);
    // Check that ButtonBackground (our mock function) was called
    expect(ButtonBackground).toHaveBeenCalled();
    // Check the props of the first call to ButtonBackground
    expect((ButtonBackground as jest.Mock).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        width: "100%",
        height: "100%",
      })
    );
  });
});
