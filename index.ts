/**
 * @fileoverview Application entry point for Riddle Quest - React Native app registration.
 *
 * This file serves as the bridge between the Expo/React Native runtime and the
 * main App component. It handles the registration of the root component with
 * the React Native AppRegistry, ensuring the app works correctly in both
 * Expo Go and native builds.
 *
 * The registerRootComponent function automatically handles platform-specific
 * setup and environment configuration, making the app compatible with various
 * deployment targets.
 *
 * @author Riddle Quest Development Team
 * @version 1.0.0
 * @since 2024
 */

import { registerRootComponent } from "expo";

import App from "./App";
import { installGlobalErrorLogging } from "./src/debug/installGlobalErrorLogging";

installGlobalErrorLogging();

/**
 * Registers the main App component as the root component for the React Native application.
 *
 * This function:
 * - Calls AppRegistry.registerComponent('main', () => App) internally
 * - Ensures proper environment setup for both Expo Go and native builds
 * - Handles platform-specific initialization automatically
 * - Provides consistent behavior across development and production environments
 *
 * The registration is required for React Native to identify and mount the
 * root component when the app starts.
 */
registerRootComponent(App);
