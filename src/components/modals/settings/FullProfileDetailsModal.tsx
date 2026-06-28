import React, {useCallback, useEffect, useRef, useState} from "react";
import {View, Text, TouchableOpacity, Modal, ScrollView, Image, Alert, type LayoutChangeEvent} from "react-native";
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
  CLOSE_BUTTON_SIZE, AVATAR_SIZE_LARGE, AUTH_CONTENT_MAX_WIDTH, MODAL_MAX_HEIGHT, } from "../../../constants/layout";
import {moderateScale, verticalScale} from "../../../utils/responsive";
import LogoIcon from "../../icons/LogoIcon";
import TreasureChest from "./TreasureChest";
import {getXpLevel} from "../../../constants/game";
import {isGuestPlayer} from "@/features/auth/sessionBootstrap";
import {t} from "../../../i18n";
import {useAuthSession, usePlayer} from "@/contexts/AuthContext";
import PulsingSpinner from "@/components/loading/PulsingSpinner";
import UpgradeAccountModal from "./UpgradeAccountModal";
import {LOADING_SPINNER_OPACITY, LOADING_SPINNER_SIZE} from "@/constants/loading";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {TooltipProvider, useTooltip} from "../../../contexts/TooltipContext";
import type {TooltipId, TooltipSequenceRequest} from "../../tooltips/types";
import DeleteAccountConfirmationModal from "./DeleteAccountConfirmationModal";
import {getCallableFunction} from "../../../utils/firebaseFunctions";
import {getNextRankForLevel, getRankForLevel} from "../../../constants/ranks";
import RankBadge from "../../progression/RankBadge";

interface FullProfileDetailsModalProps {
  isVisible: boolean;
  onClose: () => void;
  playerData: Player | null;
}

const PURPLE = "#401F40";
const CREAM = "#FCFAF4";
const GOLD = "#FEC880";
const PROFILE_TOOLTIP_SCROLL_TOP_PADDING = 24;
const PROFILE_STATISTICS_SCROLL_TOP_PADDING = 200;
const PROFILE_TOOLTIP_SCROLL_SETTLE_MS = 260;
const PROFILE_TOOLTIP_SEQUENCE_ID = "profileTour";
const PROFILE_BODY_TOOLTIP_IDS = new Set<TooltipId>([
  "profileDailyPuzzles",
  "profileStats",
  "profileCoins",
  "profileAchievements",
  "profileStatistics",
  "profileLeaderboard",
]);

const getProfileTooltipContent = (id: TooltipId) => {
  switch (id) {
    case "profileProgression":
      return {
        title: t("Tooltips.PROFILE_PROGRESSION_TITLE"),
        body: t("Tooltips.PROFILE_PROGRESSION_BODY"),
        action: t("Tooltips.GOT_IT_BUTTON"),
      };
    case "profileIdentity":
      return {
        title: t("Tooltips.PROFILE_IDENTITY_TITLE"),
        body: t("Tooltips.PROFILE_IDENTITY_BODY"),
        action: t("Tooltips.GOT_IT_BUTTON"),
      };
    case "profileDailyPuzzles":
      return {
        title: t("Tooltips.PROFILE_DAILY_PUZZLES_TITLE"),
        body: t("Tooltips.PROFILE_DAILY_PUZZLES_BODY"),
        action: t("Tooltips.GOT_IT_BUTTON"),
      };
    case "profileStats":
      return {
        title: t("Tooltips.PROFILE_STATS_TITLE"),
        body: t("Tooltips.PROFILE_STATS_BODY"),
        action: t("Tooltips.GOT_IT_BUTTON"),
      };
    case "profileCoins":
      return {
        title: t("Tooltips.PROFILE_COINS_TITLE"),
        body: t("Tooltips.PROFILE_COINS_BODY"),
        action: t("Tooltips.GOT_IT_BUTTON"),
      };
    case "profileAchievements":
      return {
        title: t("Tooltips.PROFILE_ACHIEVEMENTS_TITLE"),
        body: t("Tooltips.PROFILE_ACHIEVEMENTS_BODY"),
        action: t("Tooltips.GOT_IT_BUTTON"),
      };
    case "profileStatistics":
      return {
        title: t("Tooltips.PROFILE_STATISTICS_TITLE"),
        body: t("Tooltips.PROFILE_STATISTICS_BODY"),
        action: t("Tooltips.GOT_IT_BUTTON"),
      };
    case "profileLeaderboard":
      return {
        title: t("Tooltips.PROFILE_LEADERBOARD_TITLE"),
        body: t("Tooltips.PROFILE_LEADERBOARD_BODY"),
        action: t("Tooltips.GOT_IT_BUTTON"),
      };
    default:
      return {
        title: t("CommonAlerts.INFO_TITLE"),
        body: "",
        action: t("Tooltips.GOT_IT_BUTTON"),
      };
  }
};

const FullProfileDetailsModalContent: React.FC<FullProfileDetailsModalProps> = ({isVisible, onClose, playerData}) => {
  const modal = useModal();
  const {cancelTooltipSequence, showTooltipSequence} = useTooltip();
  const {logout} = useAuthSession();
  const {updatePlayerData, playerData: authPlayerData} = usePlayer();
  const resolvedPlayerData = authPlayerData ?? playerData;
  const firebaseUser = getAuth(getApp()).currentUser;
  const isGuestMode = firebaseUser ? firebaseUser.isAnonymous : isGuestPlayer(resolvedPlayerData);
  const [isUsernameModalVisible, setIsUsernameModalVisible] = useState(false);
  const [isUpgradeModalVisible, setIsUpgradeModalVisible] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleteConfirmVisible, setIsDeleteConfirmVisible] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const hasStartedTooltipSequenceRef = useRef(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const profileBodyOffsetRef = useRef(0);
  const tooltipAnchorOffsetsRef = useRef<Partial<Record<TooltipId, number>>>({});
  const profileIdentityRef = useRef<View>(null);
  const profileProgressionRef = useRef<View>(null);
  const dailyPuzzlesRef = useRef<View>(null);
  const profileStatsRef = useRef<View>(null);
  const profileCoinsRef = useRef<View>(null);
  const profileAchievementsRef = useRef<View>(null);
  const profileStatisticsRef = useRef<View>(null);
  const profileLeaderboardRef = useRef<View>(null);
  const avatarUrl = resolvedPlayerData?.avatarUrl ?? null;
  const profileTooltipUserId = resolvedPlayerData?.userId ?? firebaseUser?.uid ?? null;

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
      Alert.alert(t("CommonAlerts.ERROR_TITLE"), t("Profile.ALERT_AVATAR_UPDATE_ERROR"));
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
        title: t("Profile.DELETE_ACCOUNT_ERROR_TITLE"),
        message: t("Profile.DELETE_ACCOUNT_ERROR_MESSAGE"),
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
  const currentRank = getRankForLevel(level);
  const nextRank = getNextRankForLevel(level);
  const xpProgressWidth = `${Math.round(progressPct * 100)}%` as `${number}%`;

  const setTooltipAnchorOffset = useCallback(
    (id: TooltipId) => (event: LayoutChangeEvent) => {
      tooltipAnchorOffsetsRef.current[id] = event.nativeEvent.layout.y;
    },
    [],
  );

  const setProfileBodyOffset = useCallback((event: LayoutChangeEvent) => {
    profileBodyOffsetRef.current = event.nativeEvent.layout.y;
  }, []);

  const scrollToTooltipAnchor = useCallback((id: TooltipId): Promise<void> => {
    const anchorY = tooltipAnchorOffsetsRef.current[id] ?? 0;
    const y = PROFILE_BODY_TOOLTIP_IDS.has(id) ? profileBodyOffsetRef.current + anchorY : anchorY;
    const topPadding =
      id === "profileStatistics" ? PROFILE_STATISTICS_SCROLL_TOP_PADDING : PROFILE_TOOLTIP_SCROLL_TOP_PADDING;
    scrollViewRef.current?.scrollTo({
      y: Math.max(0, y - topPadding),
      animated: true,
    });
    return new Promise((resolve) => {
      setTimeout(resolve, PROFILE_TOOLTIP_SCROLL_SETTLE_MS);
    });
  }, []);

  useEffect(() => {
    if (!isVisible) {
      hasStartedTooltipSequenceRef.current = false;
      return;
    }

    if (!hasProfileData || hasStartedTooltipSequenceRef.current) {
      return;
    }

    hasStartedTooltipSequenceRef.current = true;
    const createProfileTooltipHighlight = (id: TooltipId): React.ReactNode => {
      switch (id) {
        case "profileIdentity":
          return (
            <View style={{alignItems: "center", width: "100%"}}>
              {avatarUrl ? (
                <Image
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
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: TYPOGRAPHY.fontSize.lg,
                  fontFamily: TYPOGRAPHY.fontSecondaryBold,
                  marginTop: SPACING.sm,
                }}
              >
                {resolvedPlayerData?.username || t("Profile.GUEST_USERNAME")}
              </Text>
            </View>
          );
        case "profileAchievements":
          return <ProfileActionHighlight label={t("Achievements.MODAL_TITLE")} />;
        case "profileStatistics":
          return <ProfileActionHighlight label={t("StatsModal.TITLE")} />;
        case "profileLeaderboard":
          return <ProfileActionHighlight label={t("Leaderboard.TITLE")} />;
        case "profileDailyPuzzles":
          return <ProfileDailyPuzzlesHighlight dailyPuzzlesCompleted={stats?.dailyPuzzlesCompleted ?? 0} />;
        case "profileStats":
          return (
            <ProfileStatsSnapshotHighlight
              bestStreak={stats?.bestStreak ?? 0}
              totalWordsGuessed={stats?.totalWordsGuessed ?? 0}
              winRate={`${winRate}%`}
              averageGuesses={avgGuess}
            />
          );
        default:
          return null;
      }
    };

    const createProfileTooltipRequest = (
      id: TooltipId,
      targetRef: React.RefObject<View | null>,
    ): TooltipSequenceRequest => ({
      id,
      userId: profileTooltipUserId,
      targetRef,
      highlightElement:
        id === "profileProgression" || id === "profileCoins" ? undefined : createProfileTooltipHighlight(id),
      content: getProfileTooltipContent(id),
      preferredPlacement:
        id === "profileDailyPuzzles" || id === "profileStats" || id === "profileCoins"
          ? "below"
          : id === "profileProgression" || id === "profileStatistics"
            ? "above"
            : "auto",
      useNativeModal: false,
      showBackdrop: true,
      onBeforeShow: () => scrollToTooltipAnchor(id),
    });

    const tooltipSequence: TooltipSequenceRequest[] = [
      createProfileTooltipRequest("profileIdentity", profileIdentityRef),
      createProfileTooltipRequest("profileProgression", profileProgressionRef),
      createProfileTooltipRequest("profileDailyPuzzles", dailyPuzzlesRef),
      createProfileTooltipRequest("profileStats", profileStatsRef),
      createProfileTooltipRequest("profileCoins", profileCoinsRef),
      createProfileTooltipRequest("profileAchievements", profileAchievementsRef),
      createProfileTooltipRequest("profileStatistics", profileStatisticsRef),
      createProfileTooltipRequest("profileLeaderboard", profileLeaderboardRef),
    ];

    const startSequenceTimer = setTimeout(() => {
      void showTooltipSequence(tooltipSequence, {
        sequenceId: PROFILE_TOOLTIP_SEQUENCE_ID,
        userId: profileTooltipUserId,
      });
    }, 450);

    return () => {
      clearTimeout(startSequenceTimer);
      cancelTooltipSequence();
    };
  }, [
    avatarRadius,
    avatarUrl,
    cancelTooltipSequence,
    hasProfileData,
    initial,
    isVisible,
    resolvedPlayerData?.username,
    profileTooltipUserId,
    scrollToTooltipAnchor,
    showTooltipSequence,
    avgGuess,
    stats?.bestStreak,
    stats?.dailyPuzzlesCompleted,
    stats?.totalWordsGuessed,
    winRate,
  ]);

  return (
    <>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
        testID="profile-modal-shell"
      >
        <SlideInModalContent
          isVisible={isVisible}
          style={{width: "100%", alignItems: "center"}}
        >
          <View
            style={{
              width: "100%",
              maxWidth: AUTH_CONTENT_MAX_WIDTH,
              height: MODAL_MAX_HEIGHT,
              maxHeight: MODAL_MAX_HEIGHT,
              backgroundColor: CREAM,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: "hidden",
              flexDirection: "column",
            }}
          >
            <ScrollView
              ref={scrollViewRef}
              testID="profile-modal-body-scroll"
              style={{flex: 1, backgroundColor: CREAM}}
              contentContainerStyle={{
                flexGrow: 1,
                paddingTop: 0,
                paddingBottom: SPACING.lg,
              }}
              showsVerticalScrollIndicator={false}
              alwaysBounceVertical={true}
              bounces={true}
            >
              <View
                style={{
                  backgroundColor: PURPLE,
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  paddingBottom: SPACING.xl,
                  overflow: "hidden",
                  position: "relative",
                  flexShrink: 0,
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
                  {t("Profile.PROFILE_HEADER")}
                </Text>
                <View style={{flexDirection: "row", alignItems: "center", gap: 8}}>
                  <CloseButton onPress={onClose} size={CLOSE_BUTTON_SIZE} color="white" />
                </View>
              </View>

              <View
                ref={profileIdentityRef}
                onLayout={setTooltipAnchorOffset("profileIdentity")}
                style={{alignItems: "center", marginTop: SPACING.sm}}
              >
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
                  accessibilityLabel={t("Profile.UPDATE_USERNAME_TITLE")}
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
                    {resolvedPlayerData?.username || t("Profile.GUEST_USERNAME")}
                  </Text>
                  <Text style={{color: GOLD, fontSize: 24}}>✏</Text>
                </TouchableOpacity>

                <View
                  ref={profileProgressionRef}
                  onLayout={setTooltipAnchorOffset("profileProgression")}
                  testID="profile-progression-section"
                  style={{marginTop: SPACING.md, alignItems: "center", alignSelf: "center", width: "100%"}}
                >
                  <View
                    testID="profile-progression-row"
                    style={{
                      width: "86%",
                      maxWidth: 340,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: SPACING.md,
                    }}
                  >
                    <View testID="profile-rank-cluster" style={{width: 84, flexShrink: 0, alignItems: "center"}}>
                      <RankBadge
                        rank={currentRank}
                        size={64}
                        onPress={() => modal.openGameModal("ranks", {currentLevel: level})}
                        testID="profile-rank-button"
                      />
                      <Text
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        style={{
                          width: "100%",
                          color: COLORS.white,
                          fontSize: TYPOGRAPHY.fontSize.sm,
                          fontFamily: TYPOGRAPHY.fontSecondaryBold,
                          textAlign: "center",
                          marginTop: 6,
                        }}
                      >
                        {t(currentRank.nameKey)}
                      </Text>
                    </View>

                    <View
                      testID="profile-xp-content"
                      style={{
                        flex: 1,
                        maxWidth: 230,
                        minWidth: 0,
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
                          {t("Profile.XP_LEVEL_PREFIX")}
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

                  <Text
                    style={{
                      width: "86%",
                      maxWidth: 340,
                      color: "rgba(255,255,255,0.78)",
                      fontSize: TYPOGRAPHY.fontSize.xs,
                      fontFamily: TYPOGRAPHY.fontSecondary,
                      textAlign: "center",
                      marginTop: SPACING.sm,
                    }}
                  >
                    {nextRank
                      ? `${t("Ranks.NEXT_RANK_PREFIX")} ${t(nextRank.nameKey)} ${t("Ranks.AT_LEVEL_PREFIX")} ${
                          nextRank.minimumLevel
                        }`
                      : t("Ranks.HIGHEST_RANK")}
                  </Text>
                </View>
              </View>
              </View>

              {/* Body content follows inside same ScrollView so header scrolls with content */}
              <View
                testID="profile-modal-body"
                onLayout={setProfileBodyOffset}
                style={{
                  backgroundColor: CREAM,
                  position: "relative",
                  paddingHorizontal: SPACING.lg,
                }}
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
                      {t("Profile.LOADING_MESSAGE")}
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
                      {t("Profile.GUEST_MODE_TITLE")}
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
                      {t("Profile.GUEST_MODE_DESCRIPTION")}
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
                        {t("Profile.UPGRADE_ACCOUNT_BUTTON")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                <View
                  ref={dailyPuzzlesRef}
                  onLayout={setTooltipAnchorOffset("profileDailyPuzzles")}
                  testID="profile-daily-puzzles-section"
                  style={{marginBottom: SPACING.lg}}
                >
                  <SectionHeader
                    title={t("Profile.DAILY_PUZZLES_COMPLETED_HEADER")}
                  />
                  <View
                    style={{
                      backgroundColor: "#F5EDD4",
                      borderRadius: 16,
                      padding: SPACING.md,
                      flexDirection: "row",
                      alignItems: "center",
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
                      {t("Profile.REGULAR_DAYS_LABEL")}
                    </Text>
                  </View>
                </View>

                <View
                  ref={profileStatsRef}
                  onLayout={setTooltipAnchorOffset("profileStats")}
                  testID="profile-stats-snapshot-section"
                  style={{marginBottom: SPACING.lg}}
                >
                  <SectionHeader
                    title={t("Profile.BEST_STRIKE_HEADER")}
                  />
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: SPACING.sm,
                    }}
                  >
                    <StatBox value={stats?.bestStreak ?? 0} label={t("StatsModal.BEST_STREAK")} />
                    <StatBox value={stats?.totalWordsGuessed ?? 0} label={t("StatsModal.TOTAL_WORDS_GUESSED")} />
                    <StatBox value={`${winRate}%`} label={t("StatsModal.WIN_RATE")} />
                    <StatBox value={avgGuess} label={t("Profile.AVG_GUESS_LABEL")} />
                  </View>
                </View>

                <View
                  onLayout={setTooltipAnchorOffset("profileCoins")}
                  testID="profile-treasure-chest-section"
                  style={{marginBottom: SPACING.lg}}
                >
                  <SectionHeader
                    title={t("Profile.TREASURE_CHEST_TITLE")}
                  />
                  <TreasureChest
                    coins={resolvedPlayerData?.coins ?? 0}
                    cardRef={profileCoinsRef}
                    cardTestID="profile-treasure-chest-card"
                  />
                </View>

                <View style={{height: SPACING.sm}} />

                <View ref={profileAchievementsRef} onLayout={setTooltipAnchorOffset("profileAchievements")}>
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
                      <Text style={actionButtonTextStyle}>{t("Achievements.MODAL_TITLE")}</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                <View style={{height: SPACING.sm}} />

                <View
                  ref={profileStatisticsRef}
                  onLayout={setTooltipAnchorOffset("profileStatistics")}
                  testID="profile-statistics-button-section"
                >
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
                      <Text style={actionButtonTextStyle}>{t("StatsModal.TITLE")}</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                <View style={{height: SPACING.sm}} />

                <View
                  ref={profileLeaderboardRef}
                  onLayout={setTooltipAnchorOffset("profileLeaderboard")}
                  testID="profile-leaderboard-button-section"
                >
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
                      <Text style={actionButtonTextStyle}>{t("Leaderboard.TITLE")}</Text>
                    </View>
                  </TouchableOpacity>
                </View>

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
                  <Text style={deleteAccountButtonTextStyle}>{t("Profile.DELETE_ACCOUNT_BUTTON")}</Text>
                </TouchableOpacity>

                <View style={{height: SPACING.xl, marginBottom: verticalScale(24)}} />
              </View>
            </ScrollView>
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
    </>
  );
};

const FullProfileDetailsModal: React.FC<FullProfileDetailsModalProps> = (props) => (
  <Modal visible={props.isVisible} transparent={true} animationType="none" onRequestClose={props.onClose}>
    <TooltipProvider>
      <FullProfileDetailsModalContent {...props} />
    </TooltipProvider>
  </Modal>
);

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

const ProfileActionHighlight = ({label}: {label: string}) => (
  <View style={[actionButtonStyle, {width: "100%"}]}>
    <View style={actionButtonContentStyle}>
      <Text style={actionButtonTextStyle}>{label}</Text>
    </View>
  </View>
);

const ProfileSectionHeaderHighlight = ({title}: {title: string}) => (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: SPACING.md,
      gap: SPACING.sm,
      width: "100%",
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
  </View>
);

const ProfileDailyPuzzlesHighlight = ({dailyPuzzlesCompleted}: {dailyPuzzlesCompleted: number}) => (
  <View style={{width: "100%"}}>
    <ProfileSectionHeaderHighlight title={t("Profile.DAILY_PUZZLES_COMPLETED_HEADER")} />
    <View
      style={{
        backgroundColor: "#F5EDD4",
        borderRadius: 16,
        padding: SPACING.md,
        flexDirection: "row",
        alignItems: "center",
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
        {dailyPuzzlesCompleted}
      </Text>
      <Text
        style={{
          fontFamily: TYPOGRAPHY.fontSecondary,
          fontSize: TYPOGRAPHY.fontSize.sm,
          color: "#6B7280",
          textAlign: "right",
        }}
      >
        {t("Profile.REGULAR_DAYS_LABEL")}
      </Text>
    </View>
  </View>
);

const ProfileStatsSnapshotHighlightBox = ({value, label}: {value: number | string; label: string}) => (
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
        fontSize: TYPOGRAPHY.fontSize.sm,
        color: "#6B7280",
        textAlign: "center",
        marginTop: 4,
      }}
    >
      {label}
    </Text>
  </View>
);

const ProfileStatsSnapshotHighlight = ({
  bestStreak,
  totalWordsGuessed,
  winRate,
  averageGuesses,
}: {
  bestStreak: number;
  totalWordsGuessed: number;
  winRate: string;
  averageGuesses: number | string;
}) => (
  <View style={{width: "100%"}}>
    <ProfileSectionHeaderHighlight title={t("Profile.BEST_STRIKE_HEADER")} />
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: SPACING.sm,
      }}
    >
      <ProfileStatsSnapshotHighlightBox value={bestStreak} label={t("StatsModal.BEST_STREAK")} />
      <ProfileStatsSnapshotHighlightBox value={totalWordsGuessed} label={t("StatsModal.TOTAL_WORDS_GUESSED")} />
      <ProfileStatsSnapshotHighlightBox value={winRate} label={t("StatsModal.WIN_RATE")} />
      <ProfileStatsSnapshotHighlightBox value={averageGuesses} label={t("Profile.AVG_GUESS_LABEL")} />
    </View>
  </View>
);

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

const SectionHeader = ({
  title,
  targetRef,
  onLayout,
}: {
  title: string;
  targetRef?: React.RefObject<View | null>;
  onLayout?: (event: LayoutChangeEvent) => void;
}) => (
  <View
    ref={targetRef}
    onLayout={onLayout}
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
