import React from "react";
import StaticTitle from "../animations/StaticTitle";

interface GameAnimationsProps {
  isWin: boolean;
}

const GameAnimations: React.FC<GameAnimationsProps> = ({ isWin }) => {
  if (!isWin) return null;

  return (
    <>
      <StaticTitle title="YOU WON!" />
    </>
  );
};

export default GameAnimations;
