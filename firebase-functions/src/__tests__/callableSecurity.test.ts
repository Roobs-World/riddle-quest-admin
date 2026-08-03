describe("browser callable security", () => {
  const originalEmulatorValue = process.env.FUNCTIONS_EMULATOR;
  const loadOptions = (): typeof import("../shared/callableSecurity").browserCallableSecurityOptions => {
    let options: typeof import("../shared/callableSecurity").browserCallableSecurityOptions | undefined;
    jest.isolateModules(() => {
      options = require("../shared/callableSecurity").browserCallableSecurityOptions;
    });
    return options!;
  };

  afterEach(() => {
    jest.resetModules();
    if (originalEmulatorValue === undefined) delete process.env.FUNCTIONS_EMULATOR;
    else process.env.FUNCTIONS_EMULATOR = originalEmulatorValue;
  });

  it("enforces App Check by default and exposes only the callable ingress", () => {
    delete process.env.FUNCTIONS_EMULATOR;
    const browserCallableSecurityOptions = loadOptions();
    expect(browserCallableSecurityOptions).toEqual({enforceAppCheck: true, invoker: "public"});
    expect(Object.isFrozen(browserCallableSecurityOptions)).toBe(true);
  });

  it("allows the Firebase emulator to bypass App Check", () => {
    process.env.FUNCTIONS_EMULATOR = "true";
    const browserCallableSecurityOptions = loadOptions();
    expect(browserCallableSecurityOptions.enforceAppCheck).toBe(false);
  });
});
