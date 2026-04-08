import { logger } from "../logger";

describe("logger", () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("error always logs to console.error", () => {
    logger.error("test error", { code: "ERR" });
    expect(consoleErrorSpy).toHaveBeenCalledWith("test error", { code: "ERR" });
  });

  it("debug logs to console.log when in dev", () => {
    logger.debug("test debug");
    expect(consoleLogSpy).toHaveBeenCalledWith("test debug");
  });

  it("info logs to console.log when in dev", () => {
    logger.info("test info");
    expect(consoleLogSpy).toHaveBeenCalledWith("test info");
  });

  it("warn logs to console.warn when in dev", () => {
    logger.warn("test warn");
    expect(consoleWarnSpy).toHaveBeenCalledWith("test warn");
  });
});
