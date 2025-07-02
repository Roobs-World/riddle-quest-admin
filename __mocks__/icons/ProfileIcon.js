const React = require("react");
const { View } = require("react-native");

const MockProfileIcon = (props) => {
  const { testID, ...otherProps } = props;
  return React.createElement(View, {
    testID: testID || "profile-icon",
    style: {
      width: props.width || 24,
      height: props.height || 24,
      backgroundColor: props.color || "transparent",
    },
    ...otherProps,
  });
};

MockProfileIcon.displayName = "MockProfileIcon";

module.exports = MockProfileIcon;
