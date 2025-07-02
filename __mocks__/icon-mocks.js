// Mock icon components for Jest testing
const React = require("react");
const { View } = require("react-native");

const createMockIcon = (testId) => {
  const MockIcon = (props) =>
    React.createElement(View, {
      testID: testId,
      style: {
        width: props.width || 24,
        height: props.height || 24,
        backgroundColor: props.color || "transparent",
      },
      ...props,
    });

  MockIcon.displayName = `Mock${testId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("")}`;

  return MockIcon;
};

// Export default icon (this will be used when importing specific icons)
module.exports = createMockIcon("generic-icon");
