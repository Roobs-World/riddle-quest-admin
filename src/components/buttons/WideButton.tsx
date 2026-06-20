import React from "react";
import {TouchableOpacity, Text} from "react-native";
import {styles, SPACING, TYPOGRAPHY} from "../../styles";
import {verticalScale} from "../../utils/responsive";
import {logger} from "../../utils/logger";
import {captureException} from "../../utils/sentry";
import {analyticsService} from "../../services/AnalyticsService";

interface WideButtonProps {
  buttonText: string;
  onPress: () => void;
  disabled?: boolean;
  buttonColor?: string;
  textColor?: string;
  testID?: string;
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
  textColor,
  testID,
}) => {
  const bg = buttonColor || "bg-primary-orange";

  const handlePress = async () => {
    logger.debug(`WideButton pressed: ${buttonText}`);
    logger.debug("onPress type:", typeof onPress);
    void analyticsService.logButtonPress?.(testID ?? "wide_button", {
      label: buttonText,
      disabled,
    });

    if (typeof onPress === "function") {
      try {
        // Handle both async and non-async onPress functions
        await Promise.resolve(onPress());
        logger.debug(`${buttonText} onPress handler executed successfully`);
      } catch (error) {
        logger.error(`Error in ${buttonText} onPress handler:`, error);
        captureException(error);
        logger.debug(`${buttonText} button press failed to execute callback properly`);
      }
    } else {
      logger.warn(`${buttonText} onPress is not a function or is undefined`);
      logger.debug(`${buttonText} button pressed but no action will be taken (missing callback)`);

      // In debug mode, provide more helpful information
      if (__DEV__) {
        logger.debug(`DEBUG INFO: ${buttonText} button needs an onPress function to work properly`);
        logger.debug(`Check how this button is being rendered and ensure onPress is provided correctly`);
      }
    }
  };

  return (
    <TouchableOpacity
      className={`w-full rounded-lg ${disabled ? "bg-gray-300" : bg}`}
      onPress={handlePress}
      disabled={disabled}
      testID={testID}
      style={[styles.buttonOpacity, {paddingVertical: verticalScale(12), paddingHorizontal: SPACING.lg}]}
    >
      <Text
        className={`text-center ${disabled ? "text-gray-500" : textColor || "text-white"}`}
        style={[styles.buttonText, {fontFamily: TYPOGRAPHY.fontSecondaryBold}]}
      >
        {buttonText}
      </Text>
    </TouchableOpacity>
  );
};

export default WideButton;
