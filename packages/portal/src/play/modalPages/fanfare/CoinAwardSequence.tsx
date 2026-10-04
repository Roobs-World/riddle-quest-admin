import {useLayoutEffect, useRef, useState, type CSSProperties} from "react";
import {isPlayerReducedMotionEnabled} from "../../playerPreferences";
import {createPortal} from "react-dom";
import coinUrl from "../../../../../../assets/images/coin.svg";
import treasureChestClosedUrl from "../../../../../../assets/images-web/chest-closed.png";
import treasureChestUrl from "../../../../../../assets/images-web/chest-open.webp";
import {useTranslator} from "../../i18n";

/** A coin's position and timing within the collection animation. */
type CoinParticle = {
  /** Stores id. */
  id: number;
  /** Stores start x. */
  startX: number;
  /** Stores start y. */
  startY: number;
  /** Stores travel x. */
  travelX: number;
  /** Stores travel y. */
  travelY: number;
  /** Stores burst x. */
  burstX: number;
  /** Stores burst y. */
  burstY: number;
  /** Stores delay ms. */
  delayMs: number;
  /** Stores duration ms. */
  durationMs: number;
};

/** CSS custom properties used by an animated coin particle. */
type CoinParticleStyle = CSSProperties & {
  /** Stores coin travel x. */
  "--coin-travel-x": string;
  /** Stores coin travel y. */
  "--coin-travel-y": string;
  /** Stores coin burst x. */
  "--coin-burst-x": string;
  /** Stores coin burst y. */
  "--coin-burst-y": string;
  /** Stores coin delay. */
  "--coin-delay": string;
  /** Stores coin duration. */
  "--coin-duration": string;
};

/** Inputs required to animate and report a collected coin award. */
export type CoinAwardSequenceProps = {
  /** Stores amount. */
  amount: number;
  /** Stores total. */
  total: number;
  /** Stores on balance preview. */
  onBalancePreview: (balance: number | null) => void;
  /** Stores on collected. */
  onCollected: () => void;
};

/** Renders the interactive treasure-chest coin collection sequence. */
export function CoinAwardSequence({amount, total, onBalancePreview, onCollected}: CoinAwardSequenceProps) {
  /** Copy changes invalidate compiler caches while preserving local page state. */
  const tr = useTranslator();
  /** Provides [phase, set phase] behavior. */
  const [phase, setPhase] = useState<"waiting" | "collecting" | "collected">("waiting");
  /** Provides [particles, set particles] behavior. */
  const [particles, setParticles] = useState<CoinParticle[]>([]);
  /** Provides chest ref behavior. */
  const chestRef = useRef<HTMLButtonElement | null>(null);
  /** Provides timers ref behavior. */
  const timersRef = useRef<number[]>([]);
  /** Provides safe amount behavior. */
  const safeAmount = Math.max(0, Math.round(amount));
  /** Provides final balance behavior. */
  const finalBalance = Math.max(0, Math.round(total));
  /** Starts ing balance. */
  const startingBalance = Math.max(0, finalBalance - safeAmount);

  useLayoutEffect(() => {
    onBalancePreview(startingBalance);
    return () => {
      for (const timer of timersRef.current) window.clearTimeout(timer);
      timersRef.current = [];
    };
  }, [onBalancePreview, startingBalance]);

  /** Starts the coin animation or completes immediately when the target meter is unavailable. */
  const collectCoins = () => {
    if (phase !== "waiting" || safeAmount <= 0) return;
    /** Provides chest rect behavior. */
    const chestRect = chestRef.current?.getBoundingClientRect();
    /** Provides meter behavior. */
    const meter = document.querySelector<HTMLElement>("[data-coin-meter]");
    /** Provides meter rect behavior. */
    const meterRect = meter?.getBoundingClientRect();
    if (!chestRect || !meter || !meterRect) {
      onBalancePreview(finalBalance);
      setPhase("collected");
      onCollected();
      return;
    }

    /** Provides reduced motion behavior. */
    const reducedMotion = isPlayerReducedMotionEnabled();
    /** Provides particle count behavior. */
    const particleCount = Math.min(12, Math.max(1, safeAmount));
    /** Provides base value behavior. */
    const baseValue = Math.floor(safeAmount / particleCount);
    /** Provides remainder behavior. */
    const remainder = safeAmount % particleCount;
    /** Provides source x behavior. */
    const sourceX = chestRect.left + chestRect.width / 2;
    /** Provides source y behavior. */
    const sourceY = chestRect.top + chestRect.height * 0.42;
    /** Provides target x behavior. */
    const targetX = meterRect.left + meterRect.width * 0.72;
    /** Provides target y behavior. */
    const targetY = meterRect.top + meterRect.height / 2;
    /** Provides duration ms behavior. */
    const durationMs = reducedMotion ? 180 : 620;
    /** Provides delay step ms behavior. */
    const delayStepMs = reducedMotion ? 35 : 95;
    /** Provides next particles behavior. */
    const nextParticles = Array.from({length: particleCount}, (_, index): CoinParticle => {
      /** Provides angle behavior. */
      const angle = (-150 + (index * 300) / Math.max(1, particleCount - 1)) * (Math.PI / 180);
      /** Provides burst distance behavior. */
      const burstDistance = 36 + (index % 3) * 10;
      return {
        id: index,
        startX: sourceX,
        startY: sourceY,
        travelX: targetX - sourceX,
        travelY: targetY - sourceY,
        burstX: Math.cos(angle) * burstDistance,
        burstY: Math.sin(angle) * burstDistance - 24,
        delayMs: index * delayStepMs,
        durationMs,
      };
    });

    setPhase("collecting");
    setParticles(nextParticles);
    /** Provides displayed balance behavior. */
    let displayedBalance = startingBalance;
    nextParticles.forEach((particle, index) => {
      /** Provides particle value behavior. */
      const particleValue = baseValue + (index < remainder ? 1 : 0);
      /** Provides timer behavior. */
      const timer = window.setTimeout(() => {
        displayedBalance += particleValue;
        onBalancePreview(index === nextParticles.length - 1 ? finalBalance : displayedBalance);
        if (index === nextParticles.length - 1) {
          setParticles([]);
          setPhase("collected");
          onCollected();
        }
        try {
          meter.animate?.(
            [{transform: "scale(1)"}, {transform: "scale(1.24)"}, {transform: "scale(0.94)"}, {transform: "scale(1)"}],
            {duration: reducedMotion ? 120 : 260, easing: "ease-out"},
          );
        } catch {
          // A visual effect must not prevent the award from completing.
        }
      }, particle.delayMs + particle.durationMs);
      timersRef.current.push(timer);
    });
  };

  return (
    <div className="coin-award" data-coin-collection={phase === "collected" ? "complete" : "pending"}>
      <button
        ref={chestRef}
        type="button"
        className={`reward-chest ${phase}`}
        disabled={phase !== "waiting"}
        onClick={collectCoins}
        aria-label={tr("CoinPurchase.TAP_CHEST_TO_COLLECT")}
      >
        <img src={phase === "waiting" ? treasureChestClosedUrl : treasureChestUrl} alt="" />
      </button>
      <strong>
        +{safeAmount.toLocaleString()}
        {tr("CoinPurchase.COINS_SUFFIX")}
      </strong>
      <span aria-live="polite">
        {phase === "collected"
          ? `${finalBalance.toLocaleString()} ${tr("CoinShop.COINS_SUFFIX")}`
          : tr("CoinPurchase.TAP_CHEST_TO_COLLECT")}
      </span>
      {particles.length > 0 &&
        createPortal(
          <div className="reward-coin-particles" aria-hidden="true">
            {particles.map((particle) => (
              <img
                key={particle.id}
                className="reward-coin-particle"
                src={coinUrl}
                alt=""
                style={
                  {
                    left: particle.startX,
                    top: particle.startY,
                    "--coin-travel-x": `${particle.travelX}px`,
                    "--coin-travel-y": `${particle.travelY}px`,
                    "--coin-burst-x": `${particle.burstX}px`,
                    "--coin-burst-y": `${particle.burstY}px`,
                    "--coin-delay": `${particle.delayMs}ms`,
                    "--coin-duration": `${particle.durationMs}ms`,
                  } as CoinParticleStyle
                }
              />
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
