import React from "react";
import { View } from "react-native";
import { SubmitButton } from "./SubmitButton"; // Adjust path as needed
import { styles } from "src/styles";
import { GameInputButton } from "./GameInputButton";
import HintIcon from "../../../assets/images/hint.svg";
import ForwardIcon from "../../../assets/images/forward.svg";
import { AppStrings } from "../../constants/AppStrings";

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
  hintButtonRef?: React.Ref<View>;
  submitButtonRef?: React.Ref<View>;
  nextButtonRef?: React.Ref<View>;
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
  hintButtonRef,
  submitButtonRef,
  nextButtonRef,
}: GameInputProps): React.JSX.Element => {
  return (
    <View style={styles.gameInput}>
      <GameInputButton
        ref={hintButtonRef}
        icon={<HintIcon />}
        text={AppStrings.Navigation.HINT_BUTTON}
        callback={handleHint}
      />

      <SubmitButton
        ref={submitButtonRef}
        isSubmitDisabled={isSubmitDisabled}
        gameOver={gameOver}
        handleKeyPress={handleSubmit}
      />

      <GameInputButton
        ref={nextButtonRef}
        icon={<ForwardIcon />}
        text={AppStrings.GameScreenAlerts.NEXT_BUTTON}
        callback={handleNext}
      />
    </View>
  );
};

export const GameInput = React.memo(GameInputComponent);
