import React, { useState } from "react";
import { View, TouchableOpacity, Text, Alert, StyleSheet } from "react-native";
import { createMissingRiddles } from "../../utils/createMissingRiddles";

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
    <View style={styles.container}>
      <Text style={styles.title}>Debug: Riddle Regeneration</Text>
      <TouchableOpacity
        style={[
          styles.button,
          { backgroundColor: isLoading ? COLORS.darkGray : COLORS.blue },
        ]}
        onPress={handleRegenerateRiddles}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? "Creating Riddles..." : "Create Missing Riddles"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 8,
    padding: 15,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "bold",
  },
  container: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
    margin: 10,
    padding: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
  },
});
