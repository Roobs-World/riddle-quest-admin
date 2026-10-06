import {useEffect, useRef} from "react";
import type {OverlayCapability} from "../../../platform/types";

/** Mounts provider-owned identity UI without reading profile fields into the game. */
export function PlatformPlayerOverlay({
  overlay,
  playerId,
}: {
  /** Stores overlay. */
  overlay: OverlayCapability;
  /** Stores player id. */
  playerId: string;
}) {
  /** Provides surface ref behavior. */
  const surfaceRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    /** Provides surface behavior. */
    const surface = surfaceRef.current;
    if (!surface) return;
    /** Provides active behavior. */
    let active = true;
    /** Provides destroy behavior. */
    let destroy: (() => Promise<void>) | undefined;
    void overlay.renderPlayer({playerId, surface}).then((result) => {
      if (result.status !== "success") return;
      if (!active) void result.value();
      else destroy = result.value;
    });
    return () => {
      active = false;
      void destroy?.();
    };
  }, [overlay, playerId]);
  return <div className="race-platform-player-overlay" ref={surfaceRef} data-platform-owned-identity />;
}
