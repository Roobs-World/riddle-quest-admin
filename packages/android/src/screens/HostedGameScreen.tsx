import type {HostServices, WebGameMode} from "@qwordly/hosted/hostTypes";
import {canShowLatinShortcut} from "@qwordly/solo";
import {useRef} from "react";
import {Pressable, StyleSheet, Text, useWindowDimensions, View} from "react-native";
import {ActionButton, Eyebrow, Heading, Notice, Panel, Screen} from "../components/Primitives";
import {AchievementRow} from "../components/StatusViews";
import {useHostedGame, type HostedFeedback, type HostedGameNotice} from "../hosted/useHostedGame";
import {palette, spacing} from "../theme";
import {AnswerInput, type AnswerEditor} from "./AnswerInput";
/** Largest tile edge in density-independent pixels. */
const MAX_TILE = 52;
/** Gap between tiles. */
const TILE_GAP = 6;
/** Resolves a tile edge that keeps every answer slot on one row. */
const tileSize = (width: number, slots: number): number =>
  Math.max(28, Math.min(MAX_TILE, Math.floor((width - spacing.md * 2 - TILE_GAP * (slots - 1)) / slots)));
/** Fill and border for a scored tile. */
const feedbackStyle = (feedback: HostedFeedback) =>
  feedback === "green" ? styles.tileGreen : feedback === "yellow" ? styles.tileYellow : styles.tileRed;
/** English copy for hosted notices; localized tables arrive with plan step 1.5. */
const NOTICE_COPY: Readonly<Record<HostedGameNotice, string>> = Object.freeze({
  "answer-incomplete": "Complete every answer slot.",
  "insufficient-coins": "Not enough coins.",
  "operation-failed": "That action could not be completed.",
  "service-unavailable": "The service is temporarily unavailable. Try again.",
});
/** Props for {@link HostedGameScreen}. */
export type HostedGameScreenProps = Readonly<{
  /** Shared hosted play services. */
  services: HostServices;
  /** Classic or Daily (`challenge`). */
  mode: WebGameMode;
  /** Content locale. */
  locale: string;
  /** Returns to the account screen. */
  onBack: () => void;
}>;
/** Server-authoritative Classic or Daily play: every guess, hint, continue, skip and completion is confirmed by the backend. */
export function HostedGameScreen({services, mode, locale, onBack}: HostedGameScreenProps) {
  /** Session controller. */
  const game = useHostedGame(services, mode, locale);
  /** Window width used to size one row of tiles. */
  const {width} = useWindowDimensions();
  /** Native answer editor. */
  const inputRef = useRef<AnswerEditor | null>(null);
  /** Server-confirmed coins. */
  const coins = game.account.profile?.coins;
  /** Title for the mode. */
  const title = mode === "classic" ? "Classic" : "Daily";
  /** Header shared by every state. */
  const header = (
    <View style={styles.status} testID="hosted-status">
      <ActionButton label="← Back" onPress={onBack} style={styles.back} testID="hosted-back" />
      <Text accessibilityLabel={coins === undefined ? "Coins: loading" : `Coins: ${coins}`} style={styles.coins} testID="hosted-coins">
        🪙 {coins ?? "…"}
      </Text>
    </View>
  );
  if (game.state.kind === "loading") {
    return (
      <Screen testID="screen-hosted-loading">
        {header}
        <Notice testID="hosted-notice">Loading your puzzle from the server…</Notice>
      </Screen>
    );
  }
  if (game.state.kind === "unavailable") {
    return (
      <Screen testID="screen-hosted-unavailable">
        {header}
        <Panel>
          <Eyebrow>{`${title} · server`}</Eyebrow>
          <Heading testID="hosted-heading">{game.state.code === "daily-completed" ? "Daily complete" : "Puzzle unavailable"}</Heading>
          <Notice error={game.state.code !== "daily-completed"} testID="hosted-notice">
            {game.state.code === "daily-completed" ? "Today's Daily is already solved on this account." : "The puzzle could not be loaded."}
          </Notice>
          {game.state.code !== "daily-completed" && <ActionButton tone="primary" label="Retry" onPress={game.next} testID="hosted-retry" />}
        </Panel>
      </Screen>
    );
  }
  if (game.state.kind === "complete") {
    /** Confirmed rewards. */
    const {result} = game.state;
    return (
      <Screen centered testID="screen-hosted-result">
        {header}
        <Panel style={styles.resultPanel}>
          <Text style={styles.icon}>{result.isCorrect ? "✨" : "🌙"}</Text>
          <Heading testID="hosted-result-heading">{result.isCorrect ? "Solved!" : "Not solved"}</Heading>
          <View style={styles.stats}>
            <View accessibilityLabel={`Attempts: ${result.attempts}`} style={styles.stat} testID="hosted-result-attempts">
              <Text style={styles.statLabel}>Attempts</Text>
              <Text style={styles.statValue}>{result.attempts}</Text>
            </View>
            <View accessibilityLabel={`Coins earned: ${result.coinsEarned}`} style={styles.stat} testID="hosted-result-coins">
              <Text style={styles.statLabel}>Coins earned</Text>
              <Text style={styles.statValue}>{result.coinsEarned}</Text>
            </View>
            {typeof result.newXp === "number" && (
              <View accessibilityLabel={`XP: ${result.newXp}`} style={styles.stat}>
                <Text style={styles.statLabel}>XP</Text>
                <Text style={styles.statValue}>{result.newXp}</Text>
              </View>
            )}
          </View>
          {result.newlyUnlockedAchievementIds.length > 0 && (
            <View style={styles.achievements}>
              <Heading level={2}>New achievements</Heading>
              <AchievementRow ids={result.newlyUnlockedAchievementIds} text={() => "Achievement"} label="New achievements" />
            </View>
          )}
          <ActionButton tone="primary" label={mode === "classic" ? "Next riddle" : "Done"} onPress={mode === "classic" ? game.next : onBack} testID="hosted-next" />
        </Panel>
      </Screen>
    );
  }
  /** Active puzzle. */
  const {riddle, rows, displayLetters, activeSlot, hintedSlots, awaitingContinue, busy, notice} = game.state;
  /** Tile edge for this answer length. */
  const size = tileSize(width, riddle.answerLength);
  /** Whether the fixed Latin keys apply; server answers are keyboard letters by policy. */
  const latinShortcut = riddle.evaluation ? canShowLatinShortcut(riddle.evaluation.answer) : true;
  /** Restores physical typing after a user-invoked editing action. */
  const focusAnswer = (): void => inputRef.current?.focus();
  return (
    <Screen testID="screen-hosted-game">
      {header}
      {notice && (
        <Notice error testID="hosted-notice">
          {NOTICE_COPY[notice]}
        </Notice>
      )}
      <View style={styles.puzzle}>
        <Eyebrow>{`${title} · server`}</Eyebrow>
        <Heading testID="hosted-riddle-text">{riddle.text}</Heading>
      </View>
      <View accessibilityLabel="Attempts" style={styles.guesses} testID="hosted-guesses">
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row} testID={`hosted-guess-row-${rowIndex}`}>
            {row.letters.map((letter, index) => (
              <View
                key={index}
                accessibilityLabel={`${letter}: ${row.feedback[index]}`}
                style={[styles.tile, feedbackStyle(row.feedback[index]!), {width: size, height: size}]}
                testID={`hosted-guess-${rowIndex}-${index}-${row.feedback[index]}`}
              >
                <Text style={[styles.tileLetter, {fontSize: Math.round(size * 0.5)}]}>{letter}</Text>
              </View>
            ))}
          </View>
        ))}
        <View style={styles.row} testID="hosted-current-row">
          {displayLetters.map((letter, index) => {
            /** Whether a hint locked this slot. */
            const hinted = hintedSlots.includes(index);
            return (
              <Pressable
                key={index}
                accessibilityRole="button"
                accessibilityLabel={`Type your answer: ${index + 1}${letter ? `: ${letter}` : ""}`}
                disabled={busy || awaitingContinue || hinted}
                onPress={() => {
                  game.setActiveSlot(index);
                  focusAnswer();
                }}
                style={[styles.tile, hinted && styles.tileHinted, activeSlot === index && styles.tileActive, {width: size, height: size}]}
                testID={`hosted-slot-${index}`}
              >
                <Text style={[styles.tileLetter, {fontSize: Math.round(size * 0.5)}]}>{letter}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <AnswerInput
        inputRef={inputRef}
        disabled={busy || awaitingContinue}
        locale={locale}
        label="Type your answer"
        latinShortcut={latinShortcut}
        onText={game.insertText}
        onBackspace={game.backspace}
        onSubmit={game.submit}
      />
      {awaitingContinue ? (
        <View style={styles.actions}>
          <ActionButton tone="primary" label="Use one more guess" disabled={busy} onPress={game.buyContinue} testID="hosted-buy-continue" />
          <ActionButton label="Finish" disabled={busy} onPress={game.finish} testID="hosted-finish" />
        </View>
      ) : (
        <View style={styles.actions}>
          <ActionButton
            tone="primary"
            label="Submit"
            disabled={busy || displayLetters.some((letter) => !letter)}
            onPress={() => {
              focusAnswer();
              game.submit();
            }}
            testID="hosted-submit"
          />
          <View style={styles.secondaryActions}>
            <ActionButton
              label="Hint"
              disabled={busy}
              onPress={() => {
                focusAnswer();
                game.hint();
              }}
              style={styles.secondaryAction}
              testID="hosted-hint"
            />
            {mode === "classic" && <ActionButton label="Skip" disabled={busy} onPress={game.skip} style={styles.secondaryAction} testID="hosted-skip" />}
          </View>
        </View>
      )}
    </Screen>
  );
}
/** Styles for the hosted game screen. */
const styles = StyleSheet.create({
  status: {flexDirection: "row", alignItems: "center", justifyContent: "space-between"},
  back: {minHeight: 40},
  coins: {color: palette.text, fontSize: 16, fontWeight: "600"},
  puzzle: {gap: spacing.xs},
  guesses: {gap: TILE_GAP},
  row: {flexDirection: "row", gap: TILE_GAP},
  tile: {
    borderRadius: 10,
    borderWidth: 2,
    borderColor: palette.border,
    backgroundColor: palette.tile,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLetter: {color: palette.text, fontWeight: "700", textTransform: "uppercase"},
  tileActive: {borderColor: palette.accent},
  tileHinted: {backgroundColor: palette.tileHinted, borderColor: palette.tileHintedBorder},
  tileGreen: {backgroundColor: palette.tileGreen, borderColor: palette.tileGreenBorder},
  tileYellow: {backgroundColor: palette.tileYellow, borderColor: palette.tileYellowBorder},
  tileRed: {backgroundColor: palette.tileRed, borderColor: palette.tileRedBorder},
  actions: {gap: spacing.sm},
  secondaryActions: {flexDirection: "row", gap: spacing.sm},
  secondaryAction: {flex: 1},
  resultPanel: {alignItems: "center"},
  icon: {fontSize: 56},
  stats: {flexDirection: "row", gap: spacing.md, alignSelf: "stretch"},
  stat: {flex: 1, alignItems: "center", gap: spacing.xs},
  statLabel: {color: palette.muted, fontSize: 13, textAlign: "center"},
  statValue: {color: palette.text, fontSize: 22, fontWeight: "700"},
  achievements: {alignSelf: "stretch", gap: spacing.sm},
});
