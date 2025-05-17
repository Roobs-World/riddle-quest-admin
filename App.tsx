import "./global.css";
import { Navigation } from "./src/components/NavigationStack";
import React, { useState, useEffect } from "react";
import DottedSpinner from "./src/components/DottedSpinner";
import { View } from "react-native";
import { loadFonts } from "./src/utils/fontLoader";

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function loadResources() {
      try {
        await loadFonts();
        setFontsLoaded(true);
      } catch (e: any) {
        console.error("App load error:", e);
      }
    }

    loadResources();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {!fontsLoaded ? (
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <DottedSpinner
            size={250}
            dotCount={8}
            dotRadius={20}
            duration={1200}
            color="#fcc070"
          />
        </View>
      ) : (
        <Navigation />
      )}
    </View>
  );
}
