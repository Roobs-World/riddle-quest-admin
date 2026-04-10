import { Platform } from "react-native";
import {
  getMessaging,
  getToken,
  hasPermission,
  requestPermission,
  getInitialNotification,
  onNotificationOpenedApp,
  onMessage,
  onTokenRefresh,
  deleteToken,
  AuthorizationStatus,
  FirebaseMessagingTypes,
} from "@react-native-firebase/messaging";
import { getFirestore, doc, updateDoc } from "@react-native-firebase/firestore";
import { getApp } from "@react-native-firebase/app";
import { getFunctions, httpsCallable } from "@react-native-firebase/functions";
import { logger } from "../utils/logger";
import { captureException } from "../utils/sentry";

/**
 * Manages push notification permissions, FCM token registration,
 * and token refresh for the Qwordly app.
 *
 * Requires: @react-native-firebase/messaging
 * Install: npm install @react-native-firebase/messaging
 */
export const NotificationService = {
  /**
   * Requests notification permission from the user (iOS only — Android grants by default).
   * Returns true if permission is granted.
   */
  async requestPermission(): Promise<boolean> {
    if (Platform.OS === "ios") {
      const authStatus = await requestPermission(getMessaging());
      const granted =
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL;
      logger.debug(`Notification permission: ${granted ? "granted" : "denied"} (status ${authStatus})`);
      return granted;
    }
    // Android 13+ requires permission but react-native-firebase handles it via manifest
    return true;
  },

  /**
   * Checks current notification authorization status without prompting.
   */
  async isPermissionGranted(): Promise<boolean> {
    const authStatus = await hasPermission(getMessaging());
    return (
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL
    );
  },

  /**
   * Gets the current FCM token for this device.
   * Returns null if messaging is not available or permission not granted.
   */
  async getFcmToken(): Promise<string | null> {
    try {
      const granted = await this.isPermissionGranted();
      if (!granted) {
        logger.debug("Notification permission not granted — skipping FCM token fetch");
        return null;
      }
      const token = await getToken(getMessaging());
      logger.debug("FCM token retrieved");
      return token;
    } catch (err) {
      logger.error("Failed to get FCM token:", err);
      captureException(err);
      return null;
    }
  },

  /**
   * Registers the device FCM token with the backend (stores on user document in Firestore).
   * Should be called after login and on token refresh.
   */
  async registerToken(userId: string): Promise<void> {
    const token = await this.getFcmToken();
    if (!token) return;

    try {
      // Register via Cloud Function so backend can validate and store securely
      const functions = getFunctions(getApp());
      await httpsCallable(functions, "registerFcmToken")({ fcmToken: token });
      logger.debug(`FCM token registered for user ${userId}`);
    } catch (err) {
      // Fallback: write directly to Firestore
      logger.warn("registerFcmToken function failed, writing directly to Firestore:", err);
      try {
        await updateDoc(doc(getFirestore(), "users", userId), {
          fcmToken: token,
          fcmTokenUpdatedAt: Date.now(),
        });
      } catch (fsErr) {
        logger.error("Failed to store FCM token in Firestore:", fsErr);
        captureException(fsErr);
      }
    }
  },

  /**
   * Sets up a listener for FCM token refresh. Call once after login.
   * Returns an unsubscribe function — call it on logout.
   */
  onTokenRefresh(userId: string): () => void {
    return onTokenRefresh(getMessaging(), async (newToken) => {
      logger.debug("FCM token refreshed");
      try {
        await httpsCallable(getFunctions(getApp()), "registerFcmToken")({ fcmToken: newToken });
      } catch (err) {
        logger.warn("Failed to update refreshed FCM token:", err);
        try {
          await updateDoc(doc(getFirestore(), "users", userId), {
            fcmToken: newToken,
            fcmTokenUpdatedAt: Date.now(),
          });
        } catch (fsErr) {
          logger.error("Failed to store refreshed FCM token in Firestore:", fsErr);
          captureException(fsErr);
        }
      }
    });
  },

  /**
   * Sets up a listener for foreground notifications.
   * Returns an unsubscribe function.
   */
  onForegroundMessage(
    handler: (message: FirebaseMessagingTypes.RemoteMessage) => void,
  ): () => void {
    return onMessage(getMessaging(), handler);
  },

  /**
   * Gets the notification that caused the app to open from a quit state (if any).
   * Call once on app startup.
   */
  async getInitialNotification(): Promise<FirebaseMessagingTypes.RemoteMessage | null> {
    try {
      return await getInitialNotification(getMessaging());
    } catch (err) {
      logger.error("Failed to get initial notification:", err);
      captureException(err);
      return null;
    }
  },

  /**
   * Subscribes to notification taps when the app is in the background (not quit).
   * The handler is called with the tapped message.
   * Returns an unsubscribe function.
   */
  onNotificationOpenedApp(
    handler: (message: FirebaseMessagingTypes.RemoteMessage) => void,
  ): () => void {
    return onNotificationOpenedApp(getMessaging(), handler);
  },

  /**
   * Removes the stored FCM token when a user logs out so they stop receiving notifications.
   */
  async unregisterToken(userId: string): Promise<void> {
    try {
      await updateDoc(doc(getFirestore(), "users", userId), {
        fcmToken: null,
        fcmTokenUpdatedAt: Date.now(),
      });
      await deleteToken(getMessaging());
      logger.debug(`FCM token unregistered for user ${userId}`);
    } catch (err) {
      logger.error("Failed to unregister FCM token:", err);
      captureException(err);
    }
  },
};

