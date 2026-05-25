import React, {useRef, useState} from "react";
import {View, Text, TouchableOpacity, Modal, ScrollView, Image, Alert} from "react-native";
import {Player} from "../../../validation/firestoreSchemas";
import CloseButton from "../../buttons/CloseButton";
import {useModal} from "../../../hooks/useModal";
import UpdateUsernameModal from "./UpdateUsernameModal";
import * as ImagePicker from "react-native-image-picker";
import {TYPOGRAPHY, SPACING, COLORS} from "../../../styles";
import {getStorage} from "@react-native-firebase/storage";
import {getApp} from "@react-native-firebase/app";
import {getAuth} from "@react-native-firebase/auth";
import {
  CLOSE_BUTTON_SIZE,
  AVATAR_SIZE_LARGE,
  AUTH_CONTENT_MAX_WIDTH,
  MODAL_MAX_HEIGHT,
} from "../../../constants/layout";
import {moderateScale, verticalScale} from "../../../utils/responsive";
import LogoIcon from "../../icons/LogoIcon";
import TreasureChest from "./TreasureChest";
import {getXpLevel} from "../../../constants/game";
import {isGuestPlayer} from "@/features/auth/sessionBootstrap";
import {AppStrings} from "../../../constants/AppStrings";
import {useAuth} from "@/contexts/AuthContext";
import PulsingSpinner from "@/components/loading/PulsingSpinner";
import UpgradeAccountModal from "./UpgradeAccountModal";
import {LOADING_SPINNER_OPACITY, LOADING_SPINNER_SIZE} from "@/constants/loading";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {useTooltip} from "../../../contexts/TooltipContext";
import type {TooltipId} from "../../tooltips/types";
import DeleteAccountConfirmationModal from "./DeleteAccountConfirmationModal";
import {getCallableFunction} from "../../../utils/firebaseFunctions";

interface FullProfileDetailsModalProps {
  isVisible: boolean;
  onClose: () => void;
  playerData: Player | null;
}

const PURPLE = "#401F40";
const CREAM = "#FCFAF4";
const GOLD = "#FEC880";

const getProfileTooltipContent = (id: TooltipId) => {
  switch (id) {
    case "profileIdentity":
      return {
        title: AppStrings.Tooltips.PROFILE_IDENTITY_TITLE,
        body: AppStrings.Tooltips.PROFILE_IDENTITY_BODY,
        action: AppStrings.Tooltips.GOT_IT_BUTTON,
      };
    case "profileDailyPuzzles":
      return {
        title: AppStrings.Tooltips.PROFILE_DAILY_PUZZLES_TITLE,
        body: AppStrings.Tooltips.PROFILE_DAILY_PUZZLES_BODY,
        action: AppStrings.Tooltips.GOT_IT_BUTTON,
      };
    case "profileStats":
      return {
        title: AppStrings.Tooltips.PROFILE_STATS_TITLE,
        body: AppStrings.Tooltips.PROFILE_STATS_BODY,
        action: AppStrings.Tooltips.GOT_IT_BUTTON,
      };
    case "profileCoins":
      return {
        title: AppStrings.Tooltips.PROFILE_COINS_TITLE,
        body: AppStrings.Tooltips.PROFILE_COINS_BODY,
        action: AppStrings.Tooltips.GOT_IT_BUTTON,
      };
    case "profileAchievements":
      return {
        title: AppStrings.Tooltips.PROFILE_ACHIEVEMENTS_TITLE,
        body: AppStrings.Tooltips.PROFILE_ACHIEVEMENTS_BODY,
        action: AppStrings.Tooltips.GOT_IT_BUTTON,
      };
    case "profileStatistics":
      return {
        title: AppStrings.Tooltips.PROFILE_STATISTICS_TITLE,
        body: AppStrings.Tooltips.PROFILE_STATISTICS_BODY,
        action: AppStrings.Tooltips.GOT_IT_BUTTON,
      };
    case "profileLeaderboard":
      return {
        title: AppStrings.Tooltips.PROFILE_LEADERBOARD_TITLE,
        body: AppStrings.Tooltips.PROFILE_LEADERBOARD_BODY,
        action: AppStrings.Tooltips.GOT_IT_BUTTON,
      };
    default:
      return {
        title: AppStrings.CommonAlerts.INFO_TITLE,
        body: "",
        action: AppStrings.Tooltips.GOT_IT_BUTTON,
      };
  }
};

const FullProfileDetailsModal: React.FC<FullProfileDetailsModalProps> = ({isVisible, onClose, playerData}) => {
  const modal = useModal();
  const tooltip = useTooltip();
  const {logout, updatePlayerData, playerData: authPlayerData} = useAuth();
  const resolvedPlayerData = authPlayerData ?? playerData;
  const firebaseUser = getAuth(getApp()).currentUser;
  const isGuestMode = firebaseUser ? firebaseUser.isAnonymous : isGuestPlayer(resolvedPlayerData);
  const [isUsernameModalVisible, setIsUsernameModalVisible] = useState(false);
  const [isUpgradeModalVisible, setIsUpgradeModalVisible] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const avatarUrl = resolvedPlayerData?.avatarUrl ?? null;
  const showProfileTooltip = (id: TooltipId, targetRef: React.RefObject<View | null>) => {
    void tooltip.showTooltip({
      id,
      targetRef,
      content: getProfileTooltipContent(id),
    });
  };

  const hasProfileData = Boolean(resolvedPlayerData);
  const stats = resolvedPlayerData?.stats;
  const avatarRadius = AVATAR_SIZE_LARGE / 2;
  const initial = resolvedPlayerData?.username ? resolvedPlayerData.username.charAt(0).toUpperCase() : "?";

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

        const userId = resolvedPlayerData?.userId;
        if (selectedAsset.uri && userId) {
          const uploadUri = selectedAsset.uri;
          const uniqueFilename = `avatar_${Date.now()}.jpg`;

          const storageRef = getStorage(getApp()).ref(`avatars/${userId}/${uniqueFilename}`);

          setIsUploading(true);

          await storageRef.putFile(uploadUri, {
            customMetadata: {
              ownerUid: userId,
              purpose: "avatar",
            },
          });

          const downloadURL = await storageRef.getDownloadURL();

          await updatePlayerData({avatarUrl: downloadURL});
        }
      }
    } catch {
      Alert.alert(AppStrings.CommonAlerts.ERROR_TITLE, AppStrings.Profile.ALERT_AVATAR_UPDATE_ERROR);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (isDeletingAccount) {
      return;
    }

    try {
      setIsDeletingAccount(true);
      const deleteAccountCallable = getCallableFunction("deleteAccount");
      await deleteAccountCallable({});
      setIsDeleteConfirmVisible(false);
      onClose();
      await logout();
    } catch {
      setIsDeleteConfirmVisible(false);
      modal.showInfoModal({
        title: AppStrings.Profile.DELETE_ACCOUNT_ERROR_TITLE,
        message: AppStrings.Profile.DELETE_ACCOUNT_ERROR_MESSAGE,
      });
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const winRate = Math.round(stats?.winRate ?? 0);
  const avgGuess = stats?.averageGuesses != null ? Number(stats.averageGuesses).toFixed(1) : "—";
  const xpFromProfile =
    (resolvedPlayerData as unknown as {xp?: unknown; totalXp?: unknown} | null)?.xp ??
    (resolvedPlayerData as unknown as {xp?: unknown; totalXp?: unknown} | null)?.totalXp ??
    (stats as unknown as {xp?: unknown; totalXp?: unknown})?.xp ??
    (stats as unknown as {xp?: unknown; totalXp?: unknown})?.totalXp ??
    stats?.totalScore ??
    0;
  const totalXp = Number.isFinite(Number(xpFromProfile)) ? Number(xpFromProfile) : 0;
  const {level, progressPct, currentXp, nextLevelXp} = getXpLevel(totalXp);
  const xpProgressWidth = `${Math.round(progressPct * 100)}%` as `${number}%`;

  return (
    <Modal visible={isVisible} transparent={true} animationType="none" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <SlideInModalContent
          isVisible={isVisible}
          style={{flex: 1, width: "100%", justifyContent: "flex-end", alignItems: "center"}}
        >
          <View
            style={{
              width: "100%",
              maxWidth: AUTH_CONTENT_MAX_WIDTH,
              backgroundColor: CREAM,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              flex: 1,
              maxHeight: MODAL_MAX_HEIGHT,
              overflow: "hidden",
              flexDirection: "column",
            }}
          >
            <View
              style={{
                backgroundColor: PURPLE,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingBottom: SPACING.xl,
                flexShrink: 0,
                overflow: "hidden",
                position: "relative",
              }}
              testID="profile-modal-header"
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
                    transform: [{rotate: "-8deg"}],
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
                <LogoIcon width={32} height={32} />
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
                <View style={{flexDirection: "row", alignItems: "center", gap: 8}}>
                  <ProfileHelpButton
                    tooltipId="profileIdentity"
                    onPress={showProfileTooltip}
                    inverse
                    testID="profile-help-identity"
                  />
                  <CloseButton onPress={onClose} size={CLOSE_BUTTON_SIZE} color="white" />
                </View>
              </View>

              <View style={{alignItems: "center", marginTop: SPACING.sm}}>
                <TouchableOpacity onPress={handleUploadAvatar} activeOpacity={0.8}>
                  {avatarUrl ? (
                    <Image
                      key={avatarUrl}
                      testID="avatar-image"
                      source={{uri: avatarUrl}}
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
                  accessibilityRole="button"
                  accessibilityLabel={AppStrings.Profile.UPDATE_USERNAME_TITLE}
                  testID="profile-username-button"
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
                    {resolvedPlayerData?.username || AppStrings.Profile.GUEST_USERNAME}
                  </Text>
                  <Text style={{color: GOLD, fontSize: 24}}>✏</Text>
                </TouchableOpacity>

                <View
                  style={{
                    width: "70%",
                    marginTop: SPACING.sm,
                    gap: 4,
                  }}
                >
                  <View style={{flexDirection: "row", alignItems: "center", gap: 6}}>
                    <Text style={{color: GOLD, fontSize: 24}}>★</Text>
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

            <View
              testID="profile-modal-body"
              style={{
                flex: 1,
                backgroundColor: CREAM,
                overflow: "hidden",
                position: "relative",
              }}
            >
              <ScrollView
                testID="profile-modal-body-scroll"
                style={{flex: 1}}
                contentContainerStyle={{
                  paddingHorizontal: SPACING.lg,
                  paddingTop: SPACING.xl,
                  paddingBottom: SPACING.lg,
                }}
                showsVerticalScrollIndicator={false}
                alwaysBounceVertical={true}
                bounces={true}
              >
                {!hasProfileData ? (
                  <View
                    style={{
                      backgroundColor: "#F5EDD4",
                      borderRadius: 16,
                      padding: SPACING.md,
                      marginBottom: SPACING.lg,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: TYPOGRAPHY.fontSecondary,
                        fontSize: TYPOGRAPHY.fontSize.base,
                        color: "#1A1A1A",
                        lineHeight: 22,
                      }}
                    >
                      {AppStrings.Profile.LOADING_MESSAGE}
                    </Text>
                  </View>
                ) : null}
                {hasProfileData && isGuestMode ? (
                  <View
                    style={{
                      backgroundColor: "#F5EDD4",
                      borderRadius: 16,
                      padding: SPACING.md,
                      marginBottom: SPACING.lg,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: TYPOGRAPHY.fontPrimary,
                        fontSize: TYPOGRAPHY.fontSize.lg,
                        color: "#1A1A1A",
                        marginBottom: SPACING.sm,
                      }}
                    >
                      {AppStrings.Profile.GUEST_MODE_TITLE}
                    </Text>
                    <Text
                      style={{
                        fontFamily: TYPOGRAPHY.fontSecondary,
                        fontSize: TYPOGRAPHY.fontSize.base,
                        color: "#1A1A1A",
                        lineHeight: 20,
                        marginBottom: SPACING.md,
                      }}
                    >
                      {AppStrings.Profile.GUEST_MODE_DESCRIPTION}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setIsUpgradeModalVisible(true)}
                      style={{
                        backgroundColor: COLORS.figmaGold,
                        paddingVertical: SPACING.sm,
                        borderRadius: 12,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: TYPOGRAPHY.fontSecondaryBold,
                          fontSize: TYPOGRAPHY.fontSize.lg,
                          color: "#1A1A1A",
                        }}
                      >
                        {AppStrings.Profile.UPGRADE_ACCOUNT_BUTTON}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                <SectionHeader
                  title={AppStrings.Profile.DAILY_PUZZLES_COMPLETED_HEADER}
                  tooltipId="profileDailyPuzzles"
                  onPressHelp={showProfileTooltip}
                  testID="profile-help-daily-puzzles"
                />
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
                      width: AVATAR_SIZE_LARGE * 0.55,
                      height: AVATAR_SIZE_LARGE * 0.55,
                      backgroundColor: COLORS.figmaGold,
                      borderRadius: 100,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{fontSize: 24}}>🏅</Text>
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

                <SectionHeader
                  title={AppStrings.Profile.BEST_STRIKE_HEADER}
                  tooltipId="profileStats"
                  onPressHelp={showProfileTooltip}
                  testID="profile-help-stats"
                />
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: SPACING.sm,
                    marginBottom: SPACING.lg,
                  }}
                >
                  <StatBox value={stats?.bestStreak ?? 0} label={AppStrings.StatsModal.BEST_STREAK} />
                  <StatBox value={stats?.totalWordsGuessed ?? 0} label={AppStrings.StatsModal.TOTAL_WORDS_GUESSED} />
                  <StatBox value={`${winRate}%`} label={AppStrings.StatsModal.WIN_RATE} />
                  <StatBox value={avgGuess} label={AppStrings.Profile.AVG_GUESS_LABEL} />
                </View>

                <View style={{marginBottom: SPACING.lg}}>
                  <SectionHeader
                    title={AppStrings.Profile.TREASURE_CHEST_TITLE}
                    tooltipId="profileCoins"
                    onPressHelp={showProfileTooltip}
                    testID="profile-help-coins"
                  />
                  <TreasureChest coins={resolvedPlayerData?.coins ?? 0} />
                </View>

                <View style={{height: SPACING.sm}} />

                <TouchableOpacity
                  disabled={!hasProfileData}
                  onPress={() => {
                    if (!resolvedPlayerData) return;
                    modal.openGameModal("achievements", {
                      playerData: resolvedPlayerData,
                    });
                  }}
                  style={[actionButtonStyle, !hasProfileData ? actionButtonDisabledStyle : null]}
                >
                  <View style={actionButtonContentStyle}>
                    <Text style={actionButtonTextStyle}>{AppStrings.Achievements.MODAL_TITLE}</Text>
                    <ProfileHelpButton
                      tooltipId="profileAchievements"
                      onPress={showProfileTooltip}
                      testID="profile-help-achievements"
                    />
                  </View>
                </TouchableOpacity>

                <View style={{height: SPACING.sm}} />

                <TouchableOpacity
                  disabled={!hasProfileData}
                  onPress={() => {
                    if (!resolvedPlayerData) return;
                    modal.openGameModal("stats", {
                      playerData: resolvedPlayerData,
                    });
                  }}
                  style={[actionButtonStyle, !hasProfileData ? actionButtonDisabledStyle : null]}
                >
                  <View style={actionButtonContentStyle}>
                    <Text style={actionButtonTextStyle}>{AppStrings.StatsModal.TITLE}</Text>
                    <ProfileHelpButton
                      tooltipId="profileStatistics"
                      onPress={showProfileTooltip}
                      testID="profile-help-statistics"
                    />
                  </View>
                </TouchableOpacity>

                <View style={{height: SPACING.sm}} />

                <TouchableOpacity
                  disabled={!hasProfileData}
                  onPress={() => {
                    if (!resolvedPlayerData) return;
                    modal.openGameModal("leaderboard", {
                      currentUserId: firebaseUser?.uid ?? resolvedPlayerData.userId,
                    });
                  }}
                  style={[actionButtonStyle, !hasProfileData ? actionButtonDisabledStyle : null]}
                >
                  <View style={actionButtonContentStyle}>
                    <Text style={actionButtonTextStyle}>{AppStrings.Leaderboard.TITLE}</Text>
                    <ProfileHelpButton
                      tooltipId="profileLeaderboard"
                      onPress={showProfileTooltip}
                      testID="profile-help-leaderboard"
                    />
                  </View>
                </TouchableOpacity>

                <View style={{height: SPACING.md}} />

                <TouchableOpacity
                  disabled={!hasProfileData || isDeletingAccount}
                  onPress={() => setIsDeleteConfirmVisible(true)}
                  testID="delete-account-button"
                  style={[
                    deleteAccountButtonStyle,
                    !hasProfileData || isDeletingAccount ? actionButtonDisabledStyle : null,
                  ]}
                >
                  <Text style={deleteAccountButtonTextStyle}>{AppStrings.Profile.DELETE_ACCOUNT_BUTTON}</Text>
                </TouchableOpacity>

                <View style={{height: SPACING.xl, marginBottom: verticalScale(24)}} />
              </ScrollView>
            </View>
          </View>
        </SlideInModalContent>
      </View>

      <UpdateUsernameModal
        isVisible={isUsernameModalVisible}
        onClose={() => setIsUsernameModalVisible(false)}
        currentUsername={resolvedPlayerData?.username || ""}
      />

      {isGuestMode ? (
        <UpgradeAccountModal
          isVisible={isGuestMode && isUpgradeModalVisible}
          onClose={() => setIsUpgradeModalVisible(false)}
        />
      ) : null}

      <DeleteAccountConfirmationModal
        isVisible={isDeleteConfirmVisible}
        isDeleting={isDeletingAccount}
        onCancel={() => setIsDeleteConfirmVisible(false)}
        onConfirm={handleDeleteAccount}
      />

      <PulsingSpinner visible={isUploading} size={LOADING_SPINNER_SIZE} opacity={LOADING_SPINNER_OPACITY} />
    </Modal>
  );
};

const actionButtonStyle = {
  backgroundColor: "#FEC880",
  borderRadius: 14,
  paddingVertical: 14,
  alignItems: "center" as const,
};

const actionButtonContentStyle = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  gap: 8,
};

const actionButtonDisabledStyle = {
  opacity: 0.55,
};

const actionButtonTextStyle = {
  fontFamily: TYPOGRAPHY.fontPrimary,
  fontSize: TYPOGRAPHY.fontSize.base,
  color: "#1A1A1A",
};

const deleteAccountButtonStyle = {
  backgroundColor: "#C93535",
  borderRadius: 14,
  paddingVertical: 14,
  alignItems: "center" as const,
};

const deleteAccountButtonTextStyle = {
  fontFamily: TYPOGRAPHY.fontPrimary,
  fontSize: TYPOGRAPHY.fontSize.base,
  color: "#FFFFFF",
};

const ProfileHelpButton = ({
  tooltipId,
  onPress,
  inverse = false,
  testID,
}: {
  tooltipId: TooltipId;
  onPress: (id: TooltipId, targetRef: React.RefObject<View | null>) => void;
  inverse?: boolean;
  testID: string;
}) => {
  const ref = useRef<View>(null);

  return (
    <TouchableOpacity
      ref={ref}
      onPress={(event) => {
        event?.stopPropagation?.();
        onPress(tooltipId, ref);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${AppStrings.Tooltips.HELP_BUTTON_LABEL}: ${getProfileTooltipContent(tooltipId).title}`}
      testID={testID}
      style={{
        width: moderateScale(26),
        height: moderateScale(26),
        borderRadius: moderateScale(13),
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: inverse ? "rgba(255,255,255,0.18)" : "#FFFFFF",
        borderWidth: 1,
        borderColor: inverse ? "#FFFFFF" : "#E4D8B8",
      }}
    >
      <Text
        style={{
          fontFamily: TYPOGRAPHY.fontSecondaryBold,
          fontSize: TYPOGRAPHY.fontSize.base,
          color: inverse ? "#FFFFFF" : "#401F40",
        }}
      >
        ?
      </Text>
    </TouchableOpacity>
  );
};

const SectionHeader = ({
  title,
  tooltipId,
  onPressHelp,
  testID,
}: {
  title: string;
  tooltipId: TooltipId;
  onPressHelp: (id: TooltipId, targetRef: React.RefObject<View | null>) => void;
  testID: string;
}) => (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: SPACING.md,
      gap: SPACING.sm,
    }}
  >
    <Text
      style={{
        fontFamily: TYPOGRAPHY.fontPrimary,
        fontSize: TYPOGRAPHY.fontSize.lg,
        color: "#1A1A1A",
        flex: 1,
      }}
    >
      {title}
    </Text>
    <ProfileHelpButton tooltipId={tooltipId} onPress={onPressHelp} testID={testID} />
  </View>
);

const StatBox = ({value, label}: {value: number | string; label: string}) => (
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
