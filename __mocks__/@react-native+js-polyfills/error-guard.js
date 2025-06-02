// Mock for @react-native+js-polyfills/error-guard to avoid Flow syntax parsing errors
module.exports = {
  // Mock the ErrorHandler type and related functionality
  ErrorHandler: null,
  setJSExceptionHandler: () => {},
  getJSExceptionHandler: () => null,
  setNativeExceptionHandler: () => {},

  // Default export
  __esModule: true,
  default: {
    setJSExceptionHandler: () => {},
    getJSExceptionHandler: () => null,
    setNativeExceptionHandler: () => {},
  },
};
