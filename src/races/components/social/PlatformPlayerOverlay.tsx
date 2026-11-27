import {useEffect, useLayoutEffect, useRef, useState} from "react";
import type {OverlayCapability} from "../../../platform/contracts/capabilities";

/** Opaque identity and provider operations own one isolated presentation lifetime. */
type PlatformPlayerOverlayProps = {
  /** Provider owns all identity rendering and cleanup. */ overlay: OverlayCapability;
  /** Opaque current-player identity supplied by the target. */ playerId: string;
};

/** Replaces retired provider surfaces before replacement children commit. */
export function PlatformPlayerOverlay(props: PlatformPlayerOverlayProps) {
  /** Immutable ownership also detects operation replacement on an existing provider object. */
  const [owner, setOwner] = useState(() => ({provider: props.overlay, render: props.overlay.renderPlayer,
    playerId: props.playerId, version: 0}));
  if (owner.provider !== props.overlay || owner.render !== props.overlay.renderPlayer || owner.playerId !== props.playerId)
    setOwner({provider: props.overlay, render: props.overlay.renderPlayer, playerId: props.playerId, version: owner.version + 1});
  return <PlatformPlayerOverlaySurface key={owner.version} {...props} />;
}

/** Mounts provider-owned UI without reading profile fields into the game. */
function PlatformPlayerOverlaySurface({overlay, playerId}: PlatformPlayerOverlayProps) {
  /** Stable host retains the existing overlay layout. */
  const hostRef = useRef<HTMLDivElement>(null);
  /** Each effect incarnation receives a separate provider mount surface. */
  const ownedSurface = useRef<HTMLDivElement | null>(null);
  /** Commit retirement immediately cancels the original partial native initialization. */
  const ownedCancellation = useRef<AbortController | null>(null);
  useLayoutEffect(() => () => {ownedSurface.current?.remove(); ownedCancellation.current?.abort();}, []);
  useEffect(() => {
    /** A detached host cannot admit provider work. */
    const host = hostRef.current;
    if (!host) return;
    /** Replay and late initialization cannot render into another incarnation's surface. */
    const surface = document.createElement("div");
    surface.dataset.platformOwnedIdentity = "";
    surface.style.minHeight = "inherit";
    surface.style.width = "100%";
    host.append(surface); ownedSurface.current = surface;
    /** A stalled optional profile cannot retain partially created views indefinitely. */
    const controller = new AbortController();
    ownedCancellation.current = controller;
    /** The deadline retires this surface without blocking unrelated game presentation. */
    const timeout = window.setTimeout(() => {surface.remove(); controller.abort();}, 8000);
    /** Only this admitted effect can retain its cleanup operation. */
    let active = true;
    /** A successful provider owns its own idempotent cleanup. */
    let destroy: (() => Promise<void>) | undefined;
    /** Optional cleanup failures cannot escape into the game's lifecycle. */
    const dispose = (stop: () => Promise<void>) => {void Promise.resolve().then(stop).catch(() => {});};
    /** Preserve the original provider receiver across deferred admission. */
    const render = overlay.renderPlayer;
    void Promise.resolve().then(() => active && surface.isConnected && !controller.signal.aborted
      ? render.call(overlay, {playerId, surface, signal: controller.signal}) : undefined)
      .then(result => {
        if (result?.status !== "success") return;
        if (!active || !surface.isConnected) dispose(() => result.value());
        else destroy = () => result.value();
      }).catch(() => {}).finally(() => {window.clearTimeout(timeout);});
    return () => {
      active = false; surface.remove(); controller.abort(); window.clearTimeout(timeout);
      if (ownedSurface.current === surface) ownedSurface.current = null;
      if (ownedCancellation.current === controller) ownedCancellation.current = null;
      if (destroy) dispose(destroy);
    };
  }, [overlay, playerId]);
  return <div className="race-platform-player-overlay" ref={hostRef} />;
}
