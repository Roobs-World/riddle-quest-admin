import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";

// Color constants
const COLOR_LIGHT_CREAM = "#fcfaf4";
const COLOR_DARK_BACKGROUND = "#1a1a1a";
const COLOR_DARK_BORDER = "#333";

interface GameHeaderProps {
  level?: number;
  coins: number;
  showBackButton?: boolean;
  onBackPress?: () => void;
  title?: string;
}

/**
 * Game header component following Single Responsibility Principle
 * Responsible only for displaying game header information
 */
const GameHeader: React.FC<GameHeaderProps> = ({
  level,
  coins,
  showBackButton = false,
  onBackPress,
  title,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        {showBackButton && onBackPress ? (
          <Icon
            name="arrow-back"
            size={24}
            color={COLOR_LIGHT_CREAM}
            onPress={onBackPress}
          />
        ) : (
          <View style={styles.levelContainer}>
            <Text style={styles.levelText}>Level {level}</Text>
          </View>
        )}
      </View>

      <View style={styles.centerSection}>
        {title && <Text style={styles.titleText}>{title}</Text>}
      </View>

      <View style={styles.rightSection}>
        <View style={styles.coinsContainer}>
          <Icon name="logo-bitcoin" size={20} color={COLOR_LIGHT_CREAM} />
          <Text style={styles.coinsText}>{coins}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  centerSection: {
    alignItems: "center",
    flex: 2,
    justifyContent: "center",
  },
  coinsContainer: {
    alignItems: "center",
    flexDirection: "row",
  },
  coinsText: {
    color: COLOR_LIGHT_CREAM,
    fontSize: 16,
    marginLeft: 5,
  },
  container: {
    alignItems: "center",
    backgroundColor: COLOR_DARK_BACKGROUND,
    borderBottomColor: COLOR_DARK_BORDER,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  leftSection: {
    alignItems: "flex-start",
    flex: 1,
  },
  levelContainer: {
    alignItems: "center",
    flexDirection: "row",
  },
  levelText: {
    color: COLOR_LIGHT_CREAM,
    fontSize: 16,
    fontWeight: "bold",
  },
  rightSection: {
    alignItems: "flex-end",
    flex: 1,
  },
  titleText: {
    color: COLOR_LIGHT_CREAM,
    fontSize: 18,
    fontWeight: "bold",
  },
});

export default GameHeader;
