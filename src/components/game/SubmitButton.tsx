import { Text, TouchableOpacity } from "react-native";

type SubmitButtonProps = {
  isSubmitDisabled: boolean;
  gameOver: boolean;
  handleKeyPress: (key: string) => void;
};

export const SubmitButton = ({
  isSubmitDisabled,
  gameOver,
  handleKeyPress,
}: SubmitButtonProps): JSX.Element => {
  return (
    <TouchableOpacity
      className={`px-14 py-4 rounded-full mx-auto ${
        isSubmitDisabled || gameOver
          ? "bg-secondary-orange"
          : "bg-primary-orange"
      }`}
      onPress={() => {
        if (!isSubmitDisabled && !gameOver) {
          handleKeyPress("ENTER");
        }
      }}
      disabled={isSubmitDisabled || gameOver}
      testID="submit-button"
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel="Submit current guess"
    >
      <Text className="text-black font-bold text-lg">SUBMIT</Text>
    </TouchableOpacity>
  );
};
