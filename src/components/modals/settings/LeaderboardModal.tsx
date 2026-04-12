/**
 * @fileoverview Leaderboard modal — shows the top players for XP,
 * Total Wins, or Best Streak.
 *
 * Data is fetched from the `getLeaderboard` Cloud Function on mount. The
 * current user's row is highlighted. Three tabs let the user switch between
 * leaderboard types without reopening the modal.
 *
 * Entry point: FullProfileDetailsModal ("Leaderboard" button).
 */
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { getCallableFunction } from "../../../utils/firebaseFunctions";
import CloseButton from "../../buttons/CloseButton";
import { TYPOGRAPHY, COLORS, SPACING } from "../../../styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  CLOSE_BUTTON_SIZE,
  MODAL_CLOSE_BUTTON_POSITION,
  CARD_BORDER_RADIUS,
  MODAL_CONTENT_PADDING,
  AVATAR_SIZE_MEDIUM,
  MODAL_SCROLLABLE_MAX_HEIGHT,
} from "../../../constants/layout";
import { logger } from "../../../utils/logger";
import { captureException } from "../../../utils/sentry";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type LeaderboardType = "xp" | "totalWins" | "bestStreak";

export interface LeaderboardEntry {
  /** User id for this leaderboard row. */
  userId: string;
  /** Display username. */
  username: string;
  /** Optional avatar image URL. */
  avatarUrl?: string;
  /** Current XP total. */
  xp: number;
  /** Lifetime wins count. */
  totalWins: number;
  /** Highest recorded win streak. */
  bestStreak: number;
  /** Epoch millis when this row was last refreshed. */
  updatedAt: number;
}

export interface LeaderboardModalProps {
  /** Controls whether the leaderboard modal is visible. */
  isVisible: boolean;
  /** Closes the modal. */
  onClose: () => void;
  /** The current user's ID — used to highlight their row in the list. */
  currentUserId: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PURPLE = "#401F40";
const GOLD = "#FEC880";
const TAB_INACTIVE = "rgba(0,0,0,0.15)";
const HIGHLIGHT_BG = "rgba(254,200,128,0.25)";

const TABS: { type: LeaderboardType; label: string; statKey: keyof LeaderboardEntry }[] = [
  { type: "xp", label: "XP", statKey: "xp" },
  { type: "totalWins", label: "Wins", statKey: "totalWins" },
  { type: "bestStreak", label: "Streak", statKey: "bestStreak" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isVisible,
  onClose,
  currentUserId,
}) => {
  const [activeTab, setActiveTab] = useState<LeaderboardType>("xp");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async (type: LeaderboardType) => {
    setIsLoading(true);
    setError(null);
    try {
      const callable = getCallableFunction("getLeaderboard");
      const result = await callable({ type, limit: 50 });
      const data = result.data as { entries: LeaderboardEntry[] };
      setEntries(data.entries ?? []);
    } catch (err) {
      logger.error("[LeaderboardModal] Failed to fetch leaderboard:", err);
      captureException(err);
      setError("Could not load leaderboard. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isVisible) {
      void fetchLeaderboard(activeTab);
    }
  }, [isVisible, activeTab, fetchLeaderboard]);

  const activeTabConfig = TABS.find((t) => t.type === activeTab)!;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityLabel="Leaderboard"
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <View
          style={{
            width: MODAL_WIDTH,
            maxHeight: "85%",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ModalBg width={MODAL_WIDTH} height={MODAL_HEIGHT} style={{ position: "absolute" }} />
          {/* Decorative wave — clipped to card bounds */}
          <HomeBg
            width={MODAL_WIDTH * 1.1}
            height={MODAL_HEIGHT * 1.1}
            style={{ position: "absolute", top: -MODAL_HEIGHT * 0.25, left: -MODAL_WIDTH * 0.05 }}
          />
          <CloseButton
            onPress={onClose}
            size={CLOSE_BUTTON_SIZE}
            style={MODAL_CLOSE_BUTTON_POSITION}
            accessibilityLabel="Close leaderboard"
          />

          {/* Title */}
          <Text
            style={{
              fontSize: TYPOGRAPHY.fontSize["2xl"],
              fontFamily: TYPOGRAPHY.fontSecondaryBold,
              color: "black",
              marginTop: SPACING.lg,
              marginBottom: SPACING.sm,
            }}
            accessibilityRole="header"
          >
            Leaderboard
          </Text>

          {/* Tabs */}
          <View
            style={{
              flexDirection: "row",
              marginBottom: SPACING.sm,
              backgroundColor: TAB_INACTIVE,
              borderRadius: CARD_BORDER_RADIUS,
              padding: 3,
            }}
          >
            {TABS.map((tab) => {
              const isActive = tab.type === activeTab;
              return (
                <TouchableOpacity
                  key={tab.type}
                  onPress={() => setActiveTab(tab.type)}
                  style={{
                    paddingVertical: SPACING.xs,
                    paddingHorizontal: SPACING.md,
                    borderRadius: CARD_BORDER_RADIUS - 2,
                    backgroundColor: isActive ? PURPLE : "transparent",
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={tab.label}
                >
                  <Text
                    style={{
                      fontSize: TYPOGRAPHY.fontSize.sm,
                      fontFamily: isActive ? TYPOGRAPHY.fontSecondaryBold : TYPOGRAPHY.fontSecondary,
                      color: isActive ? GOLD : "rgba(0,0,0,0.6)",
                    }}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Content */}
          {isLoading ? (
            <View style={{ paddingVertical: SPACING.xl }}>
              <ActivityIndicator color={PURPLE} size="large" accessibilityLabel="Loading leaderboard" />
            </View>
          ) : error ? (
            <View style={{ paddingVertical: SPACING.lg, paddingHorizontal: MODAL_CONTENT_PADDING }}>
              <Text
                style={{
                  fontSize: TYPOGRAPHY.fontSize.sm,
                  fontFamily: TYPOGRAPHY.fontSecondary,
                  color: COLORS.error ?? "#EF4444",
                  textAlign: "center",
                }}
                accessibilityRole="alert"
              >
                {error}
              </Text>
              <TouchableOpacity
                onPress={() => void fetchLeaderboard(activeTab)}
                style={{ marginTop: SPACING.md, alignItems: "center" }}
                accessibilityRole="button"
                accessibilityLabel="Retry loading leaderboard"
              >
                <Text
                  style={{
                    fontSize: TYPOGRAPHY.fontSize.sm,
                    fontFamily: TYPOGRAPHY.fontSecondaryBold,
                    color: PURPLE,
                  }}
                >
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          ) : entries.length === 0 ? (
            <View style={{ paddingVertical: SPACING.xl, paddingHorizontal: MODAL_CONTENT_PADDING }}>
              <Text
                style={{
                  fontSize: TYPOGRAPHY.fontSize.sm,
                  fontFamily: TYPOGRAPHY.fontSecondary,
                  color: "rgba(0,0,0,0.5)",
                  textAlign: "center",
                }}
              >
                No scores yet — be the first to make the board!
              </Text>
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: MODAL_SCROLLABLE_MAX_HEIGHT, width: "100%" }}
              contentContainerStyle={{
                paddingHorizontal: MODAL_CONTENT_PADDING,
                paddingBottom: SPACING.lg,
              }}
              showsVerticalScrollIndicator={false}
            >
              {entries.map((entry, index) => {
                const isCurrentUser = entry.userId === currentUserId;
                const rank = index + 1;
                const statValue = entry[activeTabConfig.statKey] as number;

                return (
                  <LeaderboardRow
                    key={entry.userId}
                    rank={rank}
                    entry={entry}
                    statValue={statValue}
                    isCurrentUser={isCurrentUser}
                  />
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface LeaderboardRowProps {
  /** One-based rank in the active leaderboard. */
  rank: number;
  /** Raw leaderboard entry data. */
  entry: LeaderboardEntry;
  /** Metric value for the active tab (xp/wins/streak). */
  statValue: number;
  /** True when this row belongs to the signed-in user. */
  isCurrentUser: boolean;
}

const RANK_COLORS: Record<number, string> = {
  1: "#FFD700",
  2: "#C0C0C0",
  3: "#CD7F32",
};

const LeaderboardRow: React.FC<LeaderboardRowProps> = ({
  rank,
  entry,
  statValue,
  isCurrentUser,
}) => {
  const rankColor = RANK_COLORS[rank] ?? "rgba(0,0,0,0.4)";
  const avatarSize = AVATAR_SIZE_MEDIUM * 0.6;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.sm,
        marginBottom: SPACING.xs,
        backgroundColor: isCurrentUser ? HIGHLIGHT_BG : "rgba(255,255,255,0.08)",
        borderRadius: CARD_BORDER_RADIUS,
        borderWidth: isCurrentUser ? 1 : 0,
        borderColor: isCurrentUser ? GOLD : "transparent",
      }}
      accessibilityLabel={`Rank ${rank}: ${entry.username}, score ${statValue}${isCurrentUser ? ", you" : ""}`}
    >
      {/* Rank */}
      <Text
        style={{
          width: 28,
          fontSize: rank <= 3 ? TYPOGRAPHY.fontSize.base : TYPOGRAPHY.fontSize.sm,
          fontFamily: TYPOGRAPHY.fontSecondaryBold,
          color: rankColor,
          textAlign: "center",
        }}
      >
        {rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : `${rank}`}
      </Text>

      {/* Avatar */}
      {entry.avatarUrl ? (
        <Image
          source={{ uri: entry.avatarUrl }}
          style={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
            marginHorizontal: SPACING.xs,
          }}
          accessibilityLabel={`${entry.username} avatar`}
        />
      ) : (
        <View
          style={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
            backgroundColor: "rgba(64,31,64,0.15)",
            marginHorizontal: SPACING.xs,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: TYPOGRAPHY.fontSize.xs,
              fontFamily: TYPOGRAPHY.fontSecondaryBold,
              color: "rgba(64,31,64,0.7)",
            }}
          >
            {entry.username.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      {/* Username */}
      <Text
        style={{
          flex: 1,
          fontSize: TYPOGRAPHY.fontSize.sm,
          fontFamily: isCurrentUser ? TYPOGRAPHY.fontSecondaryBold : TYPOGRAPHY.fontSecondary,
          color: isCurrentUser ? "#401F40" : "rgba(0,0,0,0.75)",
          marginLeft: SPACING.xs,
        }}
        numberOfLines={1}
      >
        {entry.username}
        {isCurrentUser ? " (you)" : ""}
      </Text>

      {/* Stat value */}
      <Text
        style={{
          fontSize: TYPOGRAPHY.fontSize.base,
          fontFamily: TYPOGRAPHY.fontSecondaryBold,
          color: "black",
          minWidth: 40,
          textAlign: "right",
        }}
      >
        {statValue.toLocaleString()}
      </Text>
    </View>
  );
};

export default LeaderboardModal;
