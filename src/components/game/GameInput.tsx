import React from "react";
import { View } from "react-native";
import { SubmitButton } from "./SubmitButton"; // Adjust path as needed
import { styles } from "src/styles";

type GameInputProps = {
  isSubmitDisabled: boolean;
  gameOver: boolean;
  handleKeyPress: (key: string) => void;
};

export const GameInput = ({
  isSubmitDisabled,
  gameOver,
  handleKeyPress,
}: GameInputProps): JSX.Element => {
  return (
    <View style={styles.gameInput}>
      <SubmitButton
        isSubmitDisabled={isSubmitDisabled}
        gameOver={gameOver}
        handleKeyPress={handleKeyPress}
      />
    </View>
  );
};
