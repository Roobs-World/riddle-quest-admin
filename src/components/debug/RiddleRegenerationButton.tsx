import React, { useState } from "react";
import { View, TouchableOpacity, Text, Alert } from "react-native";
import { createMissingRiddles } from "../../utils/createMissingRiddles";

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
    <View
      style={{
        padding: 20,
        backgroundColor: "#f0f0f0",
        margin: 10,
        borderRadius: 8,
      }}
    >
      <Text style={{ marginBottom: 10, fontSize: 16, fontWeight: "bold" }}>
        Debug: Riddle Regeneration
      </Text>
      <TouchableOpacity
        style={{
          backgroundColor: isLoading ? "#888" : "#007AFF",
          padding: 15,
          borderRadius: 8,
          alignItems: "center",
        }}
        onPress={handleRegenerateRiddles}
        disabled={isLoading}
      >
        <Text style={{ color: "white", fontSize: 16, fontWeight: "bold" }}>
          {isLoading ? "Creating Riddles..." : "Create Missing Riddles"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
