import treasureChestUrl from "../../../../../../assets/images-web/chest-open.webp";
import type {GameModal} from "../../gameSession";
import {useTranslator} from "../../i18n";
export {ContinueModalPage, type ContinueModalPageProps} from "./ContinueActions";
export {HintModalPage, SkipModalPage, type CoinActionModalPageProps} from "./GameplayCoinActions";

/** Opens another modal without allowing the null/closed state. */
type OpenModalHandler = (modal: Exclude<GameModal, null>) => void;

/** Props for the profile treasure balance page. */
export type TreasureModalPageProps = {
  /** Stores balance. */
  balance: number;
  /** Stores on open modal. */
  onOpenModal: OpenModalHandler;
  /** Stores commerce available. */
  commerceAvailable?: boolean;
};

/** Renders the current coin balance and a route to the platform shop. */
export function TreasureModalPage({balance, onOpenModal, commerceAvailable = true}: TreasureModalPageProps) {
  /** Copy changes invalidate compiler caches while preserving local page state. */
  const tr = useTranslator();
  return (
    <div className="treasure-chest">
      <img src={treasureChestUrl} alt="" />
      <strong>
        {balance.toLocaleString()} {tr("CoinShop.COINS_SUFFIX")}
      </strong>
      {commerceAvailable && (
        <button className="play-primary" onClick={() => onOpenModal("shop")}>
          {tr("Navigation.BUY_COINS_BUTTON")}
        </button>
      )}
    </div>
  );
}
