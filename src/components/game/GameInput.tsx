import React from "react";
import { View } from "react-native";
import { SubmitButton } from "./SubmitButton"; // Adjust path as needed
import { styles } from "src/styles";
import { GameInputButton } from "./GameInputButton";
import HintIcon from "../../../assets/images/hint.svg";
import ForwardIcon from "../../../assets/images/forward.svg";

type GameInputProps = {
  isSubmitDisabled: boolean;
  gameOver: boolean;
  handleSubmit: () => void;
  handleHint: () => void;
  handleNext: () => void;
};

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
