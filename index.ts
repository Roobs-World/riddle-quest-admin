/**
 * @fileoverview Application entry point for Riddle Quest - React Native app registration.
 *
 * This file bridges the Expo runtime to either a lightweight QA surface or the
 * full app shell. QA loading surfaces can render without importing the full app
 * tree, which keeps emulator startup focused on the screen under test.
 */
import React, {useEffect, useState} from "react";
import {Linking, StyleSheet, Text, View} from "react-native";
import {registerRootComponent} from "expo";

import {extractQASurfaceIdFromUrl, type QASurfaceId} from "./src/qa/qaSurfaces";

const LIGHTWEIGHT_LOADING_SURFACES = new Set<QASurfaceId>(["page-app-loading", "page-riddle-loading"]);

const qaStyles = StyleSheet.create({
  centered: {
    alignItems: "center",
    backgroundColor: "#080A1A",
    flex: 1,
    justifyContent: "center",
  },
  loadingLabel: {
    color: "#FFFFFF",
    fontSize: 20,
    marginTop: 24,
  },
  surfaceMarker: {
    color: "transparent",
    fontSize: 1,
    height: 1,
    left: 0,
    opacity: 0.01,
    position: "absolute",
    top: 0,
    width: 1,
  },
});

const LoadingSurface = ({surfaceId}: {surfaceId: QASurfaceId}) =>
  React.createElement(
    View,
    {collapsable: false, style: qaStyles.centered, testID: `qa-surface-${surfaceId}`},
    React.createElement(
      Text,
      {accessibilityLabel: `qa-surface:${surfaceId}`, style: qaStyles.surfaceMarker},
      `qa-surface:${surfaceId}`,
    ),
    React.createElement(Text, {accessibilityLabel: "Loading", style: qaStyles.loadingLabel}, "Loading"),
  );

const AppBootstrap = (): React.JSX.Element => {
  const [mode, setMode] = useState<"loading" | "app" | "qa" | "qa-light">("loading");
  const [surfaceId, setSurfaceId] = useState<QASurfaceId | null>(null);
  const [AppComponent, setAppComponent] = useState<React.ComponentType | null>(null);
  const [QASurfaceComponent, setQASurfaceComponent] = useState<React.ComponentType<{surfaceId: QASurfaceId}> | null>(
    null,
  );

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const initialUrl = await Linking.getInitialURL().catch(() => null);
      const nextSurfaceId = extractQASurfaceIdFromUrl(initialUrl);

      if (nextSurfaceId) {
        if (LIGHTWEIGHT_LOADING_SURFACES.has(nextSurfaceId)) {
          if (!isMounted) return;
          setSurfaceId(nextSurfaceId);
          setMode("qa-light");
          return;
        }

        if (!isMounted) return;
        setSurfaceId(nextSurfaceId);
        setQASurfaceComponent(() => require("./src/qa/QASurfaceHarness").QASurfaceHarness);
        setMode("qa");
        return;
      }

      if (!isMounted) return;
      setAppComponent(() => require("./App").default);
      setMode("app");
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  if (mode === "qa-light" && surfaceId) {
    return React.createElement(LoadingSurface, {surfaceId});
  }

  if (mode === "qa" && surfaceId && QASurfaceComponent) {
    return React.createElement(QASurfaceComponent, {surfaceId});
  }

  if (mode === "app" && AppComponent) {
    return React.createElement(AppComponent);
  }

  return React.createElement(LoadingSurface, {surfaceId: "page-app-loading"});
};

registerRootComponent(AppBootstrap);
