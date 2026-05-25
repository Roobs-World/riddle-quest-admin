import React from "react";
import {render} from "@testing-library/react-native";
import GoogleIcon from "../GoogleIcon";

// Mock the Google SVG import
jest.mock("@images/google.svg", () => {
  const React = require("react");
  const {View} = require("react-native");

  const MockGoogleSvg = ({width, height, ...props}: any) => (
    <View testID="google-icon" style={{width, height}} {...props} />
  );

  MockGoogleSvg.displayName = "MockGoogleSvg";
  return MockGoogleSvg;
});

describe("GoogleIcon", () => {
  describe("Rendering", () => {
    it("renders correctly without props", () => {
      const {getByTestId} = render(<GoogleIcon />);

      expect(getByTestId("google-icon")).toBeTruthy();
    });

    it("renders with custom dimensions", () => {
      const {getByTestId} = render(<GoogleIcon width={32} height={32} />);

      const icon = getByTestId("google-icon");
      expect(icon.props.style).toMatchObject({
        width: 32,
        height: 32,
      });
    });

    it("renders with string dimensions", () => {
      const {getByTestId} = render(<GoogleIcon width="48" height="48" />);

      const icon = getByTestId("google-icon");
      expect(icon.props.style).toMatchObject({
        width: "48",
        height: "48",
      });
    });

    it("renders with percentage dimensions", () => {
      const {getByTestId} = render(<GoogleIcon width="100%" height="100%" />);

      const icon = getByTestId("google-icon");
      expect(icon.props.style).toMatchObject({
        width: "100%",
        height: "100%",
      });
    });
  });

  describe("Props Handling", () => {
    it("handles undefined width and height", () => {
      const {getByTestId} = render(<GoogleIcon />);
      const icon = getByTestId("google-icon");

      expect(icon.props.style).toMatchObject({
        width: undefined,
        height: undefined,
      });
    });

    it("handles only width provided", () => {
      const {getByTestId} = render(<GoogleIcon width={24} />);
      const icon = getByTestId("google-icon");

      expect(icon.props.style).toMatchObject({
        width: 24,
        height: undefined,
      });
    });

    it("handles only height provided", () => {
      const {getByTestId} = render(<GoogleIcon height={24} />);
      const icon = getByTestId("google-icon");

      expect(icon.props.style).toMatchObject({
        width: undefined,
        height: 24,
      });
    });

    it("handles zero dimensions", () => {
      const {getByTestId} = render(<GoogleIcon width={0} height={0} />);
      const icon = getByTestId("google-icon");

      expect(icon.props.style).toMatchObject({
        width: 0,
        height: 0,
      });
    });

    it("handles large dimensions", () => {
      const {getByTestId} = render(<GoogleIcon width={200} height={200} />);
      const icon = getByTestId("google-icon");

      expect(icon.props.style).toMatchObject({
        width: 200,
        height: 200,
      });
    });

    it("handles decimal dimensions", () => {
      const {getByTestId} = render(<GoogleIcon width={24.5} height={24.7} />);
      const icon = getByTestId("google-icon");

      expect(icon.props.style).toMatchObject({
        width: 24.5,
        height: 24.7,
      });
    });
  });

  describe("Component Structure", () => {
    it("renders SVG component", () => {
      const {getByTestId} = render(<GoogleIcon />);
      expect(getByTestId("google-icon")).toBeTruthy();
    });
  });

  describe("Performance", () => {
    it("re-renders correctly with prop changes", () => {
      const {rerender, getByTestId} = render(<GoogleIcon width={24} height={24} />);

      const icon1 = getByTestId("google-icon");
      expect(icon1.props.style).toMatchObject({
        width: 24,
        height: 24,
      });

      rerender(<GoogleIcon width={48} height={48} />);

      const icon2 = getByTestId("google-icon");
      expect(icon2.props.style).toMatchObject({
        width: 48,
        height: 48,
      });
    });

    it("handles rapid prop updates", () => {
      const {rerender} = render(<GoogleIcon width={24} height={24} />);

      // Rapid updates
      for (let i = 0; i < 10; i++) {
        rerender(<GoogleIcon width={20 + i} height={20 + i} />);
      }

      expect(true).toBe(true); // Should not throw errors
    });

    it("renders consistently across multiple instances", () => {
      const {getAllByTestId} = render(
        <>
          <GoogleIcon width={24} height={24} />
          <GoogleIcon width={32} height={32} />
          <GoogleIcon width={48} height={48} />
        </>,
      );

      const icons = getAllByTestId("google-icon");
      expect(icons).toHaveLength(3);
    });
  });

  describe("Edge Cases", () => {
    it("handles negative dimensions", () => {
      const {getByTestId} = render(<GoogleIcon width={-10} height={-10} />);
      const icon = getByTestId("google-icon");

      expect(icon.props.style).toMatchObject({
        width: -10,
        height: -10,
      });
    });

    it("handles mixed dimension types", () => {
      const {getByTestId} = render(<GoogleIcon width={24} height="32px" />);
      const icon = getByTestId("google-icon");

      expect(icon.props.style).toMatchObject({
        width: 24,
        height: "32px",
      });
    });

    it("maintains props integrity", () => {
      const testWidth = 42;
      const testHeight = "56px";
      const {getByTestId} = render(<GoogleIcon width={testWidth} height={testHeight} />);
      const icon = getByTestId("google-icon");

      expect(icon.props.style.width).toBe(testWidth);
      expect(icon.props.style.height).toBe(testHeight);
    });
  });

  describe("TypeScript Interface", () => {
    it("accepts number dimensions", () => {
      expect(() => {
        render(<GoogleIcon width={24} height={24} />);
      }).not.toThrow();
    });

    it("accepts string dimensions", () => {
      expect(() => {
        render(<GoogleIcon width="24" height="24" />);
      }).not.toThrow();
    });

    it("works without any props", () => {
      expect(() => {
        render(<GoogleIcon />);
      }).not.toThrow();
    });
  });
});
