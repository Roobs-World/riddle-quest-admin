import React from "react";
import { View } from "react-native";

const SvgMock = (props) => {
  // Extract common SVG props and apply them as style and testID
  const {
    testID,
    width = 24,
    height = 24,
    fill,
    color,
    viewBox,
    ...otherProps
  } = props;

  return (
    <View
      testID={testID || "svg-mock"}
      style={{
        width,
        height,
        backgroundColor: fill || color || "transparent",
      }}
      {...otherProps}
    />
  );
};

SvgMock.displayName = "SvgMock";

export default SvgMock;
