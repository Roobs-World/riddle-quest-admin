const React = require("react");
const { View } = require("react-native");

const MockSettingsIcon = (props) => {
  const { testID, ...otherProps } = props;
  return React.createElement(View, {
    testID: testID || "settings-icon",
    style: {
      width: props.width || 24,
      height: props.height || 24,
      backgroundColor: props.color || "transparent",
    },
    ...otherProps,
  });
};

MockSettingsIcon.displayName = "MockSettingsIcon";

module.exports = MockSettingsIcon;
