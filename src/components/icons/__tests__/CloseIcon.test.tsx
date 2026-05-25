import React from "react";
import {render} from "@testing-library/react-native";
import CloseIcon from "../CloseIcon";

// Mock the SVG import
jest.mock("../../../../assets/images/close.svg", () => {
  const React = require("react");
  const {View} = require("react-native");

  const MockCloseSvg = ({width, height, ...props}: any) => (
    <View testID="close-icon" style={{width, height}} {...props} />
  );

  MockCloseSvg.displayName = "MockCloseSvg";
  return MockCloseSvg;
});

describe("CloseIcon", () => {
  const defaultProps = {
    width: 18,
    height: 18,
    color: "black",
  };

  describe("Rendering", () => {
    it("renders correctly with default props", () => {
      const {getByTestId} = render(<CloseIcon {...defaultProps} />);
      expect(getByTestId("close-icon")).toBeTruthy();
    });

    it("renders with custom dimensions", () => {
      const {getByTestId} = render(<CloseIcon width={32} height={32} color="#ff0000" />);

      const svg = getByTestId("close-icon");
      expect(svg.props.style).toMatchObject({
        width: 32,
        height: 32,
      });
    });

    it("renders with custom color", () => {
      const {getByTestId} = render(<CloseIcon {...defaultProps} color="#ff0000" />);
      // Color is passed but not used in the SVG component
      expect(getByTestId("close-icon")).toBeTruthy();
    });
  });

  describe("Default Props", () => {
    it("uses default width when not provided", () => {
      const {getByTestId} = render(<CloseIcon color="black" />);

      const svg = getByTestId("close-icon");
      expect(svg.props.style).toMatchObject({
        width: 18,
      });
    });

    it("uses default height when not provided", () => {
      const {getByTestId} = render(<CloseIcon color="black" />);

      const svg = getByTestId("close-icon");
      expect(svg.props.style).toMatchObject({
        height: 18,
      });
    });

    it("accepts color prop", () => {
      const {getByTestId} = render(<CloseIcon width={18} height={18} />);
      expect(getByTestId("close-icon")).toBeTruthy();
    });
  });

  describe("Prop Variations", () => {
    it("handles string dimensions", () => {
      const {getByTestId} = render(<CloseIcon width="24" height="24" color="black" />);

      const svg = getByTestId("close-icon");
      expect(svg.props.style).toMatchObject({
        width: "24",
        height: "24",
      });
    });

    it("handles number dimensions", () => {
      const {getByTestId} = render(<CloseIcon width={24} height={24} color="black" />);

      const svg = getByTestId("close-icon");
      expect(svg.props.style).toMatchObject({
        width: 24,
        height: 24,
      });
    });

    it("handles zero dimensions", () => {
      const {getByTestId} = render(<CloseIcon width={0} height={0} color="black" />);

      const svg = getByTestId("close-icon");
      expect(svg.props.style).toMatchObject({
        width: 0,
        height: 0,
      });
    });

    it("handles large dimensions", () => {
      const {getByTestId} = render(<CloseIcon width={100} height={100} color="black" />);

      const svg = getByTestId("close-icon");
      expect(svg.props.style).toMatchObject({
        width: 100,
        height: 100,
      });
    });

    it("handles different width and height", () => {
      const {getByTestId} = render(<CloseIcon width={20} height={30} color="black" />);

      const svg = getByTestId("close-icon");
      expect(svg.props.style).toMatchObject({
        width: 20,
        height: 30,
      });
    });
  });

  describe("Color Handling", () => {
    it("accepts color props", () => {
      const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffffff", "#000000"];

      colors.forEach((color) => {
        const {getByTestId} = render(<CloseIcon {...defaultProps} color={color} />);
        expect(getByTestId("close-icon")).toBeTruthy();
      });
    });
  });

  describe("Performance", () => {
    it("re-renders correctly with prop changes", () => {
      const {rerender, getByTestId} = render(<CloseIcon width={18} height={18} color="black" />);

      const svg1 = getByTestId("close-icon");
      expect(svg1.props.style).toMatchObject({
        width: 18,
      });

      rerender(<CloseIcon width={32} height={32} color="#ff0000" />);

      const svg2 = getByTestId("close-icon");
      expect(svg2.props.style).toMatchObject({
        width: 32,
      });
    });

    it("handles rapid prop updates", () => {
      const {rerender} = render(<CloseIcon width={18} height={18} color="black" />);

      // Rapid updates
      for (let i = 0; i < 10; i++) {
        rerender(<CloseIcon width={15 + i} height={15 + i} color={`hsl(${i * 36}, 100%, 50%)`} />);
      }

      // Should not throw errors
      expect(true).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("handles decimal dimensions", () => {
      const {getByTestId} = render(<CloseIcon width={18.5} height={18.7} color="black" />);

      const svg = getByTestId("close-icon");
      expect(svg.props.style).toMatchObject({
        width: 18.5,
        height: 18.7,
      });
    });

    it("handles negative dimensions", () => {
      const {getByTestId} = render(<CloseIcon width={-10} height={-10} color="black" />);

      const svg = getByTestId("close-icon");
      expect(svg.props.style).toMatchObject({
        width: -10,
        height: -10,
      });
    });

    it("handles percentage dimensions", () => {
      const {getByTestId} = render(<CloseIcon width="100%" height="50%" color="black" />);

      const svg = getByTestId("close-icon");
      expect(svg.props.style).toMatchObject({
        width: "100%",
        height: "50%",
      });
    });
  });
});
