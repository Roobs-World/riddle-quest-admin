import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { Player } from "../../../validation/firestoreSchemas";
import CloseButton from "../../buttons/CloseButton";
import { useModal } from "../../../hooks/useModal";
import UpdateUsernameModal from "./UpdateUsernameModal";
import * as ImagePicker from "react-native-image-picker";
import { TYPOGRAPHY, SPACING, COLORS } from "../../../styles";
import { getStorage } from "@react-native-firebase/storage";
import { getApp } from "@react-native-firebase/app";
import {
  CLOSE_BUTTON_SIZE,
  AVATAR_SIZE_LARGE,
} from "../../../constants/layout";
import { moderateScale, verticalScale } from "../../../utils/responsive";
import LogoIcon from "../../icons/LogoIcon";
import TreasureChest from "./TreasureChest";
import { getXpLevel } from "../../../constants/game";
import { isGuestPlayer } from "@/features/auth/sessionBootstrap";
import { AppStrings } from "../../../constants/AppStrings";
import { useAuth } from "@/contexts/AuthContext";
import PulsingSpinner from "@/components/loading/PulsingSpinner";
import {
  LOADING_SPINNER_OPACITY,
  LOADING_SPINNER_SIZE,
} from "@/constants/loading";

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
  playerData,
}) => {
  const modal = useModal();
  const { updatePlayerData, playerData: authPlayerData } = useAuth();
  const resolvedPlayerData =
    authPlayerData && playerData && authPlayerData.userId === playerData.userId
      ? authPlayerData
      : playerData;
  const isGuestMode = isGuestPlayer(resolvedPlayerData);
  const [isUsernameModalVisible, setIsUsernameModalVisible] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    resolvedPlayerData?.avatarUrl ?? null
  );

  useEffect(() => {
    setAvatarUrl(resolvedPlayerData?.avatarUrl ?? null);
  }, [resolvedPlayerData?.avatarUrl]);

  if (!resolvedPlayerData) {
    return null;
  }

  const { stats } = resolvedPlayerData;
  const avatarRadius = AVATAR_SIZE_LARGE / 2;
  const initial = resolvedPlayerData.username
    ? resolvedPlayerData.username.charAt(0).toUpperCase()
    : "?";

  const handleUploadAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibrary({
        mediaType: "photo",
        maxHeight: 200,
        maxWidth: 200,
        includeBase64: false,
      });

      if (result.didCancel) {
        return;
      }

      if (result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];

        if (selectedAsset.uri && resolvedPlayerData.userId) {
          const uploadUri = selectedAsset.uri;
          const uniqueFilename = `avatar_${Date.now()}.jpg`;

          const storageRef = getStorage(getApp()).ref(
            `avatars/${resolvedPlayerData.userId}/${uniqueFilename}`
          );

          setIsUploading(true);

          await storageRef.putFile(uploadUri);

          const downloadURL = await storageRef.getDownloadURL();

          await updatePlayerData({ avatarUrl: downloadURL });

          setAvatarUrl(`${downloadURL}&cb=${Date.now()}`);
        }
      }
    } catch {
      Alert.alert(
        AppStrings.CommonAlerts.ERROR_TITLE,
        AppStrings.Profile.ALERT_AVATAR_UPDATE_ERROR
      );
    } finally {
      setIsUploading(false);
    }
  };

  const winRate = Math.round(stats?.winRate ?? 0);
  const avgGuess =
    stats?.averageGuesses != null
      ? Number(stats.averageGuesses).toFixed(1)
      : "—";
  const xpFromProfile =
    (resolvedPlayerData as unknown as { xp?: unknown; totalXp?: unknown }).xp ??
    (resolvedPlayerData as unknown as { xp?: unknown; totalXp?: unknown }).totalXp ??
    (stats as unknown as { xp?: unknown; totalXp?: unknown })?.xp ??
    (stats as unknown as { xp?: unknown; totalXp?: unknown })?.totalXp ??
    stats?.totalScore ??
    0;
  const totalXp = Number.isFinite(Number(xpFromProfile))
    ? Number(xpFromProfile)
    : 0;
  const { level, progressPct, currentXp, nextLevelXp } = getXpLevel(totalXp);
  const xpProgressWidth = `${Math.round(progressPct * 100)}%` as `${number}%`;

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
            maxHeight: "100%",
          }}
        >
          <View
            style={{
              backgroundColor: PURPLE,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingBottom: SPACING.xl,
              overflow: "hidden",
            }}
          >
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
                {AppStrings.Profile.PROFILE_HEADER}
              </Text>
              <CloseButton
                onPress={onClose}
                size={CLOSE_BUTTON_SIZE}
                color="white"
              />
            </View>

            <View style={{ alignItems: "center", marginTop: SPACING.sm }}>
              <TouchableOpacity
                onPress={handleUploadAvatar}
                activeOpacity={0.8}
              >
                {avatarUrl ? (
                  <Image
                    key={avatarUrl}
                    testID="avatar-image"
                    source={{ uri: avatarUrl }}
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

              <TouchableOpacity
                onPress={() => setIsUsernameModalVisible(true)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: SPACING.sm,
                  gap: 6,
                }}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: TYPOGRAPHY.fontSize.lg,
                    fontFamily: TYPOGRAPHY.fontSecondaryBold,
                  }}
                >
                  {resolvedPlayerData.username || AppStrings.Profile.GUEST_USERNAME}
                </Text>
                <Text style={{ color: GOLD, fontSize: 24 }}>✏</Text>
              </TouchableOpacity>

              <View
                style={{
                  width: "70%",
                  marginTop: SPACING.sm,
                  gap: 4,
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Text style={{ color: GOLD, fontSize: 24 }}>★</Text>
                  <View
                    style={{
                      flex: 1,
                      height: 8,
                      backgroundColor: "rgba(255,255,255,0.2)",
                      borderRadius: 4,
                      overflow: "hidden",
                    }}
                  >
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
                  <Text
                    style={{
                      color: GOLD,
                      fontSize: TYPOGRAPHY.fontSize.lg,
                      fontFamily: TYPOGRAPHY.fontSecondary,
                    }}
                  >
                    {AppStrings.Profile.XP_LEVEL_PREFIX}
                    {level}
                  </Text>
                </View>
                <Text
                  style={{
                    color: COLORS.white,
                    fontSize: TYPOGRAPHY.fontSize.lg,
                    fontFamily: TYPOGRAPHY.fontSecondary,
                    textAlign: "center",
                  }}
                >
                  {`${currentXp} / ${nextLevelXp} XP`}
                </Text>
              </View>
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: SPACING.lg }}
            showsVerticalScrollIndicator={false}
            alwaysBounceVertical={true}
            bounces={true}
          >
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: TYPOGRAPHY.fontSize.lg,
                color: "#1A1A1A",
                marginBottom: SPACING.md,
              }}
            >
              {AppStrings.Profile.DAILY_PUZZLES_COMPLETED_HEADER}
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
                {AppStrings.Profile.REGULAR_DAYS_LABEL}
              </Text>
            </View>

            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: TYPOGRAPHY.fontSize.lg,
                color: "#1A1A1A",
                marginBottom: SPACING.md,
              }}
            >
              {AppStrings.Profile.BEST_STRIKE_HEADER}
            </Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: SPACING.sm,
                marginBottom: SPACING.lg,
              }}
            >
              <StatBox
                value={stats?.bestStreak ?? 0}
                label={AppStrings.StatsModal.BEST_STREAK}
              />
              <StatBox
                value={stats?.wins ?? 0}
                label={AppStrings.StatsModal.TOTAL_WORDS_GUESSED}
              />
              <StatBox
                value={`${winRate}%`}
                label={AppStrings.StatsModal.WIN_RATE}
              />
              <StatBox
                value={avgGuess}
                label={AppStrings.Profile.AVG_GUESS_LABEL}
              />
            </View>

            <View style={{ marginBottom: SPACING.lg }}>
              <TreasureChest coins={resolvedPlayerData.coins ?? 0} />
            </View>

            <View style={{ height: SPACING.sm }} />

            <TouchableOpacity
              onPress={() =>
                modal.openGameModal("achievements", {
                  playerData: resolvedPlayerData,
                })
              }
              style={actionButtonStyle}
            >
              <Text style={actionButtonTextStyle}>
                {AppStrings.Achievements.MODAL_TITLE}
              </Text>
            </TouchableOpacity>

            <View style={{ height: SPACING.sm }} />

            <TouchableOpacity
              onPress={() =>
                modal.openGameModal("stats", {
                  playerData: resolvedPlayerData,
                })
              }
              style={actionButtonStyle}
            >
              <Text style={actionButtonTextStyle}>
                {AppStrings.StatsModal.TITLE}
              </Text>
            </TouchableOpacity>

            <View style={{ height: SPACING.sm }} />

            <TouchableOpacity
              onPress={() =>
                modal.openGameModal("leaderboard", {
                  currentUserId: resolvedPlayerData.userId,
                })
              }
              style={actionButtonStyle}
            >
              <Text style={actionButtonTextStyle}>
                {AppStrings.Leaderboard.TITLE}
              </Text>
            </TouchableOpacity>

            <View
              style={{ height: SPACING.xl, marginBottom: verticalScale(24) }}
            />
          </ScrollView>
        </View>
      </View>

      <UpdateUsernameModal
        isVisible={isUsernameModalVisible}
        onClose={() => setIsUsernameModalVisible(false)}
        currentUsername={resolvedPlayerData.username || ""}
      />

      <PulsingSpinner
        visible={isUploading}
        size={LOADING_SPINNER_SIZE}
        opacity={LOADING_SPINNER_OPACITY}
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
