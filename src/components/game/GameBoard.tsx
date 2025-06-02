import React from "react";
import { View, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import RiddleText from "./RiddleText";
import GuessGrid from "./GuessGrid";
import Keyboard from "./Keyboard";
import QuestionsBackground from "@images/questions.svg";
import { isTablet } from "../../utils/responsive";

interface SubmittedGuess {
  guess: string[];
  feedback: ("green" | "yellow" | "red")[];
}

interface GameBoardProps {
  riddleText: string;
  guesses: SubmittedGuess[];
  currentGuess: string[];
  answerLength: number;
  shakeKey: number;
  setTileRef: (rowIndex: number, cellIndex: number, ref: View | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  animatedStyle: any;
  onKeyPress: (key: string) => void;
  isAnyOverlayVisible: boolean;
}

/**
 * Game board component following Single Responsibility Principle
 * Responsible for displaying the game board (riddle and guess grid)
 */
const GameBoard: React.FC<GameBoardProps> = ({
  riddleText,
  guesses,
  currentGuess,
  answerLength,
  shakeKey,
  setTileRef,
  animatedStyle,
  onKeyPress,
  isAnyOverlayVisible,
}) => {
  return (
    <>
      <View
        style={[
          styles.riddleContainer,
          isTablet && styles.riddleContainerTablet,
        ]}
      >
        <QuestionsBackground style={styles.questionsBackground} />
        <RiddleText riddleText={riddleText} />
      </View>

      <View
        style={[
          styles.centerContainer,
          isTablet && styles.centerContainerTablet,
        ]}
      >
        <Animated.View style={animatedStyle}>
          <GuessGrid
            guesses={guesses}
            currentGuess={currentGuess}
            answerLength={answerLength}
            shakeKey={shakeKey}
            setTileRef={setTileRef}
          />
        </Animated.View>
      </View>

      {!isAnyOverlayVisible && <Keyboard onKeyPress={onKeyPress} />}
    </>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: "center",
  },
  centerContainerTablet: {
    alignSelf: "center",
    marginHorizontal: 40,
    maxWidth: 600,
    width: "100%",
  },
  questionsBackground: {
    height: 150,
    opacity: 0.5,
    position: "absolute",
    top: -10,
    width: 335,
  },
  riddleContainer: {
    alignItems: "center",
    marginVertical: 16,
    position: "relative",
  },
  riddleContainerTablet: {
    marginVertical: 24,
    paddingHorizontal: 20,
  },
});

export default GameBoard;
