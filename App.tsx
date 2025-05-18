import "./global.css";
import React, { useState, useEffect } from "react";
import { View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import GameScreen from "./src/screens/game/GameScreen";
import { loadFonts } from "./src/utils/fontLoader";
import DottedSpinner from "./src/components/DottedSpinner";
import { Navigation } from "./src/components/NavigationStack";
import { SoundManager } from "./src/services/SoundManager";
import { loadUserProgressFromFirestore } from "./src/services/FirestoreService";
import { Player } from "./src/types/Player";

// Placeholder for authentication state
// In a real app, this would come from your auth service (e.g., Firebase)
const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Simulate checking auth status (replace with actual auth logic)
  useEffect(() => {
    // Check for a user token, etc.
    // For now, let's just default to false
    setIsAuthenticated(false);
  }, []);

  return { isAuthenticated, setIsAuthenticated };
};

export default function App() {
  const { isAuthenticated } = useAuth();
  const [resourcesLoaded, setResourcesLoaded] = useState(false);

  useEffect(() => {
    async function loadResources() {
      try {
        const userId = isAuthenticated ? "placeholder_user_id" : null;

        const resourcePromises: (Promise<void> | Promise<Player | null>)[] = [
          loadFonts(),
        ];
        if (userId) {
          resourcePromises.push(loadUserProgressFromFirestore(userId));
        }

        await Promise.all(resourcePromises);
        setResourcesLoaded(true);
      } catch (e: any) {
        console.error("App load error:", e);
      }
    }

    loadResources();
  }, [isAuthenticated]);

  useEffect(() => {
    SoundManager.init();

    return () => {
      SoundManager.unload();
    };
  }, []);

  if (!resourcesLoaded) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#FAF3E0",
        }}
      >
        <DottedSpinner size={150} color="#FDBA74" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <GameScreen /> : <Navigation />}
    </NavigationContainer>
  );
}
