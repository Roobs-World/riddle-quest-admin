/**
 * @fileoverview Application entry point for Riddle Quest - React Native app registration.
 *
 * This file bridges the Expo runtime to either a lightweight QA surface or the
 * full app shell. QA loading surfaces can render without importing the full app
 * tree, which keeps emulator startup focused on the screen under test.
 */
import React, {useEffect, useState} from "react";
import {Linking, LogBox, StyleSheet, Text, View} from "react-native";
import {registerRootComponent} from "expo";

import {extractQASurfaceIdFromUrl, type QASurfaceId} from "./src/qa/qaSurfaces";

if (__DEV__) {
  LogBox.ignoreLogs(["[Reanimated] Reduced motion setting is enabled on this device."]);
}

const LIGHTWEIGHT_LOADING_SURFACES = new Set<QASurfaceId>(["page-app-loading", "page-riddle-loading"]);
const INITIAL_URL_TIMEOUT_MS = 5000;

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

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => resolve(fallbackValue), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

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

type BootstrapResolution =
  | {
      mode: "app";
      AppComponent: React.ComponentType;
    }
  | {
      mode: "qa";
      surfaceId: QASurfaceId;
      QASurfaceComponent: React.ComponentType<{surfaceId: QASurfaceId}>;
    }
  | {
      mode: "qa-light";
      surfaceId: QASurfaceId;
    };

export const resolveBootstrapMode = async ({
  getInitialUrl = () => Linking.getInitialURL().catch(() => null),
  extractSurfaceId = extractQASurfaceIdFromUrl,
  loadApp = () => require("./App").default as React.ComponentType,
  loadQASurface = () => require("./src/qa/QASurfaceHarness").QASurfaceHarness as React.ComponentType<{surfaceId: QASurfaceId}>,
  ignoreAllLogs = (enabled: boolean) => LogBox.ignoreAllLogs(enabled),
  initialUrlTimeoutMs = INITIAL_URL_TIMEOUT_MS,
}: {
  getInitialUrl?: () => Promise<string | null>;
  extractSurfaceId?: (url: string | null) => QASurfaceId | null;
  loadApp?: () => React.ComponentType;
  loadQASurface?: () => React.ComponentType<{surfaceId: QASurfaceId}>;
  ignoreAllLogs?: (enabled: boolean) => void;
  initialUrlTimeoutMs?: number;
} = {}): Promise<BootstrapResolution> => {
  const initialUrl = await withTimeout(getInitialUrl(), initialUrlTimeoutMs, null);
  const nextSurfaceId = extractSurfaceId(initialUrl);

  if (nextSurfaceId) {
    ignoreAllLogs(true);
    if (LIGHTWEIGHT_LOADING_SURFACES.has(nextSurfaceId)) {
      return {
        mode: "qa-light",
        surfaceId: nextSurfaceId,
      };
    }

    return {
      mode: "qa",
      surfaceId: nextSurfaceId,
      QASurfaceComponent: loadQASurface(),
    };
  }

  return {
    mode: "app",
    AppComponent: loadApp(),
  };
};

const AppBootstrap = (): React.JSX.Element => {
  const [mode, setMode] = useState<"loading" | "app" | "qa" | "qa-light" | "error">("loading");
  const [surfaceId, setSurfaceId] = useState<QASurfaceId | null>(null);
  const [AppComponent, setAppComponent] = useState<React.ComponentType | null>(null);
  const [QASurfaceComponent, setQASurfaceComponent] = useState<React.ComponentType<{surfaceId: QASurfaceId}> | null>(
    null,
  );
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const resolution = await resolveBootstrapMode();
        if (!isMounted) return;

        if (resolution.mode === "qa-light") {
          setSurfaceId(resolution.surfaceId);
          setMode("qa-light");
          return;
        }

        if (resolution.mode === "qa") {
          setSurfaceId(resolution.surfaceId);
          setQASurfaceComponent(() => resolution.QASurfaceComponent);
          setMode("qa");
          return;
        }

        setAppComponent(() => resolution.AppComponent);
        setMode("app");
      } catch (error) {
        console.error("App bootstrap failed before the main app mounted.", error);
        if (!isMounted) return;
        setBootstrapError(error instanceof Error ? error.message : "Unknown startup error");
        setMode("error");
      }
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

  if (mode === "error") {
    return React.createElement(
      View,
      {collapsable: false, style: qaStyles.centered, testID: "app-bootstrap-error"},
      React.createElement(Text, {style: qaStyles.loadingLabel}, "Unable to start the app"),
      bootstrapError
        ? React.createElement(Text, {style: qaStyles.loadingLabel}, bootstrapError)
        : null,
    );
  }

  return React.createElement(LoadingSurface, {surfaceId: "page-app-loading"});
};

registerRootComponent(AppBootstrap);
