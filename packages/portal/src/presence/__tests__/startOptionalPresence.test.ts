import {startOptionalPresence} from "../startOptionalPresence";

describe("optional presence startup", () => {
  it("starts only when opted in and visible", async () => {
    const start = jest.fn(async () => undefined);
    const reportFailure = jest.fn();

    await expect(startOptionalPresence({enabled: true, canStart: true, start, reportFailure}))
      .resolves.toBe(true);
    await expect(startOptionalPresence({enabled: false, canStart: true, start, reportFailure}))
      .resolves.toBe(false);
    await expect(startOptionalPresence({enabled: true, canStart: false, start, reportFailure}))
      .resolves.toBe(false);
    expect(start).toHaveBeenCalledTimes(1);
    expect(reportFailure).not.toHaveBeenCalled();
  });

  it("contains a consent or transport denial so core startup can continue", async () => {
    const failure = new Error("permission-denied");
    const reportFailure = jest.fn();

    await expect(startOptionalPresence({
      enabled: true,
      canStart: true,
      start: async () => { throw failure; },
      reportFailure,
    })).resolves.toBe(false);
    expect(reportFailure).toHaveBeenCalledWith(failure);
  });
});
