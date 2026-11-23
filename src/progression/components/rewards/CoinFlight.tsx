import {useLayoutEffect, useRef, useState, type CSSProperties, type RefObject} from "react";
import {createPortal} from "react-dom";
import coinUrl from "../../../../assets/images/coin.svg";
import {isPlayerReducedMotionEnabled} from "../../../settings/browser/playerPreferences";
import "../../styles/coin-flight.css";

/** CSS coordinates for a particle travelling from any award to the header counter. */
type CoinParticleStyle = CSSProperties & {
  /** Horizontal distance to the counter icon. */ "--coin-travel-x": string;
  /** Vertical distance to the counter icon. */ "--coin-travel-y": string;
  /** Horizontal spread before collection. */ "--coin-burst-x": string;
  /** Vertical spread before collection. */ "--coin-burst-y": string;
  /** Stagger between coins. */ "--coin-delay": string;
  /** Travel time. */ "--coin-duration": string;
};

/** Reusable decoration for a confirmed reward; mount once per award with a stable key. */
export function CoinFlight({source, amount, total, onBalancePreview}: {
  /** Element from which the coins emerge. */ source: RefObject<HTMLElement | null>;
  /** Granted amount; never used to change authoritative state. */ amount: number;
  /** Confirmed balance after this grant. */ total: number;
  /** Temporary header counter updates; null restores its current authoritative balance. */ onBalancePreview: (balance: number | null) => void;
}) {
  /** Visible decorative coins for this confirmed award. */
  const [particles, setParticles] = useState<CoinParticleStyle[]>([]);
  /** Current counter callback without restarting the flight. */
  const latestPreview = useRef(onBalancePreview);
  useLayoutEffect(() => {latestPreview.current = onBalancePreview;}, [onBalancePreview]);
  useLayoutEffect(() => {
    /** Whole nonnegative coins represented by this decoration. */
    const granted = Math.max(0, Math.round(amount));
    /** Confirmed balance restored when the decoration finishes. */
    const balance = Math.max(0, Math.round(total));
    /** Chest bounds at the start of the flight. */
    const start = source.current?.getBoundingClientRect();
    /** Header counter that receives the decorative coins. */
    const meter = document.querySelector<HTMLElement>("[data-coin-meter]");
    /** Counter icon bounds, falling back to the counter itself. */
    const target = meter?.querySelector("img")?.getBoundingClientRect() ?? meter?.getBoundingClientRect();
    if (!granted || !start || !target || !target.width || isPlayerReducedMotionEnabled()) {
      latestPreview.current(null);
      return;
    }
    /** Bounded particle count independent of reward size. */
    const count = Math.min(10, granted);
    /** Horizontal center of the source chest. */
    const x = start.left + start.width / 2;
    /** Vertical center of the source chest. */
    const y = start.top + start.height / 2;
    /** Viewport coordinates and staggered timing for each particle. */
    const next = Array.from({length: count}, (_, index): CoinParticleStyle => ({
      left: x, top: y,
      "--coin-travel-x": `${target.left + target.width / 2 - x}px`,
      "--coin-travel-y": `${target.top + target.height / 2 - y}px`,
      "--coin-burst-x": `${Math.sin(index * 2.4) * 32}px`,
      "--coin-burst-y": `${-24 - (index % 3) * 10}px`,
      "--coin-delay": `${index * 22}ms`,
      "--coin-duration": "560ms",
    }));
    latestPreview.current(Math.max(0, balance - granted));
    setParticles(next);
    /** Counter animations cancelled when this award retires. */
    const pulses: Animation[] = [];
    /** Arrival callbacks retired with the current flight. */
    const timers = next.map((_, index) => window.setTimeout(() => {
      /** Final particle restores the authoritative counter. */
      const last = index === count - 1;
      latestPreview.current(last ? null : Math.max(0, balance - granted) + Math.floor(granted * (index + 1) / count));
      if (last) setParticles([]);
      try {
        /** Optional counter feedback cannot decide the grant. */
        const pulse = meter?.animate?.([{transform: "scale(1)"}, {transform: "scale(1.12)"}, {transform: "scale(1)"}],
          {duration: 180, easing: "ease-out"});
        if (pulse) pulses.push(pulse);
      } catch {
        // Animation support does not affect the granted reward.
      }
    }, 560 + index * 22));
    return () => {
      timers.forEach(window.clearTimeout);
      pulses.forEach(pulse => pulse.cancel());
      latestPreview.current(null);
    };
  }, [source, amount, total]);

  return particles.length ? createPortal(<div className="reward-coin-particles" aria-hidden="true">
    {particles.map((style, index) => <img key={index} className="reward-coin-particle" src={coinUrl} alt="" style={style} />)}
  </div>, document.body) : null;
}
