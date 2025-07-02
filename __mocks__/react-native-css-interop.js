// Manual mock for react-native-css-interop
module.exports = {
  __esModule: true,
  default: {},
  getColorScheme: jest.fn(() => "light"),
  NativeWindStyleSheet: {
    create: (styles) => styles,
  },
};
