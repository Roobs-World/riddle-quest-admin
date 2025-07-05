import React from "react";
import { View, TouchableOpacity, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ProfileIcon from "../icons/ProfileIcon";
import SettingsIcon from "../icons/SettingsIcon";

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
      className="absolute bottom-0 left-0 right-0 px-4 pt-6 pb-2 bg-cream-light"
      style={{ paddingBottom: insets.bottom + 8 }}
      testID="bottom-navigation-bar"
    >
      <View className="flex-row justify-between items-center ">
        <TouchableOpacity
          onPress={() => onProfilePress && onProfilePress()}
          className="items-center py-2"
          testID="profile-button"
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
        >
          <ProfileIcon color="#999999" testID="profile-icon" />
        </TouchableOpacity>

        {/* Submit Button */}
        <TouchableOpacity
          className={`px-14 py-4 mt-8 rounded-full ${
            isSubmitDisabled || gameOver ? "bg-secondary-orange" : "bg-blue-500"
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
          <Text className="text-black font-bold text-lg">Submit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onSettingsPress && onSettingsPress()}
          className="items-center py-2 "
          testID="settings-button"
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          <SettingsIcon color="#999999" testID="settings-icon" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default BottomNavigationBar;
