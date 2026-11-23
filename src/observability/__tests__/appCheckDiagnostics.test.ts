import {appCheckDiagnostics} from "../appCheckDiagnostics";

describe("App Check diagnostics", () => {
  it.each([null, undefined, "private rejection", {}, {code: "appCheck/private-player-data"}, {code: "auth/failed"}])(
    "omits unrelated or unknown errors: %p",
    (error) => expect(appCheckDiagnostics(error)).toEqual({}),
  );

  it.each([undefined, null, "403", "private response", NaN, Infinity, 99, 600, 403.5])(
    "omits invalid HTTP status: %p",
    (httpStatus) => {
      expect(appCheckDiagnostics({code: "appCheck/throttled", customData: {httpStatus}})).toEqual({
        appCheckErrorCode: "appCheck/throttled",
      });
    },
  );

  it.each([403, 404, 429, 500, 503])("retains numeric HTTP status %p", (httpStatus) => {
    expect(appCheckDiagnostics({code: "appCheck/throttled", customData: {httpStatus}})).toEqual({
      appCheckErrorCode: "appCheck/throttled",
      appCheckHttpStatus: httpStatus,
    });
  });

  it("does not let a throwing getter break error reporting", () => {
    expect(appCheckDiagnostics({
      /** Simulates an unsafe property on an arbitrary rejected value. */
      get code() {
        throw new Error("private getter failure");
      },
    })).toEqual({});
  });
});
