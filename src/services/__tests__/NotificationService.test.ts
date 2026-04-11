/**
 * @fileoverview Unit tests for NotificationService.
 *
 * Tests notification permission handling, FCM token management,
 * and notification subscription methods.
 */

import { Platform } from "react-native";
import { NotificationService } from "../NotificationService";

// Mock Firebase modules
jest.mock("@react-native-firebase/messaging", () => ({
  getMessaging: jest.fn(() => ({})),
  getToken: jest.fn(() => Promise.resolve("mock-fcm-token")),
  hasPermission: jest.fn(() => Promise.resolve(1)), // AUTHORIZED
  requestPermission: jest.fn(() => Promise.resolve(1)), // AUTHORIZED
  getInitialNotification: jest.fn(() => Promise.resolve(null)),
  onNotificationOpenedApp: jest.fn(() => jest.fn()),
  onMessage: jest.fn(() => jest.fn()),
  onTokenRefresh: jest.fn(() => jest.fn()),
  deleteToken: jest.fn(() => Promise.resolve()),
  AuthorizationStatus: {
    NOT_DETERMINED: -1,
    DENIED: 0,
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  },
}));

jest.mock("@react-native-firebase/firestore", () => ({
  getFirestore: jest.fn(() => ({})),
  doc: jest.fn(() => ({})),
  updateDoc: jest.fn(() => Promise.resolve()),
}));

jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn(() => ({})),
}));

jest.mock("@react-native-firebase/functions", () => ({
  getFunctions: jest.fn(() => ({})),
  httpsCallable: jest.fn(() => jest.fn(() => Promise.resolve({ data: {} }))),
}));

// Import mocked modules for assertions
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
} from "@react-native-firebase/messaging";
import { updateDoc } from "@react-native-firebase/firestore";
import { httpsCallable } from "@react-native-firebase/functions";

describe("NotificationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Platform.OS for each test
    (Platform as any).OS = "ios";
  });

  describe("requestPermission", () => {
    it("should request permission on iOS and return true when granted", async () => {
      (requestPermission as jest.Mock).mockResolvedValueOnce(
        AuthorizationStatus.AUTHORIZED
      );

      const result = await NotificationService.requestPermission();

      expect(requestPermission).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should return true for provisional permission on iOS", async () => {
      (requestPermission as jest.Mock).mockResolvedValueOnce(
        AuthorizationStatus.PROVISIONAL
      );

      const result = await NotificationService.requestPermission();

      expect(result).toBe(true);
    });

    it("should return false when permission is denied on iOS", async () => {
      (requestPermission as jest.Mock).mockResolvedValueOnce(
        AuthorizationStatus.DENIED
      );

      const result = await NotificationService.requestPermission();

      expect(result).toBe(false);
    });

    it("should return true on Android without requesting", async () => {
      (Platform as any).OS = "android";

      const result = await NotificationService.requestPermission();

      expect(requestPermission).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe("isPermissionGranted", () => {
    it("should return true when authorized", async () => {
      (hasPermission as jest.Mock).mockResolvedValueOnce(
        AuthorizationStatus.AUTHORIZED
      );

      const result = await NotificationService.isPermissionGranted();

      expect(hasPermission).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should return true for provisional authorization", async () => {
      (hasPermission as jest.Mock).mockResolvedValueOnce(
        AuthorizationStatus.PROVISIONAL
      );

      const result = await NotificationService.isPermissionGranted();

      expect(result).toBe(true);
    });

    it("should return false when denied", async () => {
      (hasPermission as jest.Mock).mockResolvedValueOnce(
        AuthorizationStatus.DENIED
      );

      const result = await NotificationService.isPermissionGranted();

      expect(result).toBe(false);
    });

    it("should return false when not determined", async () => {
      (hasPermission as jest.Mock).mockResolvedValueOnce(
        AuthorizationStatus.NOT_DETERMINED
      );

      const result = await NotificationService.isPermissionGranted();

      expect(result).toBe(false);
    });
  });

  describe("getFcmToken", () => {
    it("should return FCM token when permission is granted", async () => {
      (hasPermission as jest.Mock).mockResolvedValueOnce(
        AuthorizationStatus.AUTHORIZED
      );
      (getToken as jest.Mock).mockResolvedValueOnce("test-fcm-token");

      const result = await NotificationService.getFcmToken();

      expect(getToken).toHaveBeenCalled();
      expect(result).toBe("test-fcm-token");
    });

    it("should return null when permission is not granted", async () => {
      (hasPermission as jest.Mock).mockResolvedValueOnce(
        AuthorizationStatus.DENIED
      );

      const result = await NotificationService.getFcmToken();

      expect(getToken).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("should return null and handle errors gracefully", async () => {
      (hasPermission as jest.Mock).mockResolvedValueOnce(
        AuthorizationStatus.AUTHORIZED
      );
      (getToken as jest.Mock).mockRejectedValueOnce(new Error("Token error"));

      const result = await NotificationService.getFcmToken();

      expect(result).toBeNull();
    });
  });

  describe("registerToken", () => {
    it("should register token via cloud function", async () => {
      (hasPermission as jest.Mock).mockResolvedValueOnce(
        AuthorizationStatus.AUTHORIZED
      );
      (getToken as jest.Mock).mockResolvedValueOnce("test-token");

      await NotificationService.registerToken("user-123");

      expect(httpsCallable).toHaveBeenCalledWith(
        expect.anything(),
        "registerFcmToken"
      );
    });

    it("should not register when no token is available", async () => {
      (hasPermission as jest.Mock).mockResolvedValueOnce(
        AuthorizationStatus.DENIED
      );

      await NotificationService.registerToken("user-123");

      expect(httpsCallable).not.toHaveBeenCalled();
    });

    it("should fallback to Firestore when cloud function fails", async () => {
      (hasPermission as jest.Mock).mockResolvedValueOnce(
        AuthorizationStatus.AUTHORIZED
      );
      (getToken as jest.Mock).mockResolvedValueOnce("test-token");

      const mockCallable = jest.fn().mockRejectedValueOnce(new Error("Function error"));
      (httpsCallable as jest.Mock).mockReturnValueOnce(mockCallable);

      await NotificationService.registerToken("user-123");

      expect(updateDoc).toHaveBeenCalled();
    });

    it("should handle error when both cloud function and Firestore fail", async () => {
      (hasPermission as jest.Mock).mockResolvedValueOnce(
        AuthorizationStatus.AUTHORIZED
      );
      (getToken as jest.Mock).mockResolvedValueOnce("test-token");

      const mockCallable = jest.fn().mockRejectedValueOnce(new Error("Function error"));
      (httpsCallable as jest.Mock).mockReturnValueOnce(mockCallable);
      (updateDoc as jest.Mock).mockRejectedValueOnce(new Error("Firestore error"));

      // Should not throw
      await expect(
        NotificationService.registerToken("user-123")
      ).resolves.not.toThrow();
    });
  });

  describe("onTokenRefresh", () => {
    it("should return an unsubscribe function", () => {
      const unsubscribe = NotificationService.onTokenRefresh("user-123");

      expect(typeof unsubscribe).toBe("function");
      expect(onTokenRefresh).toHaveBeenCalled();
    });

    it("should pass messaging instance to onTokenRefresh", () => {
      NotificationService.onTokenRefresh("user-123");

      expect(onTokenRefresh).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(Function)
      );
    });

    it("should register refreshed token via cloud function", async () => {
      let capturedCallback: ((token: string) => Promise<void>) | null = null;
      (onTokenRefresh as jest.Mock).mockImplementationOnce((_messaging, callback) => {
        capturedCallback = callback;
        return jest.fn();
      });

      NotificationService.onTokenRefresh("user-123");

      expect(capturedCallback).not.toBeNull();

      // Call the captured callback
      await capturedCallback!("new-refreshed-token");

      expect(httpsCallable).toHaveBeenCalledWith(
        expect.anything(),
        "registerFcmToken"
      );
    });

    it("should fallback to Firestore when cloud function fails on refresh", async () => {
      let capturedCallback: ((token: string) => Promise<void>) | null = null;
      (onTokenRefresh as jest.Mock).mockImplementationOnce((_messaging, callback) => {
        capturedCallback = callback;
        return jest.fn();
      });

      const mockCallable = jest.fn().mockRejectedValueOnce(new Error("Function error"));
      (httpsCallable as jest.Mock).mockReturnValueOnce(mockCallable);

      NotificationService.onTokenRefresh("user-123");

      await capturedCallback!("new-refreshed-token");

      expect(updateDoc).toHaveBeenCalled();
    });

    it("should handle error when both cloud function and Firestore fail on refresh", async () => {
      let capturedCallback: ((token: string) => Promise<void>) | null = null;
      (onTokenRefresh as jest.Mock).mockImplementationOnce((_messaging, callback) => {
        capturedCallback = callback;
        return jest.fn();
      });

      const mockCallable = jest.fn().mockRejectedValueOnce(new Error("Function error"));
      (httpsCallable as jest.Mock).mockReturnValueOnce(mockCallable);
      (updateDoc as jest.Mock).mockRejectedValueOnce(new Error("Firestore error"));

      NotificationService.onTokenRefresh("user-123");

      // Should not throw
      await expect(capturedCallback!("new-refreshed-token")).resolves.not.toThrow();
    });
  });

  describe("onForegroundMessage", () => {
    it("should return an unsubscribe function", () => {
      const handler = jest.fn();
      const unsubscribe = NotificationService.onForegroundMessage(handler);

      expect(typeof unsubscribe).toBe("function");
      expect(onMessage).toHaveBeenCalled();
    });

    it("should pass handler to onMessage", () => {
      const handler = jest.fn();
      NotificationService.onForegroundMessage(handler);

      expect(onMessage).toHaveBeenCalledWith(expect.anything(), handler);
    });
  });

  describe("getInitialNotification", () => {
    it("should return notification when app was opened from notification", async () => {
      const mockNotification = {
        notification: { title: "Test", body: "Body" },
        data: { screen: "game" },
      };
      (getInitialNotification as jest.Mock).mockResolvedValueOnce(
        mockNotification
      );

      const result = await NotificationService.getInitialNotification();

      expect(result).toEqual(mockNotification);
    });

    it("should return null when no initial notification", async () => {
      (getInitialNotification as jest.Mock).mockResolvedValueOnce(null);

      const result = await NotificationService.getInitialNotification();

      expect(result).toBeNull();
    });

    it("should return null and handle errors gracefully", async () => {
      (getInitialNotification as jest.Mock).mockRejectedValueOnce(
        new Error("Error")
      );

      const result = await NotificationService.getInitialNotification();

      expect(result).toBeNull();
    });
  });

  describe("onNotificationOpenedApp", () => {
    it("should return an unsubscribe function", () => {
      const handler = jest.fn();
      const unsubscribe = NotificationService.onNotificationOpenedApp(handler);

      expect(typeof unsubscribe).toBe("function");
      expect(onNotificationOpenedApp).toHaveBeenCalled();
    });

    it("should pass handler to onNotificationOpenedApp", () => {
      const handler = jest.fn();
      NotificationService.onNotificationOpenedApp(handler);

      expect(onNotificationOpenedApp).toHaveBeenCalledWith(
        expect.anything(),
        handler
      );
    });
  });

  describe("unregisterToken", () => {
    it("should clear FCM token from Firestore", async () => {
      await NotificationService.unregisterToken("user-123");

      expect(updateDoc).toHaveBeenCalled();
    });

    it("should delete FCM token", async () => {
      await NotificationService.unregisterToken("user-123");

      expect(deleteToken).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      (updateDoc as jest.Mock).mockRejectedValueOnce(new Error("Update error"));

      // Should not throw
      await expect(
        NotificationService.unregisterToken("user-123")
      ).resolves.not.toThrow();
    });
  });
});
