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

  const handlePress = async () => {
    console.log(`WideButton pressed: ${buttonText}`);
    console.log("onPress type:", typeof onPress);

    if (typeof onPress === "function") {
      try {
        // Handle both async and non-async onPress functions
        await Promise.resolve(onPress());
        console.log(`${buttonText} onPress handler executed successfully`);
      } catch (error) {
        console.error(`Error in ${buttonText} onPress handler:`, error);
        console.log(
          `${buttonText} button press failed to execute callback properly`
        );
      }
    } else {
      console.warn(`${buttonText} onPress is not a function or is undefined`);
      console.log(
        `${buttonText} button pressed but no action will be taken (missing callback)`
      );

      // In debug mode, provide more helpful information
      if (__DEV__) {
        console.log(
          `DEBUG INFO: ${buttonText} button needs an onPress function to work properly`
        );
        console.log(
          `Check how this button is being rendered and ensure onPress is provided correctly`
        );
      }
    }
  };

  return (
    <TouchableOpacity
      className={`w-full rounded-lg py-3 px-6 my-2 ${
        disabled ? "bg-gray-300" : bg
      }`}
      onPress={handlePress}
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
