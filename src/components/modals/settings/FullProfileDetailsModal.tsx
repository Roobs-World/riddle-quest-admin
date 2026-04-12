import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
} from "react-native";
import { Player } from "../../../validation/firestoreSchemas";
import CloseButton from "../../buttons/CloseButton";
import { useModal } from "../../../hooks/useModal";
import ChangePasswordModal from "./ChangePasswordModal";
import UpdateUsernameModal from "./UpdateUsernameModal";
import AvatarOptionsModal from "./AvatarOptionsModal";
import PreloadedAvatarsModal from "./PreloadedAvatarsModal";
import { TYPOGRAPHY, SPACING, COLORS } from "../../../styles";
import {
  CLOSE_BUTTON_SIZE,
  AVATAR_SIZE_LARGE,
} from "../../../constants/layout";
import { moderateScale, verticalScale } from "../../../utils/responsive";
import LogoIcon from "../../icons/LogoIcon";
import TreasureChest from "./TreasureChest";
import { getXpLevel } from "../../../constants/game";
import { logger } from "@/utils/logger";
import { isGuestPlayer } from "@/features/auth/sessionBootstrap";

interface FullProfileDetailsModalProps {
  isVisible: boolean;
  onClose: () => void;
  playerData: Player | null;
}

const PURPLE = "#401F40";
const CREAM = "#FCFAF4";
const GOLD = "#FEC880";

const FullProfileDetailsModal: React.FC<FullProfileDetailsModalProps> = ({
  isVisible,
  onClose,
  playerData
}) => {
  const modal = useModal();
  const isGuestMode = isGuestPlayer(playerData);
  const [isUsernameModalVisible, setIsUsernameModalVisible] = useState(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [isPreloadedAvatarsModalVisible, setIsPreloadedAvatarsModalVisible] =
    useState(false);
  const [isAvatarOptionsModalVisible, setIsAvatarOptionsModalVisible] =
    useState(false);

  if (!playerData) {
    return null;
  }

  const { stats } = playerData;
  const avatarRadius = AVATAR_SIZE_LARGE / 2;
  const initial = playerData.username ? playerData.username.charAt(0).toUpperCase() : "?";

  const handleUpdateAvatarPress = () => setIsAvatarOptionsModalVisible(true);
  const handleCloseAvatarOptionsModal = () => setIsAvatarOptionsModalVisible(false);
  const handleOpenPreloadedAvatars = () => setIsPreloadedAvatarsModalVisible(true);
  const handleClosePreloadedAvatars = () => setIsPreloadedAvatarsModalVisible(false);

  const winRate = Math.round(stats?.winRate ?? 0);
  const avgGuess = stats?.averageGuesses != null
    ? Number(stats.averageGuesses).toFixed(1)
    : "—";
  const xpFromProfile =
    (playerData as unknown as { xp?: unknown; totalXp?: unknown }).xp ??
    (playerData as unknown as { xp?: unknown; totalXp?: unknown }).totalXp ??
    (stats as unknown as { xp?: unknown; totalXp?: unknown })?.xp ??
    (stats as unknown as { xp?: unknown; totalXp?: unknown })?.totalXp ??
    stats?.totalScore ??
    0;
  const totalXp = Number.isFinite(Number(xpFromProfile)) ? Number(xpFromProfile) : 0;
  const { level, progressPct, currentXp, nextLevelXp } = getXpLevel(totalXp);
  const xpProgressWidth = `${Math.round(progressPct * 100)}%` as `${number}%`;
  logger.warn('is guest mode', isGuestMode)
  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <View
          style={{
            backgroundColor: CREAM,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            flex: 1,
            maxHeight: "92%",
          }}
        >
          {/* ── Dark purple header ───────────────────────────── */}
          <View
            style={{
              backgroundColor: PURPLE,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingBottom: SPACING.xl,
              overflow: "hidden",
            }}
          >
            {/* Decorative wave lines */}
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={{
                  position: "absolute",
                  left: -20,
                  right: -20,
                  top: 40 + i * 28,
                  height: 1,
                  backgroundColor: "rgba(255,255,255,0.07)",
                  transform: [{ rotate: "-8deg" }],
                }}
              />
            ))}

            {/* Top bar: logo | PROFILE | close */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: SPACING.lg,
                paddingTop: SPACING.lg,
                paddingBottom: SPACING.sm,
              }}
            >
              <LogoIcon width={32} height={32} color="#FFFFFF" />
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontPrimary,
                  fontSize: TYPOGRAPHY.fontSize["3xl"],
                  color: "#FFFFFF",
                  letterSpacing: 2,
                }}
              >
                PROFILE
              </Text>
              <CloseButton
                onPress={onClose}
                size={CLOSE_BUTTON_SIZE}
                color="white"
              />
            </View>

            {/* Avatar */}
            <View style={{ alignItems: "center", marginTop: SPACING.sm }}>
              <TouchableOpacity
                onPress={handleUpdateAvatarPress}
                activeOpacity={0.8}
              >
                {playerData.avatarUrl ? (
                  <Image
                    testID="avatar-image"
                    source={{ uri: playerData.avatarUrl }}
                    style={{
                      width: AVATAR_SIZE_LARGE,
                      height: AVATAR_SIZE_LARGE,
                      borderRadius: avatarRadius,
                      borderWidth: moderateScale(3),
                      borderColor: "#FFFFFF",
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: AVATAR_SIZE_LARGE,
                      height: AVATAR_SIZE_LARGE,
                      borderRadius: avatarRadius,
                      backgroundColor: "rgba(255,255,255,0.15)",
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: moderateScale(3),
                      borderColor: "#FFFFFF",
                    }}
                  >
                    <Text
                      style={{
                        color: "#FFFFFF",
                        fontSize: TYPOGRAPHY.fontSize.display,
                        fontFamily: TYPOGRAPHY.fontSecondaryBold,
                      }}
                    >
                      {initial}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Username + edit */}
              <TouchableOpacity
                onPress={() => setIsUsernameModalVisible(true)}
                style={{ flexDirection: "row", alignItems: "center", marginTop: SPACING.sm, gap: 6 }}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: TYPOGRAPHY.fontSize.lg,
                    fontFamily: TYPOGRAPHY.fontSecondaryBold,
                  }}
                >
                  {playerData.username || "Guest"}
                </Text>
                <Text style={{ color: GOLD, fontSize: 24 }}>✏</Text>
              </TouchableOpacity>

              {/* XP progress bar */}
              <View
                style={{
                  width: "70%",
                  marginTop: SPACING.sm,
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ color: GOLD, fontSize: 24  }}>★</Text>
                  <View style={{ flex: 1, height: 8, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 4, overflow: "hidden" }}>
                    <View
                      testID="xp-progress-fill"
                      style={{
                        width: xpProgressWidth,
                        height: "100%",
                        backgroundColor: GOLD,
                        borderRadius: 4,
                      }}
                    />
                  </View>
                  <Text style={{ color: GOLD, fontSize: TYPOGRAPHY.fontSize.lg, fontFamily: TYPOGRAPHY.fontSecondary }}>
                    Lv.{level}
                  </Text>
                </View>
                <Text style={{ color: COLORS.white, fontSize: TYPOGRAPHY.fontSize.lg, fontFamily: TYPOGRAPHY.fontSecondary, textAlign: "center" }}>
                  {`${currentXp} / ${nextLevelXp} XP` }
                </Text>
              </View>
            </View>
          </View>

          {/* ── Scrollable stats section ─────────────────────── */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: SPACING.lg }}
            showsVerticalScrollIndicator={false}
            alwaysBounceVertical={true}
            bounces={true}
          >
            {/* Daily puzzles completed */}
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: TYPOGRAPHY.fontSize.lg,
                color: "#1A1A1A",
                marginBottom: SPACING.md,
              }}
            >
              Daily puzzles completed
            </Text>
            <View
              style={{
                backgroundColor: "#F5EDD4",
                borderRadius: 16,
                padding: SPACING.md,
                flexDirection: "row",
                alignItems: "center",
                marginBottom: SPACING.lg,
                gap: SPACING.md,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  
                  backgroundColor: COLORS.figmaGold,
                  borderRadius: 100,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 24 }}>🏅</Text>
              </View>
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontPrimary,
                  fontSize: TYPOGRAPHY.fontSize["2xl"],
                  color: "#1A1A1A",
                  flex: 1,
                }}
              >
                {stats?.dailyPuzzlesCompleted ?? 0}
              </Text>
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontSecondary,
                  fontSize: TYPOGRAPHY.fontSize.sm,
                  color: "#6B7280",
                  textAlign: "right",
                }}
              >
                Regular Days{"\n"}Completed
              </Text>
            </View>

            {/* Best Strike */}
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: TYPOGRAPHY.fontSize.lg,
                color: "#1A1A1A",
                marginBottom: SPACING.md,
              }}
            >
              Best Strike
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: SPACING.sm,
                marginBottom: SPACING.lg,
              }}
            >
              <StatBox value={stats?.bestStreak ?? 0} label="Best streak" />
              <StatBox value={stats?.wins ?? 0} label="Total words guessed" />
              <StatBox value={`${winRate}%`} label="Win rate" />
              <StatBox value={avgGuess} label="Average guess" />
            </View>

            {/* Treasure chest */}
            <View style={{ marginBottom: SPACING.lg }}>
              <TreasureChest coins={playerData.coins ?? 0} />
            </View>

            {/* Action buttons */}
            {!isGuestMode && (
              <TouchableOpacity
                onPress={() => setIsPasswordModalVisible(true)}
                style={actionButtonStyle}
              >
                <Text style={actionButtonTextStyle}>Change Password</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: SPACING.sm }} />

            <TouchableOpacity
              onPress={() => modal.openGameModal("achievements", { playerData })}
              style={actionButtonStyle}
            >
              <Text style={actionButtonTextStyle}>Achievements</Text>
            </TouchableOpacity>

            <View style={{ height: SPACING.sm }} />

            <TouchableOpacity
              onPress={() => modal.openGameModal("stats", { playerData })}
              style={actionButtonStyle}
            >
              <Text style={actionButtonTextStyle}>Statistics</Text>
            </TouchableOpacity>

            <View style={{ height: SPACING.sm }} />

            <TouchableOpacity
              onPress={() => modal.openGameModal("leaderboard", { currentUserId: playerData.userId })}
              style={actionButtonStyle}
            >
              <Text style={actionButtonTextStyle}>Leaderboard</Text>
            </TouchableOpacity>

            <View style={{ height: SPACING.xl, marginBottom: verticalScale(24) }} />
          </ScrollView>
        </View>
      </View>

      <ChangePasswordModal
        isVisible={isPasswordModalVisible}
        onClose={() => setIsPasswordModalVisible(false)}
      />
      <UpdateUsernameModal
        isVisible={isUsernameModalVisible}
        onClose={() => setIsUsernameModalVisible(false)}
        currentUsername={playerData.username || ""}
      />
      <AvatarOptionsModal
        isVisible={isAvatarOptionsModalVisible}
        onClose={handleCloseAvatarOptionsModal}
        onOpenPreloadedAvatars={handleOpenPreloadedAvatars}
        userId={playerData.userId}
      />
      <PreloadedAvatarsModal
        isVisible={isPreloadedAvatarsModalVisible}
        onClose={handleClosePreloadedAvatars}
        onCloseAvatarOptions={handleCloseAvatarOptionsModal}
      />
    </Modal>
  );
};

const actionButtonStyle = {
  backgroundColor: "#FEC880",
  borderRadius: 14,
  paddingVertical: 14,
  alignItems: "center" as const,
};

const actionButtonTextStyle = {
  fontFamily: TYPOGRAPHY.fontPrimary,
  fontSize: TYPOGRAPHY.fontSize.base,
  color: "#1A1A1A",
};

const StatBox = ({
  value,
  label,
}: {
  value: number | string;
  label: string;
}) => (
  <View
    style={{
      flex: 1,
      minWidth: "45%",
      backgroundColor: "#FFFFFF",
      borderRadius: 14,
      padding: SPACING.md,
      alignItems: "center",
      borderWidth: 1,
      borderColor: "#F0EAF0",
    }}
  >
    <Text
      style={{
        fontFamily: TYPOGRAPHY.fontPrimary,
        fontSize: TYPOGRAPHY.fontSize["2xl"],
        color: "#1A1A1A",
      }}
    >
      {typeof value === "number" ? value.toString() : value}
    </Text>
    <Text
      style={{
        fontFamily: TYPOGRAPHY.fontSecondary,
        fontSize: TYPOGRAPHY.fontSize.xs,
        color: "#6B7280",
        textAlign: "center",
        marginTop: 2,
      }}
    >
      {label}
    </Text>
  </View>
);

export default FullProfileDetailsModal;
