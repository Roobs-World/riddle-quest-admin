import {useEffect, useRef, type MutableRefObject} from "react";
import {createPurchaseRecovery} from "@riddle-quest/hosted/commerce/purchaseRecovery";
import type {HostServices} from "@riddle-quest/hosted/hostTypes";
import {captureBrowserException} from "../observability/browserErrorReporter";
import type {NotificationOperationGate} from "./notifications/operationGate";
import type {JestPurchaseCoordinator} from "./purchases";
import type {JestSession} from "./types";

/** Retries unsettled purchases after login, foregrounding, or restored connectivity. */
export function useJestPurchaseRecovery({purchases, session, sessionRef, gate, refreshProducts, hostServices}: {
  /** Provider recovery preserves server grant before purchase completion. */
  purchases: Pick<JestPurchaseCoordinator, "reconcile">;
  /** Ready session whose startup recovery has already finished. */
  session: JestSession | null;
  /** Synchronous account ownership check for late provider responses. */
  sessionRef: MutableRefObject<JestSession | null>;
  /** Account deletion waits for admitted recovery before clearing identity. */
  gate: Pick<NotificationOperationGate, "isOpen" | "run">;
  /** Reloads provider products and verifies current subscription entitlements. */
  refreshProducts(): Promise<void>;
  /** Publishes the current authoritative balance after successful recovery. */
  hostServices: Pick<HostServices, "loadProfile">;
}): void {
  /** Registration refreshes the catalog callback without replacing its recovery owner. */
  const refreshProductsRef = useRef(refreshProducts);
  refreshProductsRef.current = refreshProducts;
  /** Startup already recovers the first owner; later identity replacements need their own check. */
  const initializedOwnerRef = useRef<{
    /** Last committed provider player. */
    playerId: string;
    /** Last committed backend identity. */
    firebaseUid: string;
  } | null>(null);
  /** Exact provider player that owns this recovery drain. */
  const playerId = session?.player.playerId;
  /** Firebase identity must match before refreshing authoritative account data. */
  const firebaseUid = session?.firebaseUid;
  useEffect(() => {
    if (!playerId || !firebaseUid) return;
    /** Capture identity changes after React commits, even when login dispatched its event earlier. */
    const previousOwner = initializedOwnerRef.current;
    initializedOwnerRef.current = {playerId, firebaseUid};
    /** Cleanup retires queued work without abandoning an admitted durable grant. */
    let active = true;
    /** Pending work may publish only into the exact account that requested it. */
    const ownsAccount = () => active && gate.isOpen() &&
      sessionRef.current?.player.playerId === playerId && sessionRef.current.firebaseUid === firebaseUid;
    /** Shared recovery coalesces overlapping browser signals into one ordered drain. */
    const recovery = createPurchaseRecovery({
      restore: () => gate.run(async () => {
        if (!ownsAccount()) return;
        /** Reconciliation grants each signed receipt before acknowledging it to Jest. */
        const result = await purchases.reconcile(playerId);
        if (result.status !== "success") {
          /** A failed receipt stays in the provider queue for the next wake. */
          const error = new Error("message" in result ? result.message : result.status);
          captureBrowserException(error, {component: "jest_purchase_recovery"});
          throw error;
        }
      }),
      onRecovered: async () => {
        if (!ownsAccount()) return;
        // Catalog refresh already owns the deletion gate. Avoid nesting browser locks.
        await refreshProductsRef.current();
        if (!ownsAccount()) return;
        await gate.run(async () => {
          if (ownsAccount()) await hostServices.loadProfile(firebaseUid);
        });
      },
    });
    /** Hidden documents wait until play returns instead of starting provider work. */
    const wake = () => {
      if (ownsAccount() && document.visibilityState !== "hidden") void recovery.request();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    window.addEventListener("pageshow", wake);
    window.addEventListener("riddle-quest:registration-prompt-closed", wake);
    if (previousOwner && (previousOwner.playerId !== playerId || previousOwner.firebaseUid !== firebaseUid)) wake();
    return () => {
      active = false;
      recovery.dispose();
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("pageshow", wake);
      window.removeEventListener("riddle-quest:registration-prompt-closed", wake);
    };
  }, [firebaseUid, gate, hostServices, playerId, purchases, sessionRef]);
}
