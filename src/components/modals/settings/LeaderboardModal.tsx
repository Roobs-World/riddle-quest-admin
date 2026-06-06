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
import React, {useEffect, useState, useCallback} from "react";
import {View, Text, Modal, ScrollView, TouchableOpacity, ActivityIndicator, Image} from "react-native";
import {getApp} from "@react-native-firebase/app";
import {getAuth} from "@react-native-firebase/auth";
import {getCallableFunction} from "../../../utils/firebaseFunctions";
import CloseButton from "../../buttons/CloseButton";
import {TYPOGRAPHY, COLORS, SPACING} from "../../../styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import {
  MODAL_WIDTH, MODAL_HEIGHT, CLOSE_BUTTON_SIZE, CARD_BORDER_RADIUS, MODAL_CONTENT_PADDING, AVATAR_SIZE_MEDIUM, MODAL_MAX_HEIGHT, } from "../../../constants/layout";
import {logger} from "../../../utils/logger";
import {captureException} from "../../../utils/sentry";
import {t} from "../../../i18n";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {scale, verticalScale, moderateScale} from "@/utils/responsive";

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

interface GetLeaderboardResult {
  entries?: LeaderboardEntry[];
  requestingUserId?: string;
}

interface RequestingUserState {
  currentUserId: string | null;
  requestingUserId: string | null;
}

const isUnauthenticatedLeaderboardError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as {code?: unknown; message?: unknown};
  const code = typeof maybeError.code === "string" ? maybeError.code.toLowerCase() : "";
  const message = typeof maybeError.message === "string" ? maybeError.message.toLowerCase() : "";

  return code === "unauthenticated" || code === "functions/unauthenticated" || message.includes("unauthenticated");
};

const normalizeUserId = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildUserIdCandidates = (userIds: Array<string | null | undefined>): string[] => {
  const candidates: string[] = [];
  for (const rawUserId of userIds) {
    const normalizedUserId = normalizeUserId(rawUserId);
    if (normalizedUserId && !candidates.includes(normalizedUserId)) {
      candidates.push(normalizedUserId);
    }
  }
  return candidates;
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PURPLE = "#401F40";
const GOLD = "#FEC880";
const TAB_INACTIVE = "rgba(0,0,0,0.15)";
const TAB_ACTIVE_DOT_SIZE = moderateScale(8);
const HIGHLIGHT_BG = "rgba(254,200,128,0.25)";
const MAX_ROWS = 10;
const TOP_ROWS = 9;

const TABS: {type: LeaderboardType; statKey: keyof LeaderboardEntry}[] = [
  {type: "xp", statKey: "xp"},
  {type: "totalWins", statKey: "totalWins"},
  {type: "bestStreak", statKey: "bestStreak"},
];

const getTabLabel = (type: LeaderboardType): string => {
  if (type === "xp") return t("Leaderboard.TAB_XP");
  if (type === "totalWins") return t("Leaderboard.TAB_WINS");
  return t("Leaderboard.TAB_STREAK");
};

const createDevFakeEntry = (index: number): LeaderboardEntry => {
  const seed = TOP_ROWS - index;
  return {
    userId: `dev-fake-${index + 1}`,
    username: `Player ${index + 1}`,
    xp: Math.max(0, seed * 100),
    totalWins: Math.max(0, seed * 3),
    bestStreak: Math.max(0, seed),
    updatedAt: Date.now(),
  };
};

const createCurrentUserFallback = (currentUserId: string): LeaderboardEntry => ({
  userId: currentUserId,
  username: "You",
  xp: 0,
  totalWins: 0,
  bestStreak: 0,
  updatedAt: Date.now(),
});

const buildDisplayEntries = (
  rawEntries: LeaderboardEntry[],
  currentUserIds: string[],
  fallbackCurrentUserId: string | null,
  type: LeaderboardType,
): LeaderboardEntry[] => {
  const normalizedCurrentUserIds = new Set(
    currentUserIds.map((value) => normalizeUserId(value)).filter((value): value is string => value != null),
  );
  const isCurrentUserEntry = (entry: LeaderboardEntry): boolean => {
    const normalizedEntryUserId = normalizeUserId(entry.userId);
    return normalizedEntryUserId != null && normalizedCurrentUserIds.has(normalizedEntryUserId);
  };

  const sortedEntries = [...rawEntries].sort((a, b) => {
    if (type === "totalWins") {
      return b.totalWins - a.totalWins;
    }
    if (type === "bestStreak") {
      return b.bestStreak - a.bestStreak;
    }
    return b.xp - a.xp;
  });

  const currentUserEntry =
    normalizedCurrentUserIds.size === 0
      ? null
      : (sortedEntries.find((entry) => isCurrentUserEntry(entry)) ??
        (fallbackCurrentUserId ? createCurrentUserFallback(fallbackCurrentUserId) : null));
  const nonCurrentUserEntries = sortedEntries.filter((entry) => !isCurrentUserEntry(entry));
  const currentUserRank = currentUserEntry ? sortedEntries.findIndex((entry) => isCurrentUserEntry(entry)) : -1;

  let rankedEntries: LeaderboardEntry[];
  if (!currentUserEntry) {
    rankedEntries = sortedEntries.slice(0, MAX_ROWS);
  } else if (currentUserRank >= 0 && currentUserRank < MAX_ROWS) {
    rankedEntries = [...nonCurrentUserEntries];
    rankedEntries.splice(currentUserRank, 0, currentUserEntry);
    rankedEntries = rankedEntries.slice(0, MAX_ROWS);
  } else {
    rankedEntries = [...nonCurrentUserEntries.slice(0, TOP_ROWS), currentUserEntry].slice(0, MAX_ROWS);
  }

  if (!__DEV__) {
    return rankedEntries;
  }

  const paddedEntries = [...rankedEntries];
  while (paddedEntries.length < MAX_ROWS) {
    paddedEntries.push(createDevFakeEntry(paddedEntries.length));
  }

  return paddedEntries.slice(0, MAX_ROWS);
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const LeaderboardModal: React.FC<LeaderboardModalProps> = ({isVisible, onClose, currentUserId}) => {
  const modalHeight = Math.min(MODAL_HEIGHT, MODAL_MAX_HEIGHT ?? MODAL_HEIGHT);
  const authUserId = normalizeUserId(getAuth(getApp()).currentUser?.uid ?? null);
  const normalizedCurrentUserId = normalizeUserId(currentUserId);
  const shouldUseAuthUserIdFallback = normalizedCurrentUserId != null;
  const [activeTab, setActiveTab] = useState<LeaderboardType>("xp");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [requestingUserState, setRequestingUserState] = useState<RequestingUserState | null>(null);
  const [isLoading, setIsLoading] = useState(isVisible);
  const [error, setError] = useState<string | null>(null);
  const [isGuestUnavailable, setIsGuestUnavailable] = useState(false);

  const fetchLeaderboard = useCallback(
    async (type: LeaderboardType) => {
      setIsLoading(true);
      setError(null);
      setIsGuestUnavailable(false);
      try {
        if (!authUserId) {
          setEntries([]);
          setRequestingUserState({
            currentUserId: normalizedCurrentUserId,
            requestingUserId: normalizedCurrentUserId,
          });
          setIsGuestUnavailable(true);
          return;
        }

        const callable = getCallableFunction("getLeaderboard");
        const result = await callable({type, limit: 50});
        const data = result.data as GetLeaderboardResult;
        setEntries(data.entries ?? []);
        setRequestingUserState({
          currentUserId: normalizedCurrentUserId,
          requestingUserId:
            normalizeUserId(data.requestingUserId) ??
            (shouldUseAuthUserIdFallback ? authUserId : null) ??
            normalizedCurrentUserId,
        });
      } catch (err) {
        if (isUnauthenticatedLeaderboardError(err)) {
          setEntries([]);
          setRequestingUserState({
            currentUserId: normalizedCurrentUserId,
            requestingUserId: normalizedCurrentUserId,
          });
          setIsGuestUnavailable(true);
          return;
        }

        logger.error("[LeaderboardModal] Failed to fetch leaderboard:", err);
        captureException(err);
        setError(t("Leaderboard.LOAD_ERROR"));
      } finally {
        setIsLoading(false);
      }
    },
    [authUserId, normalizedCurrentUserId, shouldUseAuthUserIdFallback],
  );

  useEffect(() => {
    if (!isVisible) {
      return undefined;
    }

    void fetchLeaderboard(activeTab);
  }, [isVisible, activeTab, fetchLeaderboard]);

  const activeTabConfig = TABS.find((t) => t.type === activeTab)!;
  const requestingUserId =
    requestingUserState?.currentUserId === normalizedCurrentUserId
      ? requestingUserState.requestingUserId
      : normalizedCurrentUserId;
  const currentUserIdCandidates = buildUserIdCandidates([
    requestingUserId,
    normalizedCurrentUserId,
    shouldUseAuthUserIdFallback ? authUserId : null,
  ]);
  const fallbackCurrentUserId =
    requestingUserId ?? normalizedCurrentUserId ?? (shouldUseAuthUserIdFallback ? authUserId : null);
  const displayEntries = buildDisplayEntries(entries, currentUserIdCandidates, fallbackCurrentUserId, activeTab);

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      accessibilityLabel={t("Leaderboard.TITLE")}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <SlideInModalContent isVisible={isVisible} style={{alignItems: "center"}}>
          <View
            style={{
              width: MODAL_WIDTH,
              height: modalHeight,
              alignItems: "center",
              overflow: "hidden",
            }}
          >
            <ModalBg width={MODAL_WIDTH} height={modalHeight} style={{position: "absolute"}} />
            {/* Decorative wave — clipped to card bounds */}
            <HomeBg
              width={MODAL_WIDTH * 1.1}
              height={modalHeight * 1.1}
              style={{position: "absolute", top: -modalHeight * 0.25, left: -MODAL_WIDTH * 0.05}}
            />
            <CloseButton
              onPress={onClose}
              size={CLOSE_BUTTON_SIZE}
              style={{
                position: "absolute",
                marginTop: verticalScale(42),
                right: SPACING.lg,
                zIndex: 10,
              }}
            />

            {/* Title */}
            <Text
              style={{
                fontSize: TYPOGRAPHY.fontSize["2xl"],
                fontFamily: TYPOGRAPHY.fontSecondaryBold,
                color: "black",
                marginTop: SPACING["2xl"],
                marginBottom: SPACING.sm,
              }}
              accessibilityRole="header"
            >
              {t("Leaderboard.TITLE")}
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
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: SPACING.xs,
                      paddingHorizontal: SPACING.md,
                      borderRadius: CARD_BORDER_RADIUS - 2,
                      backgroundColor: "transparent",
                    }}
                    accessibilityRole="tab"
                    accessibilityState={{selected: isActive}}
                    accessibilityLabel={getTabLabel(tab.type)}
                  >
                    <Text
                      style={{
                        fontSize: TYPOGRAPHY.fontSize.sm,
                        fontFamily: isActive ? TYPOGRAPHY.fontSecondaryBold : TYPOGRAPHY.fontSecondary,
                        color: isActive ? PURPLE : "rgba(0,0,0,0.6)",
                      }}
                    >
                      {getTabLabel(tab.type)}
                    </Text>
                    {isActive ? (
                      <View
                        testID={`leaderboard-tab-active-dot-${tab.type}`}
                        accessibilityLabel={`${getTabLabel(tab.type)} active tab indicator`}
                        style={{
                          width: TAB_ACTIVE_DOT_SIZE,
                          height: TAB_ACTIVE_DOT_SIZE,
                          borderRadius: TAB_ACTIVE_DOT_SIZE / 2,
                          backgroundColor: GOLD,
                          marginTop: moderateScale(4),
                        }}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{flex: 1, width: "100%"}}>
              {/* Content */}
              {isLoading ? (
                <View style={{flex: 1, justifyContent: "center", paddingVertical: SPACING.xl}}>
                  <ActivityIndicator
                    color={PURPLE}
                    size="large"
                    accessibilityLabel={t("Accessibility.LOADING_LEADERBOARD")}
                  />
                </View>
              ) : isGuestUnavailable ? (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    paddingVertical: SPACING.xl,
                    paddingHorizontal: MODAL_CONTENT_PADDING,
                  }}
                >
                  <Text
                    style={{
                      fontSize: TYPOGRAPHY.fontSize.sm,
                      fontFamily: TYPOGRAPHY.fontSecondary,
                      color: "rgba(0,0,0,0.55)",
                      textAlign: "center",
                    }}
                  >
                    {t("Leaderboard.GUEST_UNAVAILABLE")}
                  </Text>
                </View>
              ) : error ? (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    paddingVertical: SPACING.lg,
                    paddingHorizontal: MODAL_CONTENT_PADDING,
                  }}
                >
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
                    style={{marginTop: SPACING.md, alignItems: "center"}}
                    accessibilityRole="button"
                    accessibilityLabel={t("Leaderboard.RETRY_BUTTON")}
                  >
                    <Text
                      style={{
                        fontSize: TYPOGRAPHY.fontSize.sm,
                        fontFamily: TYPOGRAPHY.fontSecondaryBold,
                        color: PURPLE,
                      }}
                    >
                      {t("Leaderboard.RETRY_BUTTON")}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : displayEntries.length === 0 ? (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    paddingVertical: SPACING.xl,
                    paddingHorizontal: MODAL_CONTENT_PADDING,
                  }}
                >
                  <Text
                    style={{
                      fontSize: TYPOGRAPHY.fontSize.sm,
                      fontFamily: TYPOGRAPHY.fontSecondary,
                      color: "rgba(0,0,0,0.5)",
                      textAlign: "center",
                    }}
                  >
                    {t("Leaderboard.NO_SCORES_YET")}
                  </Text>
                </View>
              ) : (
                <ScrollView
                  style={{flex: 1, width: "100%"}}
                  contentContainerStyle={{
                    paddingHorizontal: MODAL_CONTENT_PADDING,
                    paddingBottom: SPACING.lg,
                  }}
                  showsVerticalScrollIndicator={false}
                >
                  {displayEntries.map((entry, index) => {
                    const isCurrentUser = currentUserIdCandidates.includes(entry.userId);
                    const rank = index + 1;
                    const statValue = entry[activeTabConfig.statKey] as number;

                    return (
                      <LeaderboardRow
                        key={`${entry.userId}-${index}`}
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
        </SlideInModalContent>
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

const LeaderboardRow: React.FC<LeaderboardRowProps> = ({rank, entry, statValue, isCurrentUser}) => {
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
          width: scale(28),
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
          source={{uri: entry.avatarUrl}}
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
