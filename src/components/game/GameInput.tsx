import React from "react";
import { View } from "react-native";
import { SubmitButton } from "./SubmitButton"; // Adjust path as needed
import { styles } from "src/styles";
import { GameInputButton } from "./GameInputButton";
import HintIcon from "../../../assets/images/hint.svg";
import ForwardIcon from "../../../assets/images/forward.svg";

/**
 * Props for the gameplay action row beneath the board.
 */
type GameInputProps = {
  /** Disables submit interactions while the current guess is invalid. */
  isSubmitDisabled: boolean;
  /** Disables actions that should not run after the game has ended. */
  gameOver: boolean;
  /** Commits the current guess. */
  handleSubmit: () => void;
  /** Opens the hint flow for the current riddle. */
  handleHint: () => void;
  /** Opens skip/next-level flow. */
  handleNext: () => void;
};

/**
 * Renders hint, submit, and next action buttons used during gameplay.
 *
 * @param props Input action handlers and disabled flags.
 * @returns Three-button input action row.
 */
const GameInputComponent = ({
  isSubmitDisabled,
  gameOver,
  handleSubmit,
  handleHint,
  handleNext,
}: GameInputProps): React.JSX.Element => {
  return (
    <View style={styles.gameInput}>
      <GameInputButton
        icon={<HintIcon />}
        text="Hint"
        callback={() => handleHint()}
      />

      <SubmitButton
        isSubmitDisabled={isSubmitDisabled}
        gameOver={gameOver}
        handleKeyPress={() => handleSubmit()}
      />

      <GameInputButton
        icon={<ForwardIcon />}
        text="Next"
        callback={() => handleNext()}
      />
    </View>
  );
};

export const GameInput = React.memo(GameInputComponent);
