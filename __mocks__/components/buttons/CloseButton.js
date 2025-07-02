import React from "react";
import { View, Text } from "react-native";

// Extremely simple mock
const MockCloseButton = (props) => {
  return (
    <View testID={props.testID || "mocked-close-button-global"}>
      <Text>X</Text>
    </View>
  );
};

MockCloseButton.displayName = "GlobalMockCloseButton";

export default MockCloseButton;
