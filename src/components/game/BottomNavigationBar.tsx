import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { AppStrings } from "../../constants/AppStrings";

const ACTIVE_TEXT_COLOR = "#222"; // Define constant for active text color

export type OverlayType = "home" | "play" | "profile" | "settings";

/**
 * Props for the BottomNavigationBar component.
 * @property {() => void} onHomePress - Function to call when the Home icon is pressed.
 * @property {() => void} onPlayPress - Function to call when the Play icon is pressed.
 * @property {() => void} onProfilePress - Function to call when the Profile icon is pressed.
 * @property {() => void} onSettingsPress - Function to call when the Settings icon is pressed.
 */
interface BottomNavigationBarProps {
  onHomePress: () => void;
  onPlayPress: () => void;
  onProfilePress: () => void;
  onSettingsPress: () => void;
}

/**
 * A navigation bar component displayed at the bottom of the screen.
 * It provides navigation links to different sections of the application.
 * @param {BottomNavigationBarProps} props - The props for the component.
 * @returns {React.FC<BottomNavigationBarProps>} The rendered BottomNavigationBar component.
 */
const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({
  onHomePress,
  onPlayPress,
  onProfilePress,
  onSettingsPress,
}) => {
  return (
    <View className="bg-white border-t border-gray-200 px-4 py-2">
      <View className="flex-row justify-around items-center">
        <TouchableOpacity
          onPress={onHomePress}
          className="flex-1 items-center py-2"
        >
          <Icon name="home" size={24} style={styles.iconColor} />
          <Text className="text-xs mt-1" style={styles.iconColor}>
            Home
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onPlayPress}
          className="flex-1 items-center py-2"
        >
          <Icon name="play-arrow" size={24} style={styles.iconColor} />
          <Text className="text-xs mt-1" style={styles.iconColor}>
            {AppStrings.Navigation.PLAY_BUTTON}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onProfilePress}
          className="flex-1 items-center py-2"
        >
          <Icon name="person" size={24} style={styles.iconColor} />
          <Text className="text-xs mt-1" style={styles.iconColor}>
            {AppStrings.Navigation.PROFILE_BUTTON}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onSettingsPress}
          className="flex-1 items-center py-2"
        >
          <Icon name="settings" size={24} style={styles.iconColor} />
          <Text className="text-xs mt-1" style={styles.iconColor}>
            {AppStrings.Navigation.SETTINGS_BUTTON}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  iconColor: {
    color: ACTIVE_TEXT_COLOR,
  },
});

export default BottomNavigationBar;
