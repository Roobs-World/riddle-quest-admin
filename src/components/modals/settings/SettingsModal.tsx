/**
 * @fileoverview SettingsModal component - Bottom sheet settings modal for Riddle Quest.
 */

import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import CloseButton from "../../buttons/CloseButton";
import {
  AppStrings,
  LANGUAGE_OPTIONS,
  SupportedLanguage,
  getLanguageLabel,
} from "../../../constants/AppStrings";
import { TYPOGRAPHY } from "../../../styles";
import { SPACING } from "../../../styles";
import { verticalScale } from "@/utils/responsive";
import SlideInModalContent from "../../shared/SlideInModalContent";

interface SettingsModalProps {
  isVisible: boolean;
  onClose: () => void;
  isSoundEnabled: boolean;
  onToggleSound: (isEnabled: boolean) => void;
  isHapticsEnabled: boolean;
  onToggleHaptics: (isEnabled: boolean) => void;
  currentLanguage: SupportedLanguage;
  onChangeLanguage: (language: SupportedLanguage) => void;
  onPressHelp: () => void;
  onPressLogout: () => void;
  onPressCredits: () => void;
}

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
        {AppStrings.Settings.TOGGLE_ON}
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
        {AppStrings.Settings.TOGGLE_OFF}
      </Text>
    </TouchableOpacity>
  </View>
);

const ArrowRow = ({
  label,
  value,
  onPress,
}: {
  label: string;
  value?: string;
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
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {value ? (
        <Text
          style={{
            marginRight: 8,
            color: "#6B7280",
            fontFamily: TYPOGRAPHY.fontSecondary,
            fontSize: TYPOGRAPHY.fontSize.sm,
          }}
        >
          {value}
        </Text>
      ) : null}
      <Text style={{ fontSize: 20, color: "#9CA3AF" }}>{">"}</Text>
    </View>
  </TouchableOpacity>
);

const SettingsModal: React.FC<SettingsModalProps> = ({
  isVisible,
  onClose,
  isSoundEnabled,
  onToggleSound,
  isHapticsEnabled,
  onToggleHaptics,
  currentLanguage,
  onChangeLanguage,
  onPressHelp,
  onPressLogout,
  onPressCredits,
}) => {
  const [isLanguagePickerOpen, setIsLanguagePickerOpen] = React.useState(false);
  const [selectedLanguage, setSelectedLanguage] =
    React.useState<SupportedLanguage>(currentLanguage);
  const [selectedSoundEnabled, setSelectedSoundEnabled] =
    React.useState<boolean>(isSoundEnabled);
  const [selectedHapticsEnabled, setSelectedHapticsEnabled] =
    React.useState<boolean>(isHapticsEnabled);

  React.useEffect(() => {
    if (isVisible) {
      setSelectedLanguage(currentLanguage);
      setSelectedSoundEnabled(isSoundEnabled);
      setSelectedHapticsEnabled(isHapticsEnabled);
    }
  }, [isVisible, currentLanguage, isSoundEnabled, isHapticsEnabled]);

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />

        <SlideInModalContent isVisible={isVisible}>
          <View
            style={{
              backgroundColor: "#FCFAF4",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingBottom: SPACING["2xl"] ?? 32,
            }}
          >
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
                fontSize: TYPOGRAPHY.fontSize["4xl"],
                color: "#1A1A1A",
                letterSpacing: 1,
              }}
            >
              {AppStrings.Settings.TITLE}
            </Text>
            <CloseButton
              onPress={onClose}
              style={{
                position: "absolute",
                right: SPACING.lg,
                top: verticalScale(32),
            }}
            />
          </View>

          <View style={{ paddingHorizontal: SPACING.lg }}>
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
              <SegmentedToggle
                value={selectedSoundEnabled}
                onChange={(enabled) => {
                  setSelectedSoundEnabled(enabled);
                  onToggleSound(enabled);
                }}
              />
            </View>

            <View style={{ height: 1, backgroundColor: "#E8E0E8" }} />

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
              <SegmentedToggle
                value={selectedHapticsEnabled}
                onChange={(enabled) => {
                  setSelectedHapticsEnabled(enabled);
                  onToggleHaptics(enabled);
                }}
              />
            </View>

            <View style={{ height: 1, backgroundColor: "#E8E0E8" }} />

            <ArrowRow
              label={AppStrings.Settings.LANGUAGE_LABEL}
              value={getLanguageLabel(selectedLanguage)}
              onPress={() => setIsLanguagePickerOpen(true)}
            />

            <View style={{ height: 1, backgroundColor: "#E8E0E8" }} />

            <ArrowRow label={AppStrings.Settings.HELP_BUTTON} onPress={onPressHelp} />

            <View style={{ height: 1, backgroundColor: "#E8E0E8" }} />

            <ArrowRow label={AppStrings.Settings.CREDITS_BUTTON} onPress={onPressCredits} />

            <View style={{ height: 1, backgroundColor: "#E8E0E8" }} />

            <TouchableOpacity
              onPress={async () => {
                try {
                  onClose();
                  if (onPressLogout) onPressLogout();
                } catch {
                  Alert.alert(AppStrings.Settings.LOGOUT_ERROR_TITLE, AppStrings.Settings.LOGOUT_ERROR_MESSAGE);
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
        </SlideInModalContent>
      </View>

      <Modal
        visible={isLanguagePickerOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsLanguagePickerOpen(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.5)",
            paddingHorizontal: SPACING.lg,
          }}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setIsLanguagePickerOpen(false)}
          />

          <SlideInModalContent isVisible={isLanguagePickerOpen}>
            <View
              style={{
                maxHeight: "70%",
                borderRadius: 20,
                backgroundColor: "#FCFAF4",
                padding: SPACING.lg,
              }}
            >
            <Text
              style={{
                fontFamily: TYPOGRAPHY.fontPrimary,
                fontSize: TYPOGRAPHY.fontSize.lg,
                fontWeight: "bold",
                color: "#1A1A1A",
                marginBottom: SPACING.md,
              }}
            >
              {AppStrings.Settings.LANGUAGE_LABEL}
            </Text>

            <ScrollView>
              {LANGUAGE_OPTIONS.map((option) => {
                const isSelected = option.code === selectedLanguage;
                return (
                  <TouchableOpacity
                    key={option.code}
                    onPress={() => {
                      setSelectedLanguage(option.code);
                      onChangeLanguage(option.code);
                      setIsLanguagePickerOpen(false);
                    }}
                    style={{
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: "#E8E0E8",
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: TYPOGRAPHY.fontSecondary,
                        fontSize: TYPOGRAPHY.fontSize.base,
                        color: "#1A1A1A",
                      }}
                    >
                      {option.label}
                    </Text>
                    <Text
                      style={{
                        fontFamily: TYPOGRAPHY.fontSecondary,
                        fontSize: TYPOGRAPHY.fontSize.sm,
                        color: isSelected ? "#401F40" : "#9CA3AF",
                      }}
                    >
                      {isSelected ? AppStrings.Settings.LANGUAGE_SELECTED : ""}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setIsLanguagePickerOpen(false)}
              style={{
                alignSelf: "flex-end",
                marginTop: SPACING.md,
                paddingVertical: 8,
                paddingHorizontal: 12,
              }}
            >
              <Text
                style={{
                  fontFamily: TYPOGRAPHY.fontSecondary,
                  fontSize: TYPOGRAPHY.fontSize.base,
                  color: "#401F40",
                }}
              >
                {AppStrings.Settings.CLOSE_BUTTON}
              </Text>
            </TouchableOpacity>
            </View>
          </SlideInModalContent>

          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setIsLanguagePickerOpen(false)}
          />
        </View>
      </Modal>
    </Modal>
  );
};

export default SettingsModal;
