import React from "react";
import { render } from "@testing-library/react-native";
import BackspaceIcon from "../BackspaceIcon";

// Mock the SVG import
jest.mock("../../../../assets/images/backspace-key.svg", () => {
  const React = require("react");
  const { View } = require("react-native");

  const MockBackspaceSvg = ({ width, height, ...props }: any) => (
    <View testID="backspace-icon" style={{ width, height }} {...props} />
  );

  MockBackspaceSvg.displayName = "MockBackspaceSvg";
  return MockBackspaceSvg;
});

describe("BackspaceIcon", () => {
  const defaultProps = {
    width: 32,
    height: 32,
    color: "#fcfaf4",
  };

  describe("Rendering", () => {
    it("renders correctly with default props", () => {
      const { getByTestId } = render(<BackspaceIcon {...defaultProps} />);
      expect(getByTestId("backspace-icon")).toBeTruthy();
    });

    it("renders with custom dimensions", () => {
      const { getByTestId } = render(
        <BackspaceIcon width={64} height={64} color="#ff0000" />
      );

      const svg = getByTestId("backspace-icon");
      expect(svg.props.style).toMatchObject({
        width: 64,
        height: 64,
      });
    });

    it("renders with custom color", () => {
      const { getByTestId } = render(
        <BackspaceIcon {...defaultProps} color="#ff0000" />
      );
      // Color is passed but not used in the SVG component
      expect(getByTestId("backspace-icon")).toBeTruthy();
    });
  });

  describe("Default Props", () => {
    it("uses default width when not provided", () => {
      const { getByTestId } = render(<BackspaceIcon color="#fcfaf4" />);

      const svg = getByTestId("backspace-icon");
      expect(svg.props.style).toMatchObject({
        width: 32,
      });
    });

    it("uses default height when not provided", () => {
      const { getByTestId } = render(<BackspaceIcon color="#fcfaf4" />);

      const svg = getByTestId("backspace-icon");
      expect(svg.props.style).toMatchObject({
        height: 32,
      });
    });

    it("accepts color prop", () => {
      const { getByTestId } = render(<BackspaceIcon width={32} height={32} />);
      expect(getByTestId("backspace-icon")).toBeTruthy();
    });
  });

  describe("Prop Variations", () => {
    it("handles string dimensions", () => {
      const { getByTestId } = render(
        <BackspaceIcon width="24" height="24" color="#000000" />
      );

      const svg = getByTestId("backspace-icon");
      expect(svg.props.style).toMatchObject({
        width: "24",
        height: "24",
      });
    });

    it("handles number dimensions", () => {
      const { getByTestId } = render(
        <BackspaceIcon width={24} height={24} color="#000000" />
      );

      const svg = getByTestId("backspace-icon");
      expect(svg.props.style).toMatchObject({
        width: 24,
        height: 24,
      });
    });

    it("handles zero dimensions", () => {
      const { getByTestId } = render(
        <BackspaceIcon width={0} height={0} color="#000000" />
      );

      const svg = getByTestId("backspace-icon");
      expect(svg.props.style).toMatchObject({
        width: 0,
        height: 0,
      });
    });

    it("handles large dimensions", () => {
      const { getByTestId } = render(
        <BackspaceIcon width={100} height={100} color="#000000" />
      );

      const svg = getByTestId("backspace-icon");
      expect(svg.props.style).toMatchObject({
        width: 100,
        height: 100,
      });
    });

    it("handles different width and height", () => {
      const { getByTestId } = render(
        <BackspaceIcon width={20} height={30} color="#000000" />
      );

      const svg = getByTestId("backspace-icon");
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
        const { getByTestId } = render(
          <BackspaceIcon {...defaultProps} color={color} />
        );
        expect(getByTestId("backspace-icon")).toBeTruthy();
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles mixed dimension types", () => {
      const { getByTestId } = render(
        <BackspaceIcon width="24px" height={24} color="#000000" />
      );

      const svg = getByTestId("backspace-icon");
      expect(svg.props.style).toMatchObject({
        width: "24px",
        height: 24,
      });
    });

    it("handles percentage dimensions", () => {
      const { getByTestId } = render(
        <BackspaceIcon width="100%" height="50%" color="#000000" />
      );

      const svg = getByTestId("backspace-icon");
      expect(svg.props.style).toMatchObject({
        width: "100%",
        height: "50%",
      });
    });

    it("handles decimal dimensions", () => {
      const { getByTestId } = render(
        <BackspaceIcon width={18.5} height={18.7} color="#000000" />
      );

      const svg = getByTestId("backspace-icon");
      expect(svg.props.style).toMatchObject({
        width: 18.5,
        height: 18.7,
      });
    });
  });
});
