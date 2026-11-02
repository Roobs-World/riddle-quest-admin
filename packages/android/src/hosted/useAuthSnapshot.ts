import type {AuthSnapshot, HostServices} from "@qwordly/hosted/hostTypes";
import {useEffect, useState} from "react";
/** Subscribes to the shared services' account snapshot so screens show the server-confirmed balance. */
export function useAuthSnapshot(services: HostServices): AuthSnapshot {
  /** Latest snapshot. */
  const [snapshot, setSnapshot] = useState<AuthSnapshot>({user: null, profile: null});
  useEffect(() => services.auth.subscribe((next) => setSnapshot(next)), [services]);
  return snapshot;
}
