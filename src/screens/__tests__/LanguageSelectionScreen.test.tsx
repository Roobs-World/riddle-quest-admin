import React from "react";
import {Animated, StyleSheet} from "react-native";
import {act, fireEvent, render, waitFor} from "@testing-library/react-native";
import LanguageSelectionScreen from "../LanguageSelectionScreen";
import {setLocale} from "../../i18n";

const isAnimatedPointValue = (value: unknown): value is {x: number; y: number} =>
  typeof value === "object" &&
  value !== null &&
  "x" in value &&
  "y" in value &&
  typeof value.x === "number" &&
  typeof value.y === "number";

jest.mock("../../components/layouts/CustomSafeAreaView", () => {
  const React = require("react");
  const {View} = require("react-native");

  return function MockCustomSafeAreaView({children}: {children: React.ReactNode}) {
    return <View testID="safe-area">{children}</View>;
  };
});

jest.mock("../../components/background/StarryBackground", () => {
  const React = require("react");
  const {View} = require("react-native");

  return function MockStarryBackground() {
    return <View testID="starry-background" />;
  };
});

jest.mock("../../components/buttons/WideButton", () => {
  const React = require("react");
  const {Text, TouchableOpacity} = require("react-native");

  return function MockWideButton({
    buttonText,
    disabled,
    onPress,
    testID,
  }: {
    buttonText: string;
    disabled?: boolean;
    onPress: () => void;
    testID?: string;
  }) {
    return (
      <TouchableOpacity disabled={disabled} onPress={onPress} testID={testID}>
        <Text>{buttonText}</Text>
      </TouchableOpacity>
    );
  };
});

describe("LanguageSelectionScreen", () => {
  let timingSpy: jest.SpiedFunction<typeof Animated.timing>;

  beforeEach(() => {
    jest.useFakeTimers();
    setLocale("en");
    timingSpy = jest.spyOn(Animated, "timing").mockImplementation((value, config) => {
      const animation = {
        reset: jest.fn(),
        start: jest.fn((callback?: Animated.EndCallback) => {
          if (value instanceof Animated.Value && typeof config.toValue === "number") {
            value.setValue(config.toValue);
          } else if (value instanceof Animated.ValueXY && isAnimatedPointValue(config.toValue)) {
            value.setValue(config.toValue);
          }
          callback?.({finished: true});
        }),
        stop: jest.fn(),
      };

      return animation as unknown as Animated.CompositeAnimation;
    });
  });

  afterEach(() => {
    timingSpy.mockRestore();
    jest.useRealTimers();
  });

  it("cycles the title through languages in option order every 1.5 seconds", () => {
    const {getByText} = render(<LanguageSelectionScreen onSubmit={jest.fn()} />);

    expect(getByText("Choose your language")).toBeTruthy();
    expect(getByText("This previews the app in your selected language before you continue.")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(getByText("Elige tu idioma")).toBeTruthy();
    expect(getByText("Esto previsualiza la app en tu idioma elegido antes de continuar.")).toBeTruthy();
    expect(timingSpy).toHaveBeenCalledWith(
      expect.any(Animated.Value),
      expect.objectContaining({duration: 500, toValue: 0, useNativeDriver: true}),
    );

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(getByText("Escolha seu idioma")).toBeTruthy();
  });

  it("keeps the language grid anchored while the header copy changes length", () => {
    const {getByTestId} = render(<LanguageSelectionScreen onSubmit={jest.fn()} />);

    const headerCopyStyle = StyleSheet.flatten(getByTestId("language-selection-copy").props.style);

    expect(headerCopyStyle.height).toBe(132);
  });

  it("pauses cycling and fades to the selected language", () => {
    const {getByTestId, getByText, queryByText} = render(<LanguageSelectionScreen onSubmit={jest.fn()} />);

    fireEvent.press(getByTestId("language-option-fr"));

    expect(getByText("Choisissez votre langue")).toBeTruthy();
    expect(getByText("Cela prévisualise l'application dans la langue choisie avant de continuer.")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(9000);
    });

    expect(getByText("Choisissez votre langue")).toBeTruthy();
    expect(queryByText("Elige tu idioma")).toBeNull();
  });

  it("deselects the selected language and resumes cycling from the displayed title", () => {
    const {getByTestId, getByText, queryByText} = render(<LanguageSelectionScreen onSubmit={jest.fn()} />);

    fireEvent.press(getByTestId("language-option-fr"));
    expect(getByText("Choisissez votre langue")).toBeTruthy();

    fireEvent.press(getByTestId("language-option-fr"));
    expect(queryByText("Choisissez votre langue")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(getByText("Wähle deine Sprache")).toBeTruthy();
    expect(queryByText("Choisissez votre langue")).toBeNull();
  });

  it("keeps the new selection fade running after deselecting and selecting another language", () => {
    const {getByTestId} = render(<LanguageSelectionScreen onSubmit={jest.fn()} />);

    fireEvent.press(getByTestId("language-option-fr"));
    fireEvent.press(getByTestId("language-option-fr"));

    const runningAnimations: Array<{stop: jest.Mock}> = [];
    timingSpy.mockImplementation(() => {
      const animation = {
        reset: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
      };
      runningAnimations.push(animation);

      return animation as unknown as Animated.CompositeAnimation;
    });

    fireEvent.press(getByTestId("language-option-es"));

    expect(runningAnimations.length).toBeGreaterThan(0);
    runningAnimations.forEach((animation) => {
      expect(animation.stop).not.toHaveBeenCalled();
    });
  });

  it("clears the title tween before continuing", async () => {
    const onSubmit = jest.fn();
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");
    const {getByTestId} = render(<LanguageSelectionScreen onSubmit={onSubmit} />);

    fireEvent.press(getByTestId("language-option-es"));
    fireEvent.press(getByTestId("language-selection-submit"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("es"));
    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
  });
});
