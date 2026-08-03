import {memo} from "react";
import {tr} from "../../i18n";
import coinUrl from "../../../../../../assets/images/coin.svg";

/** Displays the player’s current coin balance in race chrome. */
function RaceCoinBalance({coins}: {coins: number}) {
  /** Locale-formatted coin amount shown to the player and assistive technology. */
  const formattedCoins = coins.toLocaleString();
  return (
    <div
      className="race-coin-balance"
      aria-label={`${tr("Profile.TOTAL_COINS_LABEL")} ${formattedCoins}`}
    >
      <strong>{formattedCoins}</strong>
      <img src={coinUrl} alt="" />
    </div>
  );
}

/** Closes the current race screen through its owning controller. */
function RaceCloseButton({onClose}: {onClose: () => void}) {
  return (
    <button className="race-close" onClick={onClose} aria-label={tr("RaceTo10.CLOSE")}>
      ×
    </button>
  );
}

/** Renders the shared multiplayer mode label and accessible page title. */
function RaceTitle() {
  return (
    <>
      <span className="race-kicker">{tr("RaceTo10.MODE_LABEL")}</span>
      <h1 id="race-title">{tr("RaceTo10.TITLE")}</h1>
    </>
  );
}

/** Header used by non-gameplay multiplayer screens. */
export const RaceTopbar = memo(function RaceTopbar({coins, onClose}: {coins: number; onClose: () => void}) {
  return (
    <header className="race-topbar">
      <div>
        <RaceTitle />
      </div>
      <div className="race-topbar-actions">
        <RaceCoinBalance coins={coins} />
        <RaceCloseButton onClose={onClose} />
      </div>
    </header>
  );
});

/** Compact header placed inside the right-hand multiplayer rail. */
export const RaceRailHeader = memo(function RaceRailHeader({coins, onClose}: {coins: number; onClose: () => void}) {
  return (
    <div className="race-rail-header">
      <RaceTitle />
      <RaceCoinBalance coins={coins} />
      <RaceCloseButton onClose={onClose} />
    </div>
  );
});
