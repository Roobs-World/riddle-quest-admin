import type {HostServices} from "./types";

/** Cross-tab operation boundary supplied by the Jest shell. */
export type AccountDeletionServiceGate = {
  /** Synchronous admission check for consuming a previously issued local question. */
  isOpen?: () => boolean;
  /** Runs normal service work while no deletion request has superseded this tab. */
  run<Result>(operation: () => Promise<Result>): Promise<Result>;
  /** Drains all normal work across live tabs before authoritative deletion. */
  runExclusive(operation: () => Promise<void>): Promise<void>;
};

/** Coordinates all host-service calls with authoritative account deletion. */
export function coordinateHostServices(services: HostServices, gate: AccountDeletionServiceGate): HostServices {
  /** Stable operation identities keep pending work attached to the same host lifetime. */
  const operations = new Map<string | symbol, {
    /** Underlying provider operation; replacement must retire the cached wrapper. */
    source: unknown;
    /** Gate is checked on every invocation, including calls through retained references. */
    invoke: (...args: unknown[]) => Promise<unknown>;
  }>();
  return new Proxy(services, {
    /** Provides get behavior. */
    get(target, property, receiver) {
      /** Provides value behavior. */
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") {
        operations.delete(property);
        return value;
      }
      /** Previous wrapper for this exact provider operation. */
      const cached = operations.get(property);
      if (cached && cached.source === value) return cached.invoke;
      /** Stable wrapper preserves provider binding and checks the current gate. */
      const invoke = property === "deleteAccount"
        ? () =>
          gate.runExclusive(async () => {
            await Reflect.apply(value, target, []);
          })
        : (...args: unknown[]) => gate.run(async () => Reflect.apply(value, target, args));
      operations.set(property, {source: value, invoke});
      return invoke;
    },
  });
}
