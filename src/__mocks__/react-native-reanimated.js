// Mock for react-native-reanimated
const React = require("react");
const MockAnimatedView = (props) =>
  React.createElement("View", props, props.children);

export const useSharedValue = jest.fn((initial) => ({
  value: initial,
}));

export const useAnimatedStyle = jest.fn((callback) => callback());

export const withTiming = jest.fn((value) => value);

export const withRepeat = jest.fn((value) => value);

export const withSequence = jest.fn((...values) => values[values.length - 1]);

export const Easing = {
  linear: jest.fn(),
  ease: jest.fn(),
  quad: jest.fn(),
  cubic: jest.fn(),
  bezier: jest.fn(),
  in: jest.fn(),
  out: jest.fn(),
  inOut: jest.fn(),
};

export const runOnJS = jest.fn((fn) => fn);

export const cancelAnimation = jest.fn();

export default {
  View: MockAnimatedView,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
  cancelAnimation,
};
