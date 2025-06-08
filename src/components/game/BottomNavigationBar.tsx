import React from "react";
import { View, TouchableOpacity, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ProfileIcon from "../icons/ProfileIcon";
import SettingsIcon from "../icons/SettingsIcon";
import { AppStrings } from "../../constants/AppStrings";

export type OverlayType = "profile" | "settings";

/**
 * Props for the BottomNavigationBar component.
 * @property {() => void} onProfilePress - Function to call when the Profile icon is pressed.
 * @property {() => void} onSettingsPress - Function to call when the Settings icon is pressed.
 * @property {() => void} onSubmitPress - Function to call when the Submit button is pressed.
 * @property {string[]} currentGuess - Current guess array to determine submit button state.
 * @property {number} answerLength - Expected answer length to validate submit button.
 * @property {boolean} gameOver - Whether the game is over to disable submit button.
 */
interface BottomNavigationBarProps {
  onProfilePress: () => void;
  onSettingsPress: () => void;
  onSubmitPress: () => void;
  currentGuess: string[];
  answerLength: number;
  gameOver: boolean;
}

/**
 * A navigation bar component displayed at the bottom of the screen.
 * It provides navigation links to profile and settings sections, plus a submit button for gameplay.
 * @param {BottomNavigationBarProps} props - The props for the component.
 * @returns {React.FC<BottomNavigationBarProps>} The rendered BottomNavigationBar component.
 */
const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({
  onProfilePress,
  onSettingsPress,
  onSubmitPress,
  currentGuess,
  answerLength,
  gameOver,
}) => {
  const isSubmitDisabled = currentGuess.length !== answerLength;
  const insets = useSafeAreaInsets();

  return (
    <View
      className="px-4 pt-6 pb-2"
      style={{ paddingBottom: insets.bottom + 8 }}
      testID="bottom-navigation-bar"
    >
      <View className="flex-row justify-between items-center">
        <TouchableOpacity
          onPress={() => onProfilePress && onProfilePress()}
          className="items-center py-2 px-6"
          testID="profile-button"
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
        >
          <ProfileIcon
            width={24}
            height={24}
            color="#FFFFFF"
            testID="profile-icon"
          />
          <Text className="text-xs mt-1 text-white">
            {AppStrings.Navigation.PROFILE_BUTTON}
          </Text>
        </TouchableOpacity>

        {/* Submit Button */}
        <TouchableOpacity
          className={`px-8 py-4 rounded-lg ${
            isSubmitDisabled || gameOver ? "bg-gray-400" : "bg-blue-500"
          }`}
          onPress={() => {
            if (!isSubmitDisabled && !gameOver && onSubmitPress) {
              onSubmitPress();
            }
          }}
          disabled={isSubmitDisabled || gameOver}
          testID="submit-button"
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Submit current guess"
        >
          <Text className="text-white font-bold text-base">Submit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onSettingsPress && onSettingsPress()}
          className="items-center py-2 px-6"
          testID="settings-button"
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          <SettingsIcon
            width={24}
            height={24}
            color="#FFFFFF"
            testID="settings-icon"
          />
          <Text className="text-xs mt-1 text-white">
            {AppStrings.Navigation.SETTINGS_BUTTON}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default BottomNavigationBar;
