import React from "react";
import {render} from "@testing-library/react-native";
import HintIcon from "../HintIcon";

// Mock the SVG import
jest.mock("@images/hint.svg", () => {
  const React = require("react");
  const {View} = require("react-native");

  const MockHintSvg = ({width, height, fill, ...props}: any) => (
    <View testID="hint-icon" style={{width, height, backgroundColor: fill}} {...props} />
  );

  MockHintSvg.displayName = "MockHintSvg";
  return MockHintSvg;
});

describe("HintIcon", () => {
  const defaultProps = {
    width: 24,
    height: 24,
    color: "#fcfaf4",
  };

  describe("Rendering", () => {
    it("renders correctly with default props", () => {
      const {getByTestId} = render(<HintIcon {...defaultProps} />);

      expect(getByTestId("hint-icon")).toBeTruthy();
    });

    it("renders with custom dimensions", () => {
      const {getByTestId} = render(<HintIcon width={32} height={32} color="#ff0000" />);

      const svg = getByTestId("hint-icon");
      expect(svg.props.style).toMatchObject({
        width: 32,
        height: 32,
      });
    });

    it("renders with custom color", () => {
      const {getByTestId} = render(<HintIcon {...defaultProps} color="#ff0000" />);

      const svg = getByTestId("hint-icon");
      expect(svg.props.style).toMatchObject({
        backgroundColor: "#ff0000",
      });
    });
  });

  describe("Default Props", () => {
    it("uses default width when not provided", () => {
      const {getByTestId} = render(<HintIcon color="#fcfaf4" />);

      const svg = getByTestId("hint-icon");
      expect(svg.props.style).toMatchObject({
        width: 24,
      });
    });

    it("uses default height when not provided", () => {
      const {getByTestId} = render(<HintIcon color="#fcfaf4" />);

      const svg = getByTestId("hint-icon");
      expect(svg.props.style).toMatchObject({
        height: 24,
      });
    });

    it("uses default color when not provided", () => {
      const {getByTestId} = render(<HintIcon width={24} height={24} />);

      const svg = getByTestId("hint-icon");
      expect(svg.props.style).toMatchObject({
        backgroundColor: "#fcfaf4",
      });
    });
  });

  describe("Prop Variations", () => {
    it("handles zero dimensions", () => {
      const {getByTestId} = render(<HintIcon width={0} height={0} color="#000000" />);

      const svg = getByTestId("hint-icon");
      expect(svg.props.style).toMatchObject({
        width: 0,
        height: 0,
      });
    });

    it("handles large dimensions", () => {
      const {getByTestId} = render(<HintIcon width={100} height={100} color="#000000" />);

      const svg = getByTestId("hint-icon");
      expect(svg.props.style).toMatchObject({
        width: 100,
        height: 100,
      });
    });

    it("handles different width and height", () => {
      const {getByTestId} = render(<HintIcon width={20} height={30} color="#000000" />);

      const svg = getByTestId("hint-icon");
      expect(svg.props.style).toMatchObject({
        width: 20,
        height: 30,
      });
    });
  });

  describe("Color Handling", () => {
    it("handles hex colors", () => {
      const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffffff", "#000000"];

      colors.forEach((color) => {
        const {getByTestId} = render(<HintIcon {...defaultProps} color={color} />);

        const svg = getByTestId("hint-icon");
        expect(svg.props.style).toMatchObject({
          backgroundColor: color,
        });
      });
    });

    it("handles named colors", () => {
      const {getByTestId} = render(<HintIcon {...defaultProps} color="red" />);

      const svg = getByTestId("hint-icon");
      expect(svg.props.style).toMatchObject({
        backgroundColor: "red",
      });
    });

    it("handles rgba colors", () => {
      const {getByTestId} = render(<HintIcon {...defaultProps} color="rgba(255, 0, 0, 0.5)" />);

      const svg = getByTestId("hint-icon");
      expect(svg.props.style).toMatchObject({
        backgroundColor: "rgba(255, 0, 0, 0.5)",
      });
    });
  });
});
