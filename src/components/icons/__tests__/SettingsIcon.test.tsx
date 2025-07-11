import React from "react";
import { render } from "@testing-library/react-native";
import SettingsIcon from "../SettingsIcon";

// Mock the SVG import
jest.mock("../../../../assets/images/settings-icon.svg", () => {
  const React = require("react");
  const { View } = require("react-native");

  const MockSettingsSvg = ({ width, height, testID, ...props }: any) => (
    <View
      testID={testID || "settings-icon"}
      style={{ width, height }}
      {...props}
    />
  );

  MockSettingsSvg.displayName = "MockSettingsSvg";
  return MockSettingsSvg;
});

describe("SettingsIcon", () => {
  const defaultProps = {
    width: 24,
    height: 24,
    color: "#FFFFFF",
  };

  describe("Rendering", () => {
    it("renders correctly with default props", () => {
      const { getByTestId } = render(<SettingsIcon {...defaultProps} />);
      expect(getByTestId("settings-icon")).toBeTruthy();
    });

    it("renders with custom dimensions", () => {
      const { getByTestId } = render(
        <SettingsIcon width={32} height={32} color="#ff0000" />
      );
      expect(getByTestId("settings-icon")).toBeTruthy();
    });

    it("renders with custom color", () => {
      const { getByTestId } = render(
        <SettingsIcon {...defaultProps} color="#ff0000" />
      );
      expect(getByTestId("settings-icon")).toBeTruthy();
    });

    it("renders with custom testID", () => {
      const { getByTestId } = render(
        <SettingsIcon {...defaultProps} testID="custom-settings-icon" />
      );
      expect(getByTestId("custom-settings-icon")).toBeTruthy();
    });
  });

  describe("Default Props", () => {
    it("accepts default props", () => {
      const { getByTestId } = render(<SettingsIcon />);
      expect(getByTestId("settings-icon")).toBeTruthy();
    });
  });

  describe("Prop Variations", () => {
    it("handles various dimension types", () => {
      // Test with number dimensions
      const { getByTestId: getByTestId1 } = render(
        <SettingsIcon width={100} height={100} />
      );
      expect(getByTestId1("settings-icon")).toBeTruthy();

      // Test with string dimensions
      const { getByTestId: getByTestId2 } = render(
        <SettingsIcon width="50%" height="50%" />
      );
      expect(getByTestId2("settings-icon")).toBeTruthy();

      // Test with zero dimensions
      const { getByTestId: getByTestId3 } = render(
        <SettingsIcon width={0} height={0} />
      );
      expect(getByTestId3("settings-icon")).toBeTruthy();
    });
  });

  describe("Accessibility", () => {
    it("supports custom testID for accessibility", () => {
      const { getByTestId } = render(
        <SettingsIcon {...defaultProps} testID="accessible-settings-icon" />
      );
      expect(getByTestId("accessible-settings-icon")).toBeTruthy();
    });

    it("falls back to default testID when not provided", () => {
      const { getByTestId } = render(<SettingsIcon {...defaultProps} />);
      expect(getByTestId("settings-icon")).toBeTruthy();
    });
  });
});
