/**
 * Tests for useNotificationNavigation hook and resolveNotificationDestination helper.
 */
import { renderHook, act } from "@testing-library/react-native";
import {
  resolveNotificationDestination,
  useNotificationNavigation,
} from "../useNotificationNavigation";
import { NotificationService } from "../../services/NotificationService";

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("../../services/NotificationService", () => ({
  NotificationService: {
    getInitialNotification: jest.fn(),
    onNotificationOpenedApp: jest.fn(),
  },
}));

jest.mock("../../utils/logger", () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockGetInitialNotification =
  NotificationService.getInitialNotification as jest.MockedFunction<
    typeof NotificationService.getInitialNotification
  >;
const mockOnNotificationOpenedApp =
  NotificationService.onNotificationOpenedApp as jest.MockedFunction<
    typeof NotificationService.onNotificationOpenedApp
  >;

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeMessage(data: Record<string, string> = {}) {
  return { data } as any;
}

// ── resolveNotificationDestination ───────────────────────────────────────────

describe("resolveNotificationDestination", () => {
  it("maps streak_reminder → daily", () => {
    const result = resolveNotificationDestination(
      makeMessage({ type: "streak_reminder", date: "2026-03-24" }),
    );
    expect(result.destination).toBe("daily");
    expect(result.rawData.type).toBe("streak_reminder");
  });

  it("maps daily_challenge → daily", () => {
    const result = resolveNotificationDestination(
      makeMessage({ type: "daily_challenge" }),
    );
    expect(result.destination).toBe("daily");
  });

  it("maps unknown type → unknown", () => {
    const result = resolveNotificationDestination(makeMessage({ type: "promo" }));
    expect(result.destination).toBe("unknown");
  });

  it("maps missing type → unknown", () => {
    const result = resolveNotificationDestination(makeMessage({}));
    expect(result.destination).toBe("unknown");
  });

  it("maps empty data → unknown", () => {
    const result = resolveNotificationDestination({ data: undefined } as any);
    expect(result.destination).toBe("unknown");
  });

  it("includes rawData in the payload", () => {
    const result = resolveNotificationDestination(
      makeMessage({ type: "streak_reminder", date: "2026-01-01" }),
    );
    expect(result.rawData).toEqual({ type: "streak_reminder", date: "2026-01-01" });
  });
});

// ── useNotificationNavigation ─────────────────────────────────────────────────

describe("useNotificationNavigation", () => {
  const mockUnsubscribe = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetInitialNotification.mockResolvedValue(null);
    mockOnNotificationOpenedApp.mockReturnValue(mockUnsubscribe);
  });

  it("calls getInitialNotification on mount when enabled", async () => {
    const onNavigate = jest.fn();
    renderHook(() => useNotificationNavigation({ onNavigate, enabled: true }));

    await act(async () => {});

    expect(mockGetInitialNotification).toHaveBeenCalledTimes(1);
  });

  it("calls onNotificationOpenedApp on mount when enabled", () => {
    const onNavigate = jest.fn();
    renderHook(() => useNotificationNavigation({ onNavigate, enabled: true }));

    expect(mockOnNotificationOpenedApp).toHaveBeenCalledTimes(1);
  });

  it("does NOT subscribe when enabled=false", () => {
    const onNavigate = jest.fn();
    renderHook(() => useNotificationNavigation({ onNavigate, enabled: false }));

    expect(mockGetInitialNotification).not.toHaveBeenCalled();
    expect(mockOnNotificationOpenedApp).not.toHaveBeenCalled();
  });

  it("does NOT subscribe when enabled is not provided (defaults true)", async () => {
    const onNavigate = jest.fn();
    renderHook(() => useNotificationNavigation({ onNavigate }));

    await act(async () => {});

    expect(mockGetInitialNotification).toHaveBeenCalledTimes(1);
  });

  it("calls onNavigate for initial notification with destination=daily", async () => {
    const onNavigate = jest.fn();
    mockGetInitialNotification.mockResolvedValue(
      makeMessage({ type: "streak_reminder" }),
    );

    renderHook(() => useNotificationNavigation({ onNavigate, enabled: true }));

    await act(async () => {});

    expect(onNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ destination: "daily" }),
    );
  });

  it("does NOT call onNavigate for initial notification with destination=unknown", async () => {
    const onNavigate = jest.fn();
    mockGetInitialNotification.mockResolvedValue(makeMessage({ type: "promo" }));

    renderHook(() => useNotificationNavigation({ onNavigate, enabled: true }));

    await act(async () => {});

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("does NOT call onNavigate when initial notification is null", async () => {
    const onNavigate = jest.fn();
    mockGetInitialNotification.mockResolvedValue(null);

    renderHook(() => useNotificationNavigation({ onNavigate, enabled: true }));

    await act(async () => {});

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("calls onNavigate when background notification opens the app", () => {
    const onNavigate = jest.fn();
    let capturedHandler: ((msg: any) => void) | null = null;
    mockOnNotificationOpenedApp.mockImplementation((handler) => {
      capturedHandler = handler;
      return mockUnsubscribe;
    });

    renderHook(() => useNotificationNavigation({ onNavigate, enabled: true }));

    act(() => {
      capturedHandler!(makeMessage({ type: "streak_reminder" }));
    });

    expect(onNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ destination: "daily" }),
    );
  });

  it("does NOT call onNavigate for unknown background notification type", () => {
    const onNavigate = jest.fn();
    let capturedHandler: ((msg: any) => void) | null = null;
    mockOnNotificationOpenedApp.mockImplementation((handler) => {
      capturedHandler = handler;
      return mockUnsubscribe;
    });

    renderHook(() => useNotificationNavigation({ onNavigate, enabled: true }));

    act(() => {
      capturedHandler!(makeMessage({ type: "marketing" }));
    });

    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("unsubscribes the background listener on unmount", () => {
    const onNavigate = jest.fn();
    const { unmount } = renderHook(() =>
      useNotificationNavigation({ onNavigate, enabled: true }),
    );

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it("handles getInitialNotification errors gracefully", async () => {
    const onNavigate = jest.fn();
    mockGetInitialNotification.mockRejectedValue(new Error("FCM error"));

    expect(() =>
      renderHook(() => useNotificationNavigation({ onNavigate, enabled: true })),
    ).not.toThrow();

    await act(async () => {});

    expect(onNavigate).not.toHaveBeenCalled();
  });
});
