import React, { useState } from "react";
import { View, TouchableOpacity, Text, Alert } from "react-native";
import { createMissingRiddles } from "../../utils/createMissingRiddles";
import { styles } from "../../styles/styles";

const COLORS = {
  lightGray: "#f0f0f0",
  white: "#FFFFFF",
  darkGray: "#888", // For disabled button
  blue: "#007AFF", // For enabled button
};

export const RiddleRegenerationButton: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleRegenerateRiddles = async () => {
    setIsLoading(true);
    try {
      await createMissingRiddles();
      Alert.alert(
        "Success",
        "Missing riddles have been created successfully!",
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("Error regenerating riddles:", error);
      Alert.alert(
        "Error",
        "Failed to create missing riddles. Check console for details.",
        [{ text: "OK" }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.riddleRegenerationContainer}>
      <Text style={styles.riddleRegenerationTitle}>
        Debug: Riddle Regeneration
      </Text>
      <TouchableOpacity
        style={[
          styles.riddleRegenerationButton,
          { backgroundColor: isLoading ? COLORS.darkGray : COLORS.blue },
        ]}
        onPress={handleRegenerateRiddles}
        disabled={isLoading}
      >
        <Text style={styles.riddleRegenerationButtonText}>
          {isLoading ? "Creating Riddles..." : "Create Missing Riddles"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
