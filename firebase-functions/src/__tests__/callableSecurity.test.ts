describe("browser callable security", () => {
  /** Provides original emulator value behavior. */
  const originalEmulatorValue = process.env.FUNCTIONS_EMULATOR;
  /** Loads options. */
  const loadOptions = (): typeof import("../shared/callableSecurity").browserCallableSecurityOptions => {
    /** Provides options behavior. */
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
    /** Provides browser callable security options behavior. */
    const browserCallableSecurityOptions = loadOptions();
    expect(browserCallableSecurityOptions).toEqual({
      minInstances: 0,
      enforceAppCheck: true,
      invoker: "public",
      timeoutSeconds: 60,
    });
    expect(Object.isFrozen(browserCallableSecurityOptions)).toBe(true);
  });

  it("allows the Firebase emulator to bypass App Check", () => {
    process.env.FUNCTIONS_EMULATOR = "true";
    /** Provides browser callable security options behavior. */
    const browserCallableSecurityOptions = loadOptions();
    expect(browserCallableSecurityOptions.enforceAppCheck).toBe(false);
  });
});
