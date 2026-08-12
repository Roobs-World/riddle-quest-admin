import type {HostServices} from "./types";

/** Cross-tab operation boundary supplied by the Jest shell. */
export type AccountDeletionServiceGate = {
  /** Runs normal service work while no deletion request has superseded this tab. */
  run<Result>(operation: () => Promise<Result>): Promise<Result>;
  /** Drains all normal work across live tabs before authoritative deletion. */
  runExclusive(operation: () => Promise<void>): Promise<void>;
};

/** Coordinates all host-service calls with authoritative account deletion. */
export function coordinateHostServices(
  services: HostServices,
  gate: AccountDeletionServiceGate,
): HostServices {
  return new Proxy(services, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;
      if (property === "deleteAccount") {
        return () => gate.runExclusive(async () => { await Reflect.apply(value, target, []); });
      }
      return (...args: unknown[]) => gate.run(async () => Reflect.apply(value, target, args));
    },
  });
}
