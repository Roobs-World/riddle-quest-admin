import React from "react";
import { View } from "react-native";
import RiddleText from "./RiddleText";
import GuessGrid from "./GuessGrid";
import Keyboard from "./Keyboard";
import { isTablet } from "../../utils/responsive";
import { styles } from "../../styles";
import QuestionsSvg from "../../../assets/images/questions.svg";

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
  handleBackspace: () => void;
  handleKeyPress: (key: string) => void;
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
  handleBackspace,
  handleKeyPress,
  isAnyOverlayVisible,
}) => {
  return (
    <>
      <View
        style={[
          styles.riddleContainer,
          isTablet && styles.riddleContainerTablet,
          {
            maxHeight: "20%",
            height: "20%",
            width: "100%",
            minHeight: "20%",
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <QuestionsSvg
          width="90%"
          height="100%"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            top: "0%",
            zIndex: 0,
          }}
        />
        <RiddleText riddleText={riddleText} />
      </View>

      <GuessGrid
        guesses={guesses}
        currentGuess={currentGuess}
        answerLength={answerLength}
        shakeKey={shakeKey}
      />

      <Keyboard
        submitKeyPress={handleKeyPress}
        handleBackspace={handleBackspace}
        isVisible={!isAnyOverlayVisible}
      />
    </>
  );
};

export default GameBoard;
