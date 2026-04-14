/**
 * @fileoverview Statistics modal — displays all 14 player stats in grouped sections.
 *
 * Shows Gameplay, Wins & Streaks, and Performance stat groups.
 * Entry point: FullProfileDetailsModal ("Statistics" button).
 */
import React from "react";
import { View, Text, Modal, ScrollView } from "react-native";
import { Player } from "../../../validation/firestoreSchemas";
import CloseButton from "../../buttons/CloseButton";
import { TYPOGRAPHY, SPACING } from "../../../styles";
import ModalBg from "../../../../assets/images/modal-bg.svg";
import HomeBg from "../../../../assets/images/home-bg.svg";
import { MODAL_WIDTH, MODAL_HEIGHT, CLOSE_BUTTON_SIZE, CARD_BORDER_RADIUS, MODAL_CONTENT_PADDING, MODAL_SCROLLABLE_MAX_HEIGHT } from "../../../constants/layout";
import { AppStrings } from "../../../constants/AppStrings";
import SlideInModalContent from "../../shared/SlideInModalContent";

export interface StatsModalProps {
  isVisible: boolean;
  onClose: () => void;
  playerData: Player | null;
}

const StatsModal: React.FC<StatsModalProps> = ({
  isVisible,
  onClose,
  playerData,
}) => {
  const stats = playerData?.stats;

  const winRate = Math.round(stats?.winRate ?? 0);
  const avgGuesses =
    stats?.averageGuesses != null
      ? stats.averageGuesses.toFixed(1)
      : "0.0";

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityLabel={AppStrings.StatsModal.TITLE}
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
              maxHeight: "80%",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
          <ModalBg width={MODAL_WIDTH} height={MODAL_HEIGHT} style={{ position: "absolute" }} />
          {/* Decorative wave — clipped to card bounds */}
          <HomeBg
            width={MODAL_WIDTH * 1.1}
            height={MODAL_HEIGHT * 1.1}
            style={{ position: "absolute", top: -MODAL_HEIGHT * 0.05, left: -MODAL_WIDTH * 0.05 }}
          />
          <CloseButton
            onPress={onClose}
            size={CLOSE_BUTTON_SIZE}
            style={{
              position: "absolute",
              top: SPACING.sm,
              right: SPACING.lg,
              zIndex: 10,
            }}
            accessibilityLabel={AppStrings.Accessibility.CLOSE_STATISTICS}
          />
          <Text
            style={{
              fontSize: TYPOGRAPHY.fontSize["2xl"],
              fontFamily: TYPOGRAPHY.fontSecondaryBold,
              color: "black",
              marginTop: SPACING.lg,
              marginBottom: SPACING.md,
            }}
            accessibilityRole="header"
          >
            {AppStrings.StatsModal.TITLE}
          </Text>
          <ScrollView
            style={{ maxHeight: MODAL_SCROLLABLE_MAX_HEIGHT, width: "100%" }}
            contentContainerStyle={{ padding: MODAL_CONTENT_PADDING, paddingTop: SPACING.sm, paddingBottom: SPACING.lg }}
            showsVerticalScrollIndicator={false}
          >
            <SectionHeader label={AppStrings.StatsModal.GAMEPLAY_SECTION} />
            <StatRow label={AppStrings.StatsModal.GAMES_PLAYED} value={stats?.gamesPlayed ?? 0} />
            <StatRow label={AppStrings.StatsModal.DAILY_PUZZLES} value={stats?.dailyPuzzlesCompleted ?? 0} />
            <StatRow label={AppStrings.StatsModal.HIGHEST_CLASSIC_LEVEL} value={stats?.highestLevelClassic ?? 0} />
            <StatRow label={AppStrings.StatsModal.XP} value={stats?.xp ?? 0} />

            <SectionHeader label={AppStrings.StatsModal.WINS_STREAKS_SECTION} />
            <StatRow label={AppStrings.StatsModal.TOTAL_WINS} value={stats?.totalWins ?? 0} />
            <StatRow label={AppStrings.StatsModal.WIN_RATE} value={winRate} unit="%" />
            <StatRow label={AppStrings.StatsModal.BEST_STREAK} value={stats?.bestStreak ?? 0} />
            <StatRow label={AppStrings.StatsModal.CURRENT_STREAK} value={stats?.winStreak ?? 0} />
            <StatRow label={AppStrings.StatsModal.CHALLENGE_WINS} value={stats?.challengeWins ?? 0} />

            <SectionHeader label={AppStrings.StatsModal.PERFORMANCE_SECTION} />
            <StatRow label={AppStrings.StatsModal.AVG_GUESSES} value={avgGuesses} />
            <StatRow label={AppStrings.StatsModal.TOTAL_WORDS_GUESSED} value={stats?.totalWordsGuessed ?? 0} />
            <StatRow label={AppStrings.StatsModal.TOTAL_SCORE} value={stats?.totalScore ?? 0} />
            <StatRow label={AppStrings.StatsModal.HINTS_USED} value={stats?.totalHintsUsed ?? 0} />
          </ScrollView>
          </View>
        </SlideInModalContent>
      </View>
    </Modal>
  );
};

const SectionHeader = ({ label }: { label: string }) => (
  <Text
    style={{
      fontSize: TYPOGRAPHY.fontSize.lg,
      fontFamily: TYPOGRAPHY.fontSecondaryBold,
      color: "rgba(0,0,0,1)",
      textTransform: "uppercase",
      letterSpacing: TYPOGRAPHY.letterSpacing.caps,
      marginTop: SPACING.md,
      marginBottom: SPACING.sm,
    }}
    accessibilityRole="header"
  >
    {label}
  </Text>
);

const StatRow = ({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | string;
  unit?: string;
}) => (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.sm,
      marginBottom: SPACING.xs,
      backgroundColor: "rgba(255,255,255,0.1)",
      borderRadius: CARD_BORDER_RADIUS,
    }}
    accessibilityLabel={`${label}: ${value}${unit ?? ""}`}
  >
    <Text
      style={{
        fontSize: TYPOGRAPHY.fontSize.sm,
        fontFamily: TYPOGRAPHY.fontSecondary,
        color: "rgba(0,0,0,0.7)",
      }}
    >
      {label}
    </Text>
    <Text
      style={{
        fontSize: TYPOGRAPHY.fontSize.base,
        fontFamily: TYPOGRAPHY.fontSecondaryBold,
        color: "black",
      }}
    >
      {value.toString()}
      {unit}
    </Text>
  </View>
);

export default StatsModal;

