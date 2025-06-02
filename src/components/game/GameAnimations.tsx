import React from "react";
import ShatteringTitle from "../animations/ShatteringTitle";
import ShatteringTiles from "../animations/ShatteringTiles";

interface TileData {
  letter: string | null;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  x: number;
  y: number;
}

interface GameAnimationsProps {
  isWin: boolean;
  tilesData: TileData[];
  startShatterAnimation: boolean;
  startTileShatterAnimation: boolean;
}

const GameAnimations: React.FC<GameAnimationsProps> = ({
  isWin,
  tilesData,
  startShatterAnimation,
  startTileShatterAnimation,
}) => {
  if (!isWin) return null;

  return (
    <>
      <ShatteringTitle
        title="YOU WON!"
        startAnimation={startShatterAnimation}
      />
      {tilesData.length > 0 && (
        <ShatteringTiles
          tiles={tilesData}
          startAnimation={startTileShatterAnimation}
          onAnimationComplete={() => {
            console.log("Tile shattering animation completed");
          }}
        />
      )}
    </>
  );
};

export default GameAnimations;
