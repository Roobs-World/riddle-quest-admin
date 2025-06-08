import React from "react";
import { render } from "@testing-library/react-native";
import FacebookIcon from "../FacebookIcon";

// Mock the Facebook SVG import
jest.mock("@images/facebook.svg", () => {
  const React = require("react");
  const { View } = require("react-native");

  const MockFacebookSvg = ({ width, height, ...props }: any) => (
    <View testID="facebook-icon" style={{ width, height }} {...props} />
  );

  MockFacebookSvg.displayName = "MockFacebookSvg";
  return MockFacebookSvg;
});

describe("FacebookIcon", () => {
  describe("Rendering", () => {
    it("renders correctly without props", () => {
      const { getByTestId } = render(<FacebookIcon />);

      expect(getByTestId("facebook-icon")).toBeTruthy();
    });

    it("renders with custom dimensions", () => {
      const { getByTestId } = render(<FacebookIcon width={32} height={32} />);

      const icon = getByTestId("facebook-icon");
      expect(icon.props.style).toMatchObject({
        width: 32,
        height: 32,
      });
    });

    it("renders with string dimensions", () => {
      const { getByTestId } = render(<FacebookIcon width="48" height="48" />);

      const icon = getByTestId("facebook-icon");
      expect(icon.props.style).toMatchObject({
        width: "48",
        height: "48",
      });
    });

    it("renders with percentage dimensions", () => {
      const { getByTestId } = render(
        <FacebookIcon width="100%" height="100%" />
      );

      const icon = getByTestId("facebook-icon");
      expect(icon.props.style).toMatchObject({
        width: "100%",
        height: "100%",
      });
    });
  });

  describe("Props Handling", () => {
    it("handles undefined width and height", () => {
      const { getByTestId } = render(<FacebookIcon />);
      const icon = getByTestId("facebook-icon");

      expect(icon.props.style).toMatchObject({
        width: undefined,
        height: undefined,
      });
    });

    it("handles only width provided", () => {
      const { getByTestId } = render(<FacebookIcon width={24} />);
      const icon = getByTestId("facebook-icon");

      expect(icon.props.style).toMatchObject({
        width: 24,
        height: undefined,
      });
    });

    it("handles only height provided", () => {
      const { getByTestId } = render(<FacebookIcon height={24} />);
      const icon = getByTestId("facebook-icon");

      expect(icon.props.style).toMatchObject({
        width: undefined,
        height: 24,
      });
    });

    it("handles zero dimensions", () => {
      const { getByTestId } = render(<FacebookIcon width={0} height={0} />);
      const icon = getByTestId("facebook-icon");

      expect(icon.props.style).toMatchObject({
        width: 0,
        height: 0,
      });
    });

    it("handles large dimensions", () => {
      const { getByTestId } = render(<FacebookIcon width={200} height={200} />);
      const icon = getByTestId("facebook-icon");

      expect(icon.props.style).toMatchObject({
        width: 200,
        height: 200,
      });
    });

    it("handles decimal dimensions", () => {
      const { getByTestId } = render(
        <FacebookIcon width={24.5} height={24.7} />
      );
      const icon = getByTestId("facebook-icon");

      expect(icon.props.style).toMatchObject({
        width: 24.5,
        height: 24.7,
      });
    });
  });

  describe("Component Structure", () => {
    it("renders SVG component", () => {
      const { getByTestId } = render(<FacebookIcon />);
      expect(getByTestId("facebook-icon")).toBeTruthy();
    });
  });

  describe("Performance", () => {
    it("re-renders correctly with prop changes", () => {
      const { rerender, getByTestId } = render(
        <FacebookIcon width={24} height={24} />
      );

      const icon1 = getByTestId("facebook-icon");
      expect(icon1.props.style).toMatchObject({
        width: 24,
        height: 24,
      });

      rerender(<FacebookIcon width={48} height={48} />);

      const icon2 = getByTestId("facebook-icon");
      expect(icon2.props.style).toMatchObject({
        width: 48,
        height: 48,
      });
    });

    it("handles rapid prop updates", () => {
      const { rerender } = render(<FacebookIcon width={24} height={24} />);

      // Rapid updates
      for (let i = 0; i < 10; i++) {
        rerender(<FacebookIcon width={20 + i} height={20 + i} />);
      }

      expect(true).toBe(true); // Should not throw errors
    });

    it("renders consistently across multiple instances", () => {
      const { getAllByTestId } = render(
        <>
          <FacebookIcon width={24} height={24} />
          <FacebookIcon width={32} height={32} />
          <FacebookIcon width={48} height={48} />
        </>
      );

      const icons = getAllByTestId("facebook-icon");
      expect(icons).toHaveLength(3);
    });
  });

  describe("Edge Cases", () => {
    it("handles negative dimensions", () => {
      const { getByTestId } = render(<FacebookIcon width={-10} height={-10} />);
      const icon = getByTestId("facebook-icon");

      expect(icon.props.style).toMatchObject({
        width: -10,
        height: -10,
      });
    });

    it("handles mixed dimension types", () => {
      const { getByTestId } = render(<FacebookIcon width={24} height="32px" />);
      const icon = getByTestId("facebook-icon");

      expect(icon.props.style).toMatchObject({
        width: 24,
        height: "32px",
      });
    });

    it("maintains props integrity", () => {
      const testWidth = 42;
      const testHeight = "56px";
      const { getByTestId } = render(
        <FacebookIcon width={testWidth} height={testHeight} />
      );
      const icon = getByTestId("facebook-icon");

      expect(icon.props.style.width).toBe(testWidth);
      expect(icon.props.style.height).toBe(testHeight);
    });
  });

  describe("TypeScript Interface", () => {
    it("accepts number dimensions", () => {
      expect(() => {
        render(<FacebookIcon width={24} height={24} />);
      }).not.toThrow();
    });

    it("accepts string dimensions", () => {
      expect(() => {
        render(<FacebookIcon width="24" height="24" />);
      }).not.toThrow();
    });

    it("works without any props", () => {
      expect(() => {
        render(<FacebookIcon />);
      }).not.toThrow();
    });
  });
});
