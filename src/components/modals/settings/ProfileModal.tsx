import React from "react";
import {
  View,
  Text,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { modalStyles } from "../../../styles/components/modals";
import { SPACING } from "../../../styles/tokens/spacing";
import { COLORS } from "../../../styles/tokens/colors";
import CloseButton from "../../buttons/CloseButton";
import { Player } from "../../../validation/firestoreSchemas";

interface ProfileModalProps {
  isVisible: boolean;
  onClose: () => void;
  playerData: Player | null;
  onFullProfilePress?: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({
  isVisible,
  onClose,
  playerData,
  onFullProfilePress,
}) => {
  if (!playerData) {
    return null;
  }

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={modalStyles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Profile</Text>
            <CloseButton onPress={onClose} style={modalStyles.closeButton} />
          </View>

          <ScrollView style={modalStyles.contentScrollable}>
            <View style={styles.body}>
              <Text style={styles.label}>Username</Text>
              <Text style={styles.value}>{playerData.username}</Text>

              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{playerData.email}</Text>

              <Text style={styles.label}>Coins</Text>
              <Text style={styles.value}>{playerData.coins}</Text>

              {/* Game Stats */}
              <Text style={styles.sectionTitle}>Game Statistics</Text>

              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {playerData.stats.gamesPlayed}
                  </Text>
                  <Text style={styles.statLabel}>Games Played</Text>
                </View>

                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{playerData.stats.wins}</Text>
                  <Text style={styles.statLabel}>Wins</Text>
                </View>

                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {Math.round(playerData.stats.winRate * 100)}%
                  </Text>
                  <Text style={styles.statLabel}>Win Rate</Text>
                </View>

                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {playerData.stats.bestStreak}
                  </Text>
                  <Text style={styles.statLabel}>Best Streak</Text>
                </View>
              </View>
            </View>
          </ScrollView>

          <View style={modalStyles.buttonContainerSingle}>
            {onFullProfilePress && (
              <TouchableOpacity
                style={[styles.button, styles.fullProfileButton]}
                onPress={onFullProfilePress}
              >
                <Text style={styles.buttonText}>Full Profile</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.button} onPress={onClose}>
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  body: {
    paddingVertical: SPACING.md,
  },
  button: {
    backgroundColor: COLORS.primaryOrange,
    borderRadius: 8,
    marginHorizontal: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "500",
  },
  container: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    flex: 1,
    justifyContent: "center",
  },
  fullProfileButton: {
    backgroundColor: COLORS.info,
    marginBottom: SPACING.sm,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: SPACING.sm,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: SPACING.md,
    marginTop: SPACING.lg,
  },
  statItem: {
    alignItems: "center",
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 8,
    marginBottom: SPACING.sm,
    padding: SPACING.sm,
    width: "48%",
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  statValue: {
    color: COLORS.primaryOrange,
    fontSize: 18,
    fontWeight: "bold",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: "bold",
  },
  value: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "500",
    marginBottom: SPACING.sm,
  },
});

export default ProfileModal;
