import {jest} from "@jest/globals";

const isValidated = jest.fn();
const getPurchaseData = jest.fn();
const config = jest.fn();

const mock = {
  config,
  isValidated,
  getPurchaseData,
  APPLE: "apple",
  GOOGLE: "google",
};

export default mock;

// If the library also has top-level named exports (e.g. for constants)
export const APPLE = "apple";
export const GOOGLE = "google";

// Export the mock functions for test files to import and control
export {isValidated as mockIapIsValidated, getPurchaseData as mockIapGetPurchaseData, config as mockIapConfig};
