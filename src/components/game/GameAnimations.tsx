import React from "react";
import StaticTitle from "../animations/StaticTitle";
import {t} from "../../i18n";

/**
 * Props controlling conditional game animation rendering.
 */
interface GameAnimationsProps {
  /** When true, renders the win-title animation. */
  isWin: boolean;
}

/**
 * Renders game-result animations that sit above gameplay content.
 *
 * @param props Animation trigger flags.
 * @returns Win title animation when the player has won; otherwise `null`.
 */
const GameAnimations: React.FC<GameAnimationsProps> = ({isWin}) => {
  if (!isWin) return null;

  return (
    <>
      <StaticTitle title={t("VictoryModal.YOU_WON_TITLE")} />
    </>
  );
};

export default GameAnimations;
