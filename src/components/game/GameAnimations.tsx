import React from "react";
import ShatteringTitle from "../animations/ShatteringTitle";

interface GameAnimationsProps {
  isWin: boolean;
  startShatterAnimation: boolean;
}

const GameAnimations: React.FC<GameAnimationsProps> = ({
  isWin,
  startShatterAnimation,
}) => {
  if (!isWin) return null;

  return (
    <>
      <ShatteringTitle
        title="YOU WON!"
        startAnimation={startShatterAnimation}
      />
    </>
  );
};

export default GameAnimations;
