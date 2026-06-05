/**
 * @fileoverview SettingsModal component - Bottom sheet settings modal for Riddle Quest.
 */

import React from "react";
import {View, Text, Modal, TouchableOpacity, Alert, ScrollView} from "react-native";
import CloseButton from "../../buttons/CloseButton";
import {t, LANGUAGE_OPTIONS, SupportedLanguage, getLanguageLabel} from "../../../i18n";
import {TYPOGRAPHY} from "../../../styles";
import {SPACING} from "../../../styles";
import {verticalScale} from "@/utils/responsive";
import SlideInModalContent from "../../shared/SlideInModalContent";
import {AUTH_CONTENT_MAX_WIDTH, MODAL_MAX_HEIGHT} from "../../../constants/layout";

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
  onPressAbout: () => void;
  onPressLogout: () => void;
  onPressCredits: () => void;
  initialLanguagePickerOpen?: boolean;
}

const SegmentedToggle = ({value, onChange}: {value: boolean; onChange: (v: boolean) => void}) => (
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
        {t("Settings.TOGGLE_ON")}
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
        {t("Settings.TOGGLE_OFF")}
      </Text>
    </TouchableOpacity>
  </View>
);

const ArrowRow = ({label, value, onPress}: {label: string; value?: string; onPress: () => void}) => (
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
    <View style={{flexDirection: "row", alignItems: "center"}}>
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
      <Text style={{fontSize: 20, color: "#9CA3AF"}}>{">"}</Text>
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
  onPressAbout,
  onPressLogout,
  onPressCredits,
  initialLanguagePickerOpen = false,
}) => {
  const [isLanguagePickerOpen, setIsLanguagePickerOpen] = React.useState(initialLanguagePickerOpen);

  return (
    <Modal visible={isVisible} transparent={true} animationType="none" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <TouchableOpacity style={{flex: 1}} onPress={onClose} activeOpacity={1} />

        <SlideInModalContent isVisible={isVisible} style={{width: "100%", alignItems: "center"}}>
          <View
            style={{
              width: "100%",
              maxWidth: AUTH_CONTENT_MAX_WIDTH,
              maxHeight: MODAL_MAX_HEIGHT,
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
                {t("Settings.TITLE")}
              </Text>
              <CloseButton
                onPress={onClose}
                style={{
                  position: "absolute",
                  right: SPACING.lg,
                  top: verticalScale(22),
                }}
              />
            </View>

            <ScrollView style={{width: "100%"}} contentContainerStyle={{paddingHorizontal: SPACING.lg}}>
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
                  {t("Settings.SOUND_TOGGLE")}
                </Text>
                <SegmentedToggle
                  value={isSoundEnabled}
                  onChange={(enabled) => {
                    onToggleSound(enabled);
                  }}
                />
              </View>

              <View style={{height: 1, backgroundColor: "#E8E0E8"}} />

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
                  {t("Settings.HAPTICS_TOGGLE")}
                </Text>
                <SegmentedToggle
                  value={isHapticsEnabled}
                  onChange={(enabled) => {
                    onToggleHaptics(enabled);
                  }}
                />
              </View>

              <View style={{height: 1, backgroundColor: "#E8E0E8"}} />

              <ArrowRow
                label={t("Settings.LANGUAGE_LABEL")}
                value={getLanguageLabel(currentLanguage)}
                onPress={() => setIsLanguagePickerOpen(true)}
              />

              <View style={{height: 1, backgroundColor: "#E8E0E8"}} />

              <ArrowRow label={t("Settings.HELP_BUTTON")} onPress={onPressHelp} />

              <View style={{height: 1, backgroundColor: "#E8E0E8"}} />

              <ArrowRow label={t("Settings.CREDITS_BUTTON")} onPress={onPressCredits} />

              <View style={{height: 1, backgroundColor: "#E8E0E8"}} />

              <ArrowRow label={t("Settings.ABOUT_BUTTON")} onPress={onPressAbout} />

              <View style={{height: 1, backgroundColor: "#E8E0E8"}} />

              <TouchableOpacity
                onPress={async () => {
                  try {
                    onClose();
                    if (onPressLogout) onPressLogout();
                  } catch {
                    Alert.alert(t("Settings.LOGOUT_ERROR_TITLE"), t("Settings.LOGOUT_ERROR_MESSAGE"));
                  }
                }}
                style={{paddingVertical: 16}}
              >
                <Text
                  style={{
                    fontFamily: TYPOGRAPHY.fontSecondary,
                    fontSize: TYPOGRAPHY.fontSize.base,
                    color: "#F54160",
                  }}
                >
                  {t("Settings.LOGOUT_BUTTON")}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </SlideInModalContent>
      </View>

      <Modal
        visible={isLanguagePickerOpen}
        transparent={true}
        animationType="none"
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
          <TouchableOpacity style={{flex: 1}} activeOpacity={1} onPress={() => setIsLanguagePickerOpen(false)} />

          <SlideInModalContent isVisible={isLanguagePickerOpen} style={{width: "100%", alignItems: "center"}}>
            <View
              style={{
                width: "100%",
                maxWidth: AUTH_CONTENT_MAX_WIDTH,
                maxHeight: MODAL_MAX_HEIGHT * 0.8,
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
                {t("Settings.LANGUAGE_LABEL")}
              </Text>

              <ScrollView>
                {LANGUAGE_OPTIONS.map((option) => {
                  const isSelected = option.code === currentLanguage;
                  return (
                    <TouchableOpacity
                      key={option.code}
                      onPress={() => {
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
                        {isSelected ? t("Settings.LANGUAGE_SELECTED") : ""}
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
                  {t("Settings.CLOSE_BUTTON")}
                </Text>
              </TouchableOpacity>
            </View>
          </SlideInModalContent>

          <TouchableOpacity style={{flex: 1}} activeOpacity={1} onPress={() => setIsLanguagePickerOpen(false)} />
        </View>
      </Modal>
    </Modal>
  );
};

export default SettingsModal;
