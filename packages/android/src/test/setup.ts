import {jest} from "@jest/globals";
/** In-memory stand-in for the native storage module; the port is also tested with explicit stores. */
jest.mock("@react-native-async-storage/async-storage", () => {
  /** Backing map shared across the test file. */
  const values = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: async (key: string) => values.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: async (key: string) => {
        values.delete(key);
      },
      clear: async () => values.clear(),
    },
  };
});
