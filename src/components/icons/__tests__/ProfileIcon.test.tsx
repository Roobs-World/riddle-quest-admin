import React from "react";
import { render } from "@testing-library/react-native";
import ProfileIcon from "../ProfileIcon";

// Mock the SVG import
jest.mock("../../../../assets/images/profile-icon.svg", () => {
  const React = require("react");
  const { View } = require("react-native");

  const MockProfileSvg = ({ width, height, testID, ...props }: any) => (
    <View
      testID={testID || "profile-icon"}
      style={{ width, height }}
      {...props}
    />
  );

  MockProfileSvg.displayName = "MockProfileSvg";
  return MockProfileSvg;
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
      expect(getByTestId("profile-icon")).toBeTruthy();
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
    it("accepts default props", () => {
      const { getByTestId } = render(<ProfileIcon />);
      expect(getByTestId("profile-icon")).toBeTruthy();
    });
  });

  describe("Prop Variations", () => {
    it("handles various dimension types", () => {
      // Test with number dimensions
      const { getByTestId: getByTestId1 } = render(
        <ProfileIcon width={100} height={100} />
      );
      expect(getByTestId1("profile-icon")).toBeTruthy();

      // Test with string dimensions
      const { getByTestId: getByTestId2 } = render(
        <ProfileIcon width="50%" height="50%" />
      );
      expect(getByTestId2("profile-icon")).toBeTruthy();

      // Test with zero dimensions
      const { getByTestId: getByTestId3 } = render(
        <ProfileIcon width={0} height={0} />
      );
      expect(getByTestId3("profile-icon")).toBeTruthy();
    });
  });
});
