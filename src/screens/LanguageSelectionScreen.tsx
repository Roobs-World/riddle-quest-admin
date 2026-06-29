import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import Svg, {Defs, LinearGradient, Rect, Stop} from "react-native-svg";
import AuthScreenShell from "../components/layouts/AuthScreenShell";
import WideButton from "../components/buttons/WideButton";
import {COLORS, SHADOWS, SPACING, TYPOGRAPHY, styles} from "../styles";
import {LANGUAGE_OPTIONS, type SupportedLanguage, getRootCatalog, setLocale, t} from "../i18n";

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

const LANGUAGE_TITLE_HOLD_MS = 1500;
const LANGUAGE_TITLE_FADE_MS = 500;
const LANGUAGE_HEADER_COPY_HEIGHT = 132;
const LANGUAGE_SCROLL_TOP_FADE_HEIGHT = 44;

const getLanguageSelectionCopy = (language: SupportedLanguage) => {
  const languageSelection = getRootCatalog(language).AuthStrings.LanguageSelection;

  return {
    description: languageSelection.DESCRIPTION,
    title: languageSelection.TITLE,
  };
};

const getLanguageOptionIndex = (language: SupportedLanguage): number =>
  LANGUAGE_OPTIONS.findIndex((option) => option.code === language);

const LanguageSelectionScreen = ({onSubmit}: LanguageSelectionScreenProps): React.JSX.Element => {
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage | null>(null);
  const [titleLanguage, setTitleLanguage] = useState<SupportedLanguage>(LANGUAGE_OPTIONS[0]?.code ?? "en");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleOpacity = useRef(new Animated.Value(1)).current;
  const titleAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const titleCycleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleLanguageIndexRef = useRef(0);

  const languageOptions = useMemo(() => {
    return LANGUAGE_OPTIONS.map((option) => ({
      ...option,
      flag: LANGUAGE_FLAGS[option.code],
    }));
  }, []);

  const languageSelectionCopy = getLanguageSelectionCopy(titleLanguage);

  const clearTitleCycleTimeout = useCallback(() => {
    if (titleCycleTimeoutRef.current) {
      clearTimeout(titleCycleTimeoutRef.current);
      titleCycleTimeoutRef.current = null;
    }
  }, []);

  const clearTitleTween = useCallback(() => {
    clearTitleCycleTimeout();
    titleAnimationRef.current?.stop();
    titleAnimationRef.current = null;
  }, [clearTitleCycleTimeout]);

  const fadeTitleToLanguage = useCallback(
    (language: SupportedLanguage, onComplete?: () => void) => {
      clearTitleTween();

      const fadeOut = Animated.timing(titleOpacity, {
        duration: LANGUAGE_TITLE_FADE_MS,
        toValue: 0,
        useNativeDriver: true,
      });

      titleAnimationRef.current = fadeOut;
      fadeOut.start(({finished}) => {
        if (!finished) {
          return;
        }

        setTitleLanguage(language);

        const fadeIn = Animated.timing(titleOpacity, {
          duration: LANGUAGE_TITLE_FADE_MS,
          toValue: 1,
          useNativeDriver: true,
        });

        titleAnimationRef.current = fadeIn;
        fadeIn.start(({finished: fadeInFinished}) => {
          titleAnimationRef.current = null;

          if (fadeInFinished) {
            onComplete?.();
          }
        });
      });
    },
    [clearTitleTween, titleOpacity],
  );

  useEffect(() => {
    if (selectedLanguage || languageOptions.length <= 1) {
      return clearTitleCycleTimeout;
    }

    const scheduleNextTitle = () => {
      titleCycleTimeoutRef.current = setTimeout(() => {
        const nextIndex = (titleLanguageIndexRef.current + 1) % languageOptions.length;
        const nextLanguage = languageOptions[nextIndex].code;

        titleLanguageIndexRef.current = nextIndex;
        fadeTitleToLanguage(nextLanguage, scheduleNextTitle);
      }, LANGUAGE_TITLE_HOLD_MS);
    };

    scheduleNextTitle();

    return clearTitleCycleTimeout;
  }, [clearTitleCycleTimeout, fadeTitleToLanguage, languageOptions, selectedLanguage]);

  useEffect(() => {
    return clearTitleTween;
  }, [clearTitleTween]);

  const handleSelectLanguage = (language: SupportedLanguage) => {
    const selectedOptionIndex = getLanguageOptionIndex(language);

    if (selectedLanguage === language) {
      const titleOptionIndex = getLanguageOptionIndex(titleLanguage);

      clearTitleTween();
      titleOpacity.setValue(1);
      titleLanguageIndexRef.current = titleOptionIndex >= 0 ? titleOptionIndex : titleLanguageIndexRef.current;
      setSelectedLanguage(null);
      return;
    }

    titleLanguageIndexRef.current = selectedOptionIndex >= 0 ? selectedOptionIndex : titleLanguageIndexRef.current;
    setSelectedLanguage(language);
    fadeTitleToLanguage(language);
    setLocale(language);
  };

  const handleSubmit = async () => {
    if (!selectedLanguage || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    clearTitleTween();
    try {
      await onSubmit(selectedLanguage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreenShell>
      <View style={screenStyles.container}>
        <View style={screenStyles.header}>
          <Animated.View
            style={[screenStyles.headerCopy, {opacity: titleOpacity}]}
            testID="language-selection-copy"
          >
            <Text style={screenStyles.title}>{languageSelectionCopy.title}</Text>
            <Text style={screenStyles.description}>{languageSelectionCopy.description}</Text>
          </Animated.View>
        </View>

        <View style={screenStyles.scrollFrame}>
          <MaskedView
            maskElement={
              <View style={screenStyles.scrollAlphaMask} testID="language-scroll-alpha-mask">
                <Svg height={LANGUAGE_SCROLL_TOP_FADE_HEIGHT} width="100%">
                  <Defs>
                    <LinearGradient id="language-scroll-top-alpha" x1="0" x2="0" y1="0" y2="1">
                      <Stop offset="0" stopColor={COLORS.black} stopOpacity="0" />
                      <Stop offset="1" stopColor={COLORS.black} stopOpacity="1" />
                    </LinearGradient>
                  </Defs>
                  <Rect fill="url(#language-scroll-top-alpha)" height="100%" width="100%" />
                </Svg>
                <View style={screenStyles.scrollSolidMask} />
                <Svg height={LANGUAGE_SCROLL_TOP_FADE_HEIGHT} width="100%">
                  <Defs>
                    <LinearGradient id="language-scroll-bottom-alpha" x1="0" x2="0" y1="0" y2="1">
                      <Stop offset="0" stopColor={COLORS.black} stopOpacity="1" />
                      <Stop offset="1" stopColor={COLORS.black} stopOpacity="0" />
                    </LinearGradient>
                  </Defs>
                  <Rect fill="url(#language-scroll-bottom-alpha)" height="100%" width="100%" />
                </Svg>
              </View>
            }
            style={screenStyles.scrollMask}
            testID="language-scroll-mask"
          >
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
                      <Text style={[screenStyles.languageLabel, isSelected && screenStyles.selectedLanguageLabel]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </MaskedView>
        </View>

        <View style={screenStyles.footer}>
          <WideButton
            buttonText={t("AuthStrings.LanguageSelection.CONTINUE_BUTTON")}
            disabled={!selectedLanguage || isSubmitting}
            onPress={handleSubmit}
            testID="language-selection-submit"
          />
        </View>
      </View>
    </AuthScreenShell>
  );
};

const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    zIndex: 2,
  },
  description: {
    color: "rgba(255,255,255,0.84)",
    fontFamily: TYPOGRAPHY.fontPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
    lineHeight: 24,
    maxWidth: 420,
    textAlign: "center",
  },
  flag: {
    fontSize: 30,
    marginBottom: SPACING.sm,
  },
  footer: {
    paddingBottom: SPACING.md,
    paddingTop: SPACING.md,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
    justifyContent: "center",
  },
  gridContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: SPACING["2xl"],
    paddingTop: SPACING.md,
  },
  header: {
    alignItems: "center",
    paddingTop: SPACING.xl,
  },
  headerCopy: {
    alignItems: "center",
    gap: SPACING.md,
    height: LANGUAGE_HEADER_COPY_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
    width: "100%",
  },
  languageCard: {
    alignItems: "center",
    backgroundColor: "rgba(252, 250, 244, 0.92)",
    borderRadius: 20,
    borderWidth: 1.5,
    minHeight: 110,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
    width: "29%",
  },
  languageLabel: {
    color: COLORS.figmaPurple,
    fontFamily: TYPOGRAPHY.fontSecondaryBold,
    fontSize: TYPOGRAPHY.fontSize.sm,
    textAlign: "center",
  },
  scrollAlphaMask: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  scrollFrame: {
    flex: 1,
    marginTop: SPACING.xl,
  },
  scrollMask: {
    flex: 1,
  },
  scrollSolidMask: {
    backgroundColor: COLORS.black,
    flex: 1,
  },
  selectedLanguageCard: {
    backgroundColor: "rgba(64, 31, 64, 0.92)",
    borderColor: COLORS.primaryOrangeLight,
    ...SHADOWS.lg,
  },
  selectedLanguageLabel: {
    color: COLORS.white,
  },
  supportedLanguageCard: {
    borderColor: "rgba(254, 200, 128, 0.55)",
    elevation: 8,
    shadowColor: COLORS.figmaGold,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  title: {
    ...styles.title,
    color: COLORS.white,
    textAlign: "center",
  },
});

export default LanguageSelectionScreen;
