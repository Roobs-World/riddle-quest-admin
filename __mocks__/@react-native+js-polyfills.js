// Mock for @react-native+js-polyfills to avoid Flow syntax parsing errors in Jest
module.exports = {
  // Mock error guard functionality
  ErrorHandler: null,

  // Mock any other polyfills that might be exported
  polyfill: () => {},

  // Default export
  __esModule: true,
  default: {},
};
