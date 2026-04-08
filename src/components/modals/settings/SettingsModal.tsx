/**
 * @fileoverview SettingsModal component - Bottom sheet settings modal for Qwordly.
 */

import React from "react";
import { View, Text, Modal, TouchableOpacity, Alert } from "react-native";
import { getAuth } from "@react-native-firebase/auth";
import { getApp } from "@react-native-firebase/app";
import { AppStrings } from "../../../constants/AppStrings";
import { TYPOGRAPHY } from "../../../styles";
import { useModal } from "../../../hooks/useModal";
import { SPACING } from "../../../styles";

interface SettingsModalProps {
  isVisible: boolean;
  onClose: () => void;
  isSoundEnabled: boolean;
  onToggleSound: (isEnabled: boolean) => void;
  isHapticsEnabled: boolean;
  onToggleHaptics: (isEnabled: boolean) => void;
  isHardMode: boolean;
  onToggleHardMode: (isEnabled: boolean) => void;
  onPressHelp: () => void;
  onPressLogout: () => void;
  onPressCredits: () => void;
  playerData?: import("../../../validation/firestoreSchemas").Player | null;
}

/** Segmented On/Off toggle matching the Figma design. */
const SegmentedToggle = ({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) => (
  <View
    style={{
      flexDirection: "row",
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: "#401F40",
      overflow: "hidden",
    }}
  >
    <TouchableOpacity
      onPress={() => onChange(true)}
      style={{
        paddingHorizontal: 18,
        paddingVertical: 7,
        backgroundColor: value ? "#401F40" : "transparent",
      }}
    >
      <Text
        style={{
          color: value ? "#FFFFFF" : "#9CA3AF",
          fontFamily: TYPOGRAPHY.fontPrimary,
          fontSize: TYPOGRAPHY.fontSize.sm,
          fontWeight: "bold",
        }}
      >
        On
      </Text>
    </TouchableOpacity>
    <TouchableOpacity
      onPress={() => onChange(false)}
      style={{
        paddingHorizontal: 18,
        paddingVertical: 7,
        backgroundColor: !value ? "#401F40" : "transparent",
      }}
    >
      <Text
        style={{
          color: !value ? "#FFFFFF" : "#9CA3AF",
          fontFamily: TYPOGRAPHY.fontPrimary,
          fontSize: TYPOGRAPHY.fontSize.sm,
          fontWeight: "bold",
        }}
      >
        Off
      </Text>
    </TouchableOpacity>
  </View>
);

/** Row item with label + right chevron arrow. */
const ArrowRow = ({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 16,
    }}
  >
    <Text
      style={{
        fontFamily: TYPOGRAPHY.fontSecondary,
        fontSize: TYPOGRAPHY.fontSize.base,
        color: "#1A1A1A",
      }}
    >
      {label}
    </Text>
    <Text style={{ fontSize: 20, color: "#9CA3AF" }}>›</Text>
  </TouchableOpacity>
);

const SettingsModal: React.FC<SettingsModalProps> = ({
  isVisible,
  onClose,
  isSoundEnabled,
  onToggleSound,
  isHapticsEnabled,
  onToggleHaptics,
  isHardMode,
  onToggleHardMode,
  onPressHelp,
  onPressLogout,
  onPressCredits,
  playerData,
}) => {
  const modal = useModal();

  const handleViewAchievements = () => {
    onClose();
    setTimeout(() => {
      modal.openGameModal("achievements", { playerData: playerData ?? null });
    }, 100);
  };

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
        {/* Dismiss on backdrop tap */}
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={onClose}
          activeOpacity={1}
        />

        <View
          style={{
            backgroundColor: "#FCFAF4",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingBottom: SPACING["2xl"] ?? 32,
          }}
        >
          {/* Drag handle */}
          <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 4 }}>
            <View
              style={{
                width: 36,
                height: 4,
                backgroundColor: "#C4B8C4",
                borderRadius: 2,
              }}
            />
          </View>

          {/* Header row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: SPACING.lg,
              paddingVertical: SPACING.md,
              position: "relative",
            }}
          >
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: TYPOGRAPHY.fontSize.xl,
                fontWeight: "bold",
                color: "#1A1A1A",
                letterSpacing: 1,
              }}
            >
              {AppStrings.Settings.TITLE}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={{
                position: "absolute",
                right: SPACING.lg,
                width: 32,
                height: 32,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  color: "#1A1A1A",
                  fontWeight: "300",
                }}
              >
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          {/* Rows */}
          <View style={{ paddingHorizontal: SPACING.lg }}>
            {/* Sound toggle */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 16,
              }}
            >
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontSecondary,
                  fontSize: TYPOGRAPHY.fontSize.base,
                  color: "#1A1A1A",
                }}
              >
                {AppStrings.Settings.SOUND_TOGGLE}
              </Text>
              <SegmentedToggle value={isSoundEnabled} onChange={onToggleSound} />
            </View>

            <View style={{ height: 1, backgroundColor: "#E8E0E8" }} />

            {/* Haptics toggle */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 16,
              }}
            >
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontSecondary,
                  fontSize: TYPOGRAPHY.fontSize.base,
                  color: "#1A1A1A",
                }}
              >
                {AppStrings.Settings.HAPTICS_TOGGLE}
              </Text>
              <SegmentedToggle value={isHapticsEnabled} onChange={onToggleHaptics} />
            </View>

            <View style={{ height: 1, backgroundColor: "#E8E0E8" }} />

            {/* Hard Mode toggle */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 16,
              }}
            >
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontSecondary,
                  fontSize: TYPOGRAPHY.fontSize.base,
                  color: "#1A1A1A",
                }}
              >
                {AppStrings.Settings.HARD_MODE_TOGGLE}
              </Text>
              <SegmentedToggle value={isHardMode} onChange={onToggleHardMode} />
            </View>

            <View style={{ height: 1, backgroundColor: "#E8E0E8" }} />

            {/* Help and Support */}
            <ArrowRow label="Help and Support?" onPress={onPressHelp} />

            <View style={{ height: 1, backgroundColor: "#E8E0E8" }} />

            {/* Details account */}
            <ArrowRow label="Details account" onPress={onPressCredits} />

            {playerData != null && (
              <>
                <View style={{ height: 1, backgroundColor: "#E8E0E8" }} />
                <ArrowRow label="Achievements" onPress={handleViewAchievements} />
              </>
            )}

            <View style={{ height: 1, backgroundColor: "#E8E0E8" }} />

            {/* Logout */}
            <TouchableOpacity
              onPress={async () => {
                try {
                  await getAuth(getApp()).signOut();
                  if (onPressLogout) onPressLogout();
                } catch {
                  Alert.alert("Error", "Could not log out. Please try again.");
                }
              }}
              style={{ paddingVertical: 16 }}
            >
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontSecondary,
                  fontSize: TYPOGRAPHY.fontSize.base,
                  color: "#F54160",
                }}
              >
                {AppStrings.Settings.LOGOUT_BUTTON}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default SettingsModal;
