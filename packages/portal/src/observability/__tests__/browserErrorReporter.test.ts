import {
  captureBrowserException,
  configureBrowserErrorReporter,
  resetBrowserErrorReporterForTests,
} from "../browserErrorReporter";

describe("browser error reporter seam", () => {
  afterEach(() => resetBrowserErrorReporterForTests());

  it("is a no-op until the active Web Target installs an adapter", () => {
    expect(() => captureBrowserException(new Error("ignored"), {operation: "startup"})).not.toThrow();
  });

  it("delegates to the installed adapter and can restore the no-op adapter", () => {
    const reporter = jest.fn();
    const error = new Error("failed");
    configureBrowserErrorReporter(reporter);

    captureBrowserException(error, {operation: "startup"});
    expect(reporter).toHaveBeenCalledWith(error, {operation: "startup"});

    configureBrowserErrorReporter(null);
    captureBrowserException(error);
    expect(reporter).toHaveBeenCalledTimes(1);
  });
});
