/**
 * @fileoverview Achievements modal — lists all achievements with locked/unlocked state and progress.
 *
 * Receives playerData (including unlockedAchievements, stats, progress) and renders
 * ACHIEVEMENT_DEFINITIONS with visual state (unlocked vs locked), progress when applicable,
 * and accessibility labels. Entry points: FullProfileDetailsModal ("Achievements" button)
 * and Settings ("View Achievements" when playerData is provided).
 */
import React from "react";
import {View, Text, Modal, ScrollView} from "react-native";
import {Player} from "../../../validation/firestoreSchemas";
import CloseButton from "../../buttons/CloseButton";
import {TYPOGRAPHY, COLORS, SPACING} from "../../../styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import {
  MODAL_WIDTH,
  MODAL_HEIGHT,
  CLOSE_BUTTON_SIZE,
  MODAL_CLOSE_BUTTON_POSITION,
  CARD_BORDER_RADIUS,
  ACHIEVEMENT_ICON_SIZE,
  MODAL_CONTENT_PADDING,
  MODAL_SCROLLABLE_MAX_HEIGHT,
} from "../../../constants/layout";
import {scale, verticalScale} from "../../../utils/responsive";
import {ACHIEVEMENT_DEFINITIONS} from "../../../constants/achievements";
import {AppStrings} from "../../../constants/AppStrings";
import SlideInModalContent from "../../shared/SlideInModalContent";

export interface AchievementsModalProps {
  isVisible: boolean;
  onClose: () => void;
  playerData: Player | null;
}

const unlockedSet = (playerData: Player | null): Set<string> => {
  if (!playerData?.unlockedAchievements) return new Set();
  return new Set(playerData.unlockedAchievements.map((e) => e.achievementId));
};

const AchievementsModal: React.FC<AchievementsModalProps> = ({isVisible, onClose, playerData}) => {
  const unlocked = unlockedSet(playerData);
  const stats = playerData?.stats;
  const progress = playerData?.progress;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      accessibilityLabel={AppStrings.Achievements.MODAL_TITLE}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <SlideInModalContent isVisible={isVisible}>
          <View
            style={{
              width: MODAL_WIDTH,
              height: MODAL_HEIGHT,
              alignItems: "center",
              justifyContent: "flex-start",
              overflow: "hidden",
            }}
          >
            <ModalBg width={MODAL_WIDTH} height={MODAL_HEIGHT} style={{position: "absolute"}} />
            {/* Decorative wave — clipped to card bounds */}
            <HomeBg
              width={MODAL_WIDTH * 1.1}
              height={MODAL_HEIGHT * 1.1}
              style={{position: "absolute", top: -MODAL_HEIGHT * 0.05, left: -MODAL_WIDTH * 0.05}}
            />
            <CloseButton
              onPress={onClose}
              size={CLOSE_BUTTON_SIZE}
              style={{...MODAL_CLOSE_BUTTON_POSITION, marginTop: verticalScale(14)}}
            />
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
              {AppStrings.Achievements.MODAL_TITLE}
            </Text>
            <ScrollView
              style={{maxHeight: MODAL_SCROLLABLE_MAX_HEIGHT, width: "100%"}}
              contentContainerStyle={{
                paddingHorizontal: MODAL_CONTENT_PADDING,
                paddingTop: SPACING.xs,
                paddingBottom: SPACING.lg,
              }}
              showsVerticalScrollIndicator={false}
            >
              {ACHIEVEMENT_DEFINITIONS.map((def) => {
                const isUnlocked = unlocked.has(def.id);
                const current = def.getProgress({
                  stats,
                  progress,
                  coins: playerData?.coins,
                  hasPurchasedApp: playerData?.hasPurchasedApp,
                });
                const progressPct = isUnlocked ? 1 : Math.min(current / def.threshold, 1);
                const progressLabel =
                  def.threshold > 1 && !isUnlocked ? `${Math.min(current, def.threshold)} / ${def.threshold}` : null;

                return (
                  <View
                    key={def.id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: SPACING.sm,
                      paddingVertical: SPACING.sm,
                      paddingHorizontal: SPACING.md,
                      backgroundColor: isUnlocked ? "rgba(16, 185, 129, 0.2)" : "rgba(255,255,255,0.1)",
                      borderRadius: CARD_BORDER_RADIUS,
                    }}
                    accessibilityLabel={`${def.name}, ${isUnlocked ? "unlocked" : "locked"}${progressLabel ? `, ${progressLabel}` : ""}`}
                    accessibilityState={{selected: isUnlocked}}
                  >
                    <View
                      style={{
                        width: ACHIEVEMENT_ICON_SIZE,
                        height: ACHIEVEMENT_ICON_SIZE,
                        borderRadius: ACHIEVEMENT_ICON_SIZE / 2,
                        backgroundColor: isUnlocked ? "rgba(16, 185, 129, 0.25)" : "rgba(255,255,255,0.08)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{fontSize: scale(18)}}>{isUnlocked ? def.icon : "🔒"}</Text>
                    </View>
                    <View style={{flex: 1, marginLeft: SPACING.md}}>
                      <Text
                        style={{
                          fontSize: TYPOGRAPHY.fontSize.base,
                          fontFamily: TYPOGRAPHY.fontSecondaryBold,
                          color: "black",
                        }}
                      >
                        {def.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: TYPOGRAPHY.fontSize.xs,
                          fontFamily: TYPOGRAPHY.fontSecondary,
                          color: "rgba(0,0,0,0.7)",
                          marginTop: scale(2),
                        }}
                      >
                        {def.description}
                      </Text>
                      {/* Progress bar */}
                      <View
                        style={{
                          height: 4,
                          backgroundColor: "rgba(0,0,0,0.1)",
                          borderRadius: 2,
                          marginTop: scale(6),
                          overflow: "hidden",
                        }}
                      >
                        <View
                          style={{
                            height: "100%",
                            width: `${progressPct * 100}%`,
                            backgroundColor: isUnlocked ? COLORS.success : COLORS.primaryOrange,
                            borderRadius: 2,
                          }}
                        />
                      </View>
                      {progressLabel && (
                        <Text
                          style={{
                            fontSize: TYPOGRAPHY.fontSize.xs,
                            fontFamily: TYPOGRAPHY.fontSecondary,
                            color: isUnlocked ? COLORS.success : "rgba(0,0,0,0.5)",
                            marginTop: scale(2),
                          }}
                        >
                          {progressLabel}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

export default AchievementsModal;
