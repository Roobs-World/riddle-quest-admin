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
    /** Provides reporter behavior. */
    const reporter = jest.fn();
    /** Provides error behavior. */
    const error = new Error("failed");
    configureBrowserErrorReporter(reporter);

    captureBrowserException(error, {operation: "startup"});
    expect(reporter).toHaveBeenCalledWith(error, {operation: "startup"});

    configureBrowserErrorReporter(null);
    captureBrowserException(error);
    expect(reporter).toHaveBeenCalledTimes(1);
  });

  it("preserves caller recovery when the optional adapter throws", () => {
    configureBrowserErrorReporter(() => {throw new Error("telemetry unavailable");});
    expect(() => captureBrowserException(new Error("original failure"))).not.toThrow();
    /** A failed adapter remains replaceable by the current target. */
    const recovered = jest.fn();
    configureBrowserErrorReporter(recovered);
    captureBrowserException(new Error("next failure"));
    expect(recovered).toHaveBeenCalledTimes(1);
  });

  it("observes asynchronous reporting failure without blocking the caller", async () => {
    /** Rejects after reporting has returned, as a provider transport can do. */
    let rejectDelivery!: (reason: unknown) => void;
    /** Tracks the pending optional telemetry delivery. */
    const delivery = new Promise<void>((_resolve, reject) => {rejectDelivery = reject;});
    configureBrowserErrorReporter(() => delivery);
    expect(captureBrowserException(new Error("original failure"))).toBeUndefined();
    rejectDelivery(new Error("telemetry offline"));
    // Jest fails on an unhandled rejection; give the attached observer its turn.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
});
