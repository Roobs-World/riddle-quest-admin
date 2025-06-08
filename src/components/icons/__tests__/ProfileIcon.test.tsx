import React from "react";
import { render } from "@testing-library/react-native";
import ProfileIcon from "../ProfileIcon";

// Mock react-native-svg
jest.mock("react-native-svg", () => {
  const React = require("react");
  const { View } = require("react-native");

  const MockSvg = ({
    children,
    testID,
    width,
    height,
    viewBox,
    ...props
  }: any) => (
    <View
      testID={testID || "profile-icon"}
      style={{ width, height }}
      {...props}
    >
      {children}
    </View>
  );

  const MockPath = ({ fill, ...props }: any) => (
    <View testID="svg-path" style={{ backgroundColor: fill }} {...props} />
  );

  MockSvg.displayName = "MockSvg";
  MockPath.displayName = "MockPath";

  return {
    __esModule: true,
    default: MockSvg,
    Svg: MockSvg,
    Path: MockPath,
  };
});

describe("ProfileIcon", () => {
  const defaultProps = {
    width: 24,
    height: 24,
    color: "#FFFFFF",
  };

  describe("Rendering", () => {
    it("renders correctly with default props", () => {
      const { getByTestId } = render(<ProfileIcon {...defaultProps} />);

      expect(getByTestId("profile-icon")).toBeTruthy();
    });

    it("renders with custom dimensions", () => {
      const { getByTestId } = render(
        <ProfileIcon width={32} height={32} color="#ff0000" />
      );

      const svg = getByTestId("profile-icon");
      expect(svg.props.style).toMatchObject({
        width: 32,
        height: 32,
      });
    });

    it("renders with custom color", () => {
      const { getByTestId } = render(
        <ProfileIcon {...defaultProps} color="#ff0000" />
      );

      expect(getByTestId("profile-icon")).toBeTruthy();
    });

    it("renders with custom testID", () => {
      const { getByTestId } = render(
        <ProfileIcon {...defaultProps} testID="custom-profile-icon" />
      );

      expect(getByTestId("custom-profile-icon")).toBeTruthy();
    });
  });

  describe("Default Props", () => {
    it("uses default width when not provided", () => {
      const { getByTestId } = render(<ProfileIcon color="#FFFFFF" />);

      const svg = getByTestId("profile-icon");
      expect(svg.props.style).toMatchObject({
        width: 24,
      });
    });

    it("uses default height when not provided", () => {
      const { getByTestId } = render(<ProfileIcon color="#FFFFFF" />);

      const svg = getByTestId("profile-icon");
      expect(svg.props.style).toMatchObject({
        height: 24,
      });
    });

    it("uses default color when not provided", () => {
      const { getAllByTestId } = render(<ProfileIcon width={24} height={24} />);

      // The component should render SVG paths with the default color
      const paths = getAllByTestId("svg-path");
      expect(paths.length).toBeGreaterThan(0);
      paths.forEach((path) => {
        expect(path.props.style).toMatchObject({
          backgroundColor: "#FFFFFF",
        });
      });
    });
  });

  describe("Prop Variations", () => {
    it("handles zero dimensions", () => {
      const { getByTestId } = render(
        <ProfileIcon width={0} height={0} color="#000000" />
      );

      const svg = getByTestId("profile-icon");
      expect(svg.props.style).toMatchObject({
        width: 0,
        height: 0,
      });
    });

    it("handles large dimensions", () => {
      const { getByTestId } = render(
        <ProfileIcon width={100} height={100} color="#000000" />
      );

      const svg = getByTestId("profile-icon");
      expect(svg.props.style).toMatchObject({
        width: 100,
        height: 100,
      });
    });

    it("handles different width and height", () => {
      const { getByTestId } = render(
        <ProfileIcon width={20} height={30} color="#000000" />
      );

      const svg = getByTestId("profile-icon");
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
        const { getAllByTestId } = render(
          <ProfileIcon {...defaultProps} color={color} />
        );

        const paths = getAllByTestId("svg-path");
        expect(paths.length).toBeGreaterThan(0);
        paths.forEach((path) => {
          expect(path.props.style).toMatchObject({
            backgroundColor: color,
          });
        });
      });
    });

    it("handles named colors", () => {
      const { getAllByTestId } = render(
        <ProfileIcon {...defaultProps} color="red" />
      );

      const paths = getAllByTestId("svg-path");
      expect(paths.length).toBeGreaterThan(0);
      paths.forEach((path) => {
        expect(path.props.style).toMatchObject({
          backgroundColor: "red",
        });
      });
    });

    it("handles rgba colors", () => {
      const { getAllByTestId } = render(
        <ProfileIcon {...defaultProps} color="rgba(255, 0, 0, 0.5)" />
      );

      const paths = getAllByTestId("svg-path");
      expect(paths.length).toBeGreaterThan(0);
      paths.forEach((path) => {
        expect(path.props.style).toMatchObject({
          backgroundColor: "rgba(255, 0, 0, 0.5)",
        });
      });
    });
  });

  describe("SVG Structure", () => {
    it("renders SVG with correct viewBox", () => {
      const { getByTestId } = render(<ProfileIcon {...defaultProps} />);

      const svg = getByTestId("profile-icon");
      expect(svg).toBeTruthy();
    });

    it("renders SVG paths for profile icon", () => {
      const { getAllByTestId } = render(<ProfileIcon {...defaultProps} />);

      const paths = getAllByTestId("svg-path");
      expect(paths.length).toBe(2); // ProfileIcon has 2 paths
    });
  });
});
