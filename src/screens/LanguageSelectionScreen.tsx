import React, {useMemo, useState} from "react";
import {ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import CustomSafeAreaView from "../components/layouts/CustomSafeAreaView";
import StarryBackground from "../components/background/StarryBackground";
import WideButton from "../components/buttons/WideButton";
import {COLORS, SHADOWS, SPACING, TYPOGRAPHY, styles} from "../styles";
import {LANGUAGE_OPTIONS, type SupportedLanguage, setLocale, t} from "../i18n";

interface LanguageSelectionScreenProps {
  onSubmit: (language: SupportedLanguage) => Promise<void> | void;
}

const LANGUAGE_FLAGS: Record<SupportedLanguage, string> = {
  en: "🇬🇧",
  es: "🇪🇸",
  pt: "🇵🇹",
  fr: "🇫🇷",
  de: "🇩🇪",
  ja: "🇯🇵",
  ko: "🇰🇷",
  zh: "🇨🇳",
  hi: "🇮🇳",
  ru: "🇷🇺",
  tr: "🇹🇷",
  ar: "🇸🇦",
  id: "🇮🇩",
  it: "🇮🇹",
  nl: "🇳🇱",
  pl: "🇵🇱",
  vi: "🇻🇳",
};

const LanguageSelectionScreen = ({onSubmit}: LanguageSelectionScreenProps): React.JSX.Element => {
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const languageOptions = useMemo(() => {
    return LANGUAGE_OPTIONS.map((option) => ({
      ...option,
      flag: LANGUAGE_FLAGS[option.code],
    }));
  }, []);

  const handleSelectLanguage = (language: SupportedLanguage) => {
    setSelectedLanguage(language);
    setLocale(language);
  };

  const handleSubmit = async () => {
    if (!selectedLanguage || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(selectedLanguage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CustomSafeAreaView className="justify-start">
      <StarryBackground />

      <View style={screenStyles.container}>
        <View style={screenStyles.header}>
          <Text style={screenStyles.title}>{t("AuthStrings.LanguageSelection.TITLE")}</Text>
          <Text style={screenStyles.description}>{t("AuthStrings.LanguageSelection.DESCRIPTION")}</Text>
        </View>

        <ScrollView
          contentContainerStyle={screenStyles.gridContent}
          showsVerticalScrollIndicator={false}
          style={screenStyles.scrollArea}
        >
          <View style={screenStyles.grid}>
            {languageOptions.map((option) => {
              const isSelected = selectedLanguage === option.code;

              return (
                <TouchableOpacity
                  key={option.code}
                  accessibilityRole="button"
                  accessibilityState={{selected: isSelected}}
                  onPress={() => handleSelectLanguage(option.code)}
                  style={[
                    screenStyles.languageCard,
                    screenStyles.supportedLanguageCard,
                    isSelected && screenStyles.selectedLanguageCard,
                  ]}
                  testID={`language-option-${option.code}`}
                >
                  <Text style={screenStyles.flag}>{option.flag}</Text>
                  <Text style={screenStyles.languageLabel}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={screenStyles.footer}>
          <WideButton
            buttonText={t("AuthStrings.LanguageSelection.CONTINUE_BUTTON")}
            disabled={!selectedLanguage || isSubmitting}
            onPress={handleSubmit}
            testID="language-selection-submit"
          />
        </View>
      </View>
    </CustomSafeAreaView>
  );
};

const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    zIndex: 2,
  },
  header: {
    alignItems: "center",
    paddingTop: SPACING.xl,
  },
  title: {
    ...styles.title,
    color: COLORS.white,
    marginBottom: SPACING.md,
    textAlign: "center",
  },
  description: {
    color: "rgba(255,255,255,0.84)",
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: 24,
    maxWidth: 420,
    textAlign: "center",
  },
  scrollArea: {
    flex: 1,
    marginTop: SPACING.xl,
  },
  gridContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: SPACING.xl,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
    justifyContent: "center",
  },
  languageCard: {
    alignItems: "center",
    backgroundColor: "rgba(12, 17, 37, 0.74)",
    borderRadius: 20,
    borderWidth: 1.5,
    minHeight: 110,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
    width: "29%",
  },
  supportedLanguageCard: {
    borderColor: "rgba(254, 200, 128, 0.55)",
    shadowColor: COLORS.figmaGold,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  selectedLanguageCard: {
    backgroundColor: "rgba(64, 31, 64, 0.92)",
    borderColor: COLORS.primaryOrangeLight,
    transform: [{translateY: -2}],
    ...SHADOWS.lg,
  },
  flag: {
    fontSize: 30,
    marginBottom: SPACING.sm,
  },
  languageLabel: {
    color: COLORS.white,
    fontFamily: TYPOGRAPHY.fontSecondaryBold,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: "center",
  },
  footer: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
  },
});

export default LanguageSelectionScreen;
