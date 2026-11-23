import {useRef} from "react";
import chestClosedUrl from "../../../../../../assets/images-web/chest-closed.png";
import chestOpenUrl from "../../../../../../assets/images-web/chest-open.webp";
import {useTranslator} from "../../i18n";
import {CoinFlight} from "../../CoinFlight";

/** Opens the reward chest when its tab reaches the front, then sends coins to the counter. */
export function CoinAwardSequence({amount, total, collecting = true, onBalancePreview}: {
  /** Amount already granted by the active target's authority. */ amount: number;
  /** Confirmed balance after the award. */ total: number;
  /** Queued tabs wait until they reach the front. */ collecting?: boolean;
  /** Decorative counter updates never write economy state. */ onBalancePreview: (balance: number | null) => void;
}) {
  /** Translated reward labels for the active locale. */
  const tr = useTranslator();
  /** Chest element anchoring the decorative coin flight. */
  const source = useRef<HTMLDivElement>(null);
  return <div className="coin-award">
    <div ref={source} className={`reward-chest ${collecting ? "collecting" : "waiting"}`} aria-hidden="true">
      <img src={collecting ? chestOpenUrl : chestClosedUrl} alt="" width="56" height="52" />
    </div>
    <strong>+{Math.max(0, Math.round(amount)).toLocaleString()}{tr("CoinPurchase.COINS_SUFFIX")}</strong>
    {collecting && <CoinFlight source={source} amount={amount} total={total} onBalancePreview={onBalancePreview} />}
  </div>;
}
