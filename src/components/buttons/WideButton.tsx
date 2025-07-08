import React from "react";
import { TouchableOpacity, Text } from "react-native";
import { styles } from "../../styles";

interface WideButtonProps {
  buttonText: string;
  onPress: () => void;
  disabled?: boolean;
  buttonColor?: string;
}

/**
 * WideButton component for full-width buttons in the app.
 * Displays text and handles press events.
 * Can be disabled to prevent interaction.
 *
 * @param {WideButtonProps} props - The properties for the button.
 * @returns {React.FC<WideButtonProps>} A TouchableOpacity component with text.
 */
const WideButton: React.FC<WideButtonProps> = ({
  buttonText,
  onPress,
  disabled = false,
  buttonColor,
}) => {
  const bg = buttonColor || "bg-primary-orange";

  return (
    <TouchableOpacity
      className={`w-full rounded-lg py-3 px-6 my-4 ${
        disabled ? "bg-gray-300" : bg
      }`}
      onPress={onPress}
      disabled={disabled}
      style={styles.buttonOpacity}
    >
      <Text
        className={`font-semibold text-center ${
          disabled ? "text-gray-500" : "text-white"
        }`}
        style={styles.buttonText}
      >
        {buttonText}
      </Text>
    </TouchableOpacity>
  );
};

export default WideButton;
