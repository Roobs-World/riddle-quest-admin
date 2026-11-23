import {Timestamp} from "firebase-admin/firestore";

/** Snapshot copies retain real Firestore timestamp instances while isolating mutable run data. */
export function cloneLiveRaceFixture(value: unknown): unknown {
  if (value instanceof Timestamp) return value;
  if (value instanceof Map) return new Map([...value].map(([key, item]) => [key, cloneLiveRaceFixture(item)]));
  if (Array.isArray(value)) return value.map(cloneLiveRaceFixture);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneLiveRaceFixture(item)]));
  return value;
}
