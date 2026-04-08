import React from "react";
import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import LeaderboardModal, { LeaderboardEntry } from "../LeaderboardModal";

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("../../../../styles", () => ({
  TYPOGRAPHY: {
    fontPrimary: "System",
    fontSecondary: "System",
    fontSecondaryBold: "System-Bold",
    fontSize: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      "2xl": 24,
      "3xl": 30,
      "4xl": 36,
    },
    lineHeight: { tight: 1.25, snug: 1.375, normal: 1.5, relaxed: 1.625, loose: 2 },
    letterSpacing: { tight: -0.1, normal: 0, wide: 0.025, caps: 1 },
  },
  COLORS: {
    white: "#FFFFFF",
    error: "#EF4444",
    success: "#10B981",
    gray600: "#4B5563",
  },
  SPACING: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
}));

jest.mock("../../../../assets/images/modal-bg.svg", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockModalBg = (props: any) =>
    React.createElement(View, { testID: "modal-bg", ...props });
  MockModalBg.displayName = "MockModalBg";
  return MockModalBg;
});

jest.mock("../../../buttons/CloseButton", () => {
  return function MockCloseButton({ onPress, accessibilityLabel }: any) {
    const React = require("react");
    const { TouchableOpacity, Text } = require("react-native");
    return React.createElement(
      TouchableOpacity,
      { onPress, testID: "close-button", accessibilityLabel },
      React.createElement(Text, {}, "×")
    );
  };
});

const mockHttpsCallable = jest.fn();

jest.mock("@react-native-firebase/functions", () => ({
  getFunctions: jest.fn(() => ({})),
  httpsCallable: jest.fn(() => mockHttpsCallable),
}));

jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn(),
}));

jest.mock("../../../../utils/logger", () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock("../../../../constants/layout", () => ({
  MODAL_WIDTH: 300,
  MODAL_HEIGHT: 378,
  CLOSE_BUTTON_INSET: 20,
  CLOSE_BUTTON_SIZE: 20,
  CARD_BORDER_RADIUS: 12,
  MODAL_CONTENT_PADDING: 20,
  AVATAR_SIZE_MEDIUM: 64,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    userId: "user-1",
    username: "Alice",
    totalScore: 500,
    totalWins: 10,
    bestStreak: 5,
    updatedAt: 1_700_000_000,
    ...overrides,
  };
}

const defaultProps = {
  isVisible: true,
  onClose: jest.fn(),
  currentUserId: "user-1",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("LeaderboardModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows a loading indicator while fetching", async () => {
    // Never resolves during this test
    mockHttpsCallable.mockReturnValue(new Promise(() => {}));

    const { getByLabelText } = render(<LeaderboardModal {...defaultProps} />);

    expect(getByLabelText("Loading leaderboard")).toBeTruthy();
  });

  it("renders the Leaderboard title and close button", async () => {
    mockHttpsCallable.mockResolvedValueOnce({ data: { entries: [] } });

    const { getByText, getByTestId } = render(<LeaderboardModal {...defaultProps} />);

    expect(getByText("Leaderboard")).toBeTruthy();
    expect(getByTestId("close-button")).toBeTruthy();
  });

  it("calls onClose when close button is pressed", async () => {
    mockHttpsCallable.mockResolvedValueOnce({ data: { entries: [] } });
    const onClose = jest.fn();

    const { getByTestId } = render(<LeaderboardModal {...defaultProps} onClose={onClose} />);

    await waitFor(() => {});
    fireEvent.press(getByTestId("close-button"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders three tab buttons", async () => {
    mockHttpsCallable.mockResolvedValue({ data: { entries: [] } });

    const { getByLabelText } = render(<LeaderboardModal {...defaultProps} />);

    expect(getByLabelText("Score")).toBeTruthy();
    expect(getByLabelText("Wins")).toBeTruthy();
    expect(getByLabelText("Streak")).toBeTruthy();
  });

  it("displays entries after successful fetch", async () => {
    const entries = [
      makeEntry({ userId: "user-1", username: "Alice", totalScore: 500 }),
      makeEntry({ userId: "user-2", username: "Bob", totalScore: 300 }),
    ];
    mockHttpsCallable.mockResolvedValueOnce({ data: { entries } });

    const { getByText } = render(<LeaderboardModal {...defaultProps} />);

    await waitFor(() => {
      expect(getByText("Alice (you)")).toBeTruthy();
      expect(getByText("Bob")).toBeTruthy();
    });
  });

  it("shows empty state message when no entries", async () => {
    mockHttpsCallable.mockResolvedValueOnce({ data: { entries: [] } });

    const { getByText } = render(<LeaderboardModal {...defaultProps} />);

    await waitFor(() => {
      expect(getByText(/No scores yet/)).toBeTruthy();
    });
  });

  it("shows an error message on fetch failure", async () => {
    mockHttpsCallable.mockRejectedValueOnce(new Error("Network error"));

    const { getByText } = render(<LeaderboardModal {...defaultProps} />);

    await waitFor(() => {
      expect(getByText(/Could not load leaderboard/)).toBeTruthy();
    });
  });

  it("shows a Retry button on error", async () => {
    mockHttpsCallable.mockRejectedValueOnce(new Error("fail"));

    const { getByLabelText } = render(<LeaderboardModal {...defaultProps} />);

    await waitFor(() => {
      expect(getByLabelText("Retry loading leaderboard")).toBeTruthy();
    });
  });

  it("retries fetch when Retry button is pressed", async () => {
    mockHttpsCallable
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce({ data: { entries: [] } });

    const { getByLabelText } = render(<LeaderboardModal {...defaultProps} />);

    await waitFor(() => getByLabelText("Retry loading leaderboard"));

    await act(async () => {
      fireEvent.press(getByLabelText("Retry loading leaderboard"));
    });

    expect(mockHttpsCallable).toHaveBeenCalledTimes(2);
  });

  it("fetches new data when switching tabs", async () => {
    mockHttpsCallable.mockResolvedValue({ data: { entries: [] } });

    const { getByLabelText } = render(<LeaderboardModal {...defaultProps} />);

    await waitFor(() => {});

    await act(async () => {
      fireEvent.press(getByLabelText("Wins"));
    });

    // Should have called the function twice (initial + tab switch)
    expect(mockHttpsCallable).toHaveBeenCalledTimes(2);
  });

  it("does not fetch when modal is not visible", () => {
    render(<LeaderboardModal {...defaultProps} isVisible={false} />);
    expect(mockHttpsCallable).not.toHaveBeenCalled();
  });

  it("labels the current user's row with '(you)'", async () => {
    const entries = [makeEntry({ userId: "user-1", username: "Alice" })];
    mockHttpsCallable.mockResolvedValueOnce({ data: { entries } });

    const { getByText } = render(
      <LeaderboardModal {...defaultProps} currentUserId="user-1" />
    );

    await waitFor(() => {
      expect(getByText("Alice (you)")).toBeTruthy();
    });
  });

  it("does not append '(you)' for other users' rows", async () => {
    const entries = [makeEntry({ userId: "user-2", username: "Bob" })];
    mockHttpsCallable.mockResolvedValueOnce({ data: { entries } });

    const { getByText, queryByText } = render(
      <LeaderboardModal {...defaultProps} currentUserId="user-1" />
    );

    await waitFor(() => {
      expect(getByText("Bob")).toBeTruthy();
      expect(queryByText("Bob (you)")).toBeNull();
    });
  });

  it("displays stat values as localized numbers", async () => {
    const entries = [makeEntry({ totalScore: 1000 })];
    mockHttpsCallable.mockResolvedValueOnce({ data: { entries } });

    const { getByText } = render(<LeaderboardModal {...defaultProps} />);

    await waitFor(() => {
      // toLocaleString on 1000 → "1,000" on most locales, but just check it renders
      expect(getByText(/1[,.]?000|1000/)).toBeTruthy();
    });
  });
});
