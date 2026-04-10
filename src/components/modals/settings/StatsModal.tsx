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
import { MODAL_WIDTH, MODAL_HEIGHT, CLOSE_BUTTON_SIZE, MODAL_CLOSE_BUTTON_POSITION, CARD_BORDER_RADIUS, MODAL_CONTENT_PADDING, MODAL_SCROLLABLE_MAX_HEIGHT } from "../../../constants/layout";

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
      accessibilityLabel="Statistics"
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
            maxHeight: "80%",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ModalBg width={MODAL_WIDTH} height={MODAL_HEIGHT} style={{ position: "absolute" }} />
          <CloseButton
            onPress={onClose}
            size={CLOSE_BUTTON_SIZE}
            style={MODAL_CLOSE_BUTTON_POSITION}
            accessibilityLabel="Close statistics"
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
            Statistics
          </Text>
          <ScrollView
            style={{ maxHeight: MODAL_SCROLLABLE_MAX_HEIGHT, width: "100%" }}
            contentContainerStyle={{ padding: MODAL_CONTENT_PADDING, paddingTop: SPACING.sm, paddingBottom: SPACING.lg }}
            showsVerticalScrollIndicator={false}
          >
            <SectionHeader label="Gameplay" />
            <StatRow label="Games Played" value={stats?.gamesPlayed ?? 0} />
            <StatRow label="Daily Puzzles" value={stats?.dailyPuzzlesCompleted ?? 0} />
            <StatRow label="Highest Classic Level" value={stats?.highestLevelClassic ?? 0} />

            <SectionHeader label="Wins & Streaks" />
            <StatRow label="Total Wins" value={stats?.totalWins ?? 0} />
            <StatRow label="Win Rate" value={winRate} unit="%" />
            <StatRow label="Best Streak" value={stats?.bestStreak ?? 0} />
            <StatRow label="Current Streak" value={stats?.winStreak ?? 0} />
            <StatRow label="Challenge Wins" value={stats?.challengeWins ?? 0} />

            <SectionHeader label="Performance" />
            <StatRow label="Avg Guesses (wins)" value={avgGuesses} />
            <StatRow label="Total Words Guessed" value={stats?.totalWordsGuessed ?? 0} />
            <StatRow label="Total Score" value={stats?.totalScore ?? 0} />
            <StatRow label="Hints Used" value={stats?.totalHintsUsed ?? 0} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const SectionHeader = ({ label }: { label: string }) => (
  <Text
    style={{
      fontSize: TYPOGRAPHY.fontSize.xs,
      fontFamily: TYPOGRAPHY.fontSecondaryBold,
      color: "rgba(0,0,0,0.5)",
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

