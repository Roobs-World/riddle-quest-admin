import React from "react";
import { View } from "react-native";

const SvgMock = (props) => {
  // Extract testID from props and apply it directly
  const { testID, ...otherProps } = props;
  return <View testID={testID || "svg-mock"} {...otherProps} />;
};

SvgMock.displayName = "SvgMock";

export default SvgMock;
