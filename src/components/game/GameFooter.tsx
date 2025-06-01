import React from "react";
import { View, StyleSheet } from "react-native";
import Keyboard from "./Keyboard";
import BottomNavigationBar from "./BottomNavigationBar";

// Color constants
const COLOR_DARK_BACKGROUND = "#1a1a1a";
const COLOR_DARK_BORDER = "#333";

interface GameFooterProps {
  onKeyPress: (key: string) => void;
  onHomePress: () => void;
  onPlayPress: () => void;
  onProfilePress: () => void;
  onSettingsPress: () => void;
}

/**
 * Game footer component following Single Responsibility Principle
 * Responsible for displaying keyboard and navigation
 */
const GameFooter: React.FC<GameFooterProps> = ({
  onKeyPress,
  onHomePress,
  onPlayPress,
  onProfilePress,
  onSettingsPress,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.keyboardContainer}>
        <Keyboard onKeyPress={onKeyPress} />
      </View>

      <View style={styles.navigationContainer}>
        <BottomNavigationBar
          onHomePress={onHomePress}
          onPlayPress={onPlayPress}
          onProfilePress={onProfilePress}
          onSettingsPress={onSettingsPress}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: COLOR_DARK_BACKGROUND,
    borderTopColor: COLOR_DARK_BORDER,
    borderTopWidth: 1,
    paddingVertical: 10,
  },
  keyboardContainer: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  navigationContainer: {
    borderTopColor: COLOR_DARK_BORDER,
    borderTopWidth: 1,
  },
});

export default GameFooter;
