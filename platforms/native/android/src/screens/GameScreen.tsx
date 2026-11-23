import {
  canShowLatinShortcut,
  YOUTUBE_CLASSIC_SKIP_COST,
  YOUTUBE_CONTINUE_COST,
  YOUTUBE_HINT_COST,
  type LocalSoloAuthority,
  type YouTubeActiveGame,
  type YouTubeAuthoritySnapshot,
  type YouTubeCopyKey,
  type YouTubeLocale,
  type YouTubeRiddle,
} from "../../../../../src/solo";
import type {Feedback} from "../../../../../src/core/game";
import type {RefObject} from "react";
import {Pressable, StyleSheet, Text, useWindowDimensions, View} from "react-native";
import {ActionButton, Eyebrow, Heading, Notice, Screen} from "../components/Primitives";
import {SaveBanner, StatusHeader} from "../components/StatusViews";
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
const feedbackStyle = (feedback: Feedback) =>
  feedback === "green"
    ? styles.tileGreen
    : feedback === "yellow"
      ? styles.tileYellow
      : styles.tileRed;
/** Props for {@link GameScreen}. */
export type GameScreenProps = Readonly<{
  /** Active locale. */
  locale: YouTubeLocale;
  /** Local gameplay authority. */
  authority: LocalSoloAuthority;
  /** Latest authority projection. */
  snapshot: YouTubeAuthoritySnapshot;
  /** Active puzzle state. */
  active: YouTubeActiveGame;
  /** Active riddle. */
  riddle: YouTubeRiddle;
  /** Draft letters merged with revealed hints. */
  displayLetters: readonly string[];
  /** Latest localized operation failure. */
  notice: YouTubeCopyKey | null;
  /** Runs one authority transition. */
  run: (action: () => Promise<unknown>) => Promise<void>;
  /** Localized copy lookup. */
  text: (key: YouTubeCopyKey) => string;
  /** Native editor reference. */
  inputRef: RefObject<AnswerEditor | null>;
}>;
/** Riddle, scored guesses, the editable answer row, and the Playable's actions. */
export function GameScreen({locale, authority, snapshot, active, riddle, displayLetters, notice, run, text, inputRef}: GameScreenProps) {
  /** Window width used to size one row of tiles. */
  const {width} = useWindowDimensions();
  /** Tile edge for this answer length. */
  const size = tileSize(width, displayLetters.length);
  /** Durable progression. */
  const progression = snapshot.save.progression;
  /** Whether material transitions are unavailable. */
  const materialDisabled = snapshot.busy || snapshot.paused || snapshot.saveBlocked;
  /** Ephemeral drafts remain editable while the previous result saves. */
  const inputDisabled = snapshot.paused || snapshot.saveBlocked;
  /** Whether the fixed Latin shortcut keys apply to this answer. */
  const latinShortcut = canShowLatinShortcut(riddle.answer);
  /** Restores physical typing after a user-invoked editing action. */
  const focusAnswer = (): void => inputRef.current?.focus();
  /** Submits the answer when material actions are allowed. */
  const submit = (): void => {
    if (!materialDisabled) void run(() => authority.submitGuess());
  };
  return (
    <Screen paused={snapshot.paused} testID="screen-game">
      <StatusHeader snapshot={snapshot} locale={locale} />
      {snapshot.saveBlocked && <SaveBanner text={text} retry={() => run(() => authority.retryPendingSave())} />}
      {notice && (
        <Notice error testID="notice">
          {text(notice)}
        </Notice>
      )}
      <View style={styles.puzzle}>
        <Eyebrow>{`${text(active.mode === "classic" ? "classic" : "daily")} · ${text("riddle")}`}</Eyebrow>
        <Heading testID="riddle-text">{riddle.text}</Heading>
      </View>
      <View accessibilityLabel={text("attempts")} style={styles.guesses} testID="guesses">
        {active.guesses.map((guess, row) => (
          <View key={row} style={styles.row} testID={`guess-row-${row}`}>
            {guess.letters.map((letter, index) => (
              <View
                key={index}
                accessibilityLabel={`${letter}: ${guess.feedback[index]}`}
                style={[styles.tile, feedbackStyle(guess.feedback[index]!), {width: size, height: size}]}
                testID={`guess-${row}-${index}-${guess.feedback[index]}`}
              >
                <Text style={[styles.tileLetter, {fontSize: Math.round(size * 0.5)}]}>{letter}</Text>
              </View>
            ))}
          </View>
        ))}
        <View style={styles.row} testID="current-row">
          {displayLetters.map((letter, index) => {
            /** Whether a hint locked this slot. */
            const hinted = active.hintRevealedIndices.includes(index);
            return (
              <Pressable
                key={index}
                accessibilityRole="button"
                accessibilityLabel={`${text("inputLabel")}: ${index + 1}${letter ? `: ${letter}` : ""}`}
                disabled={inputDisabled || active.awaitingContinue || hinted}
                onPress={() => {
                  authority.setActiveSlot(index);
                  focusAnswer();
                }}
                style={[
                  styles.tile,
                  hinted && styles.tileHinted,
                  snapshot.activeSlotIndex === index && styles.tileActive,
                  {width: size, height: size},
                ]}
                testID={`slot-${index}`}
              >
                <Text style={[styles.tileLetter, {fontSize: Math.round(size * 0.5)}]}>{letter}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <AnswerInput
        inputRef={inputRef}
        disabled={inputDisabled || active.awaitingContinue}
        locale={locale}
        label={text("inputLabel")}
        latinShortcut={latinShortcut}
        onText={(value) => authority.insertText(value)}
        onBackspace={() => authority.backspace()}
        onSubmit={submit}
      />
      {active.awaitingContinue ? (
        <View style={styles.actions}>
          <ActionButton
            tone="primary"
            label={`${text("buyContinue")} · ${YOUTUBE_CONTINUE_COST} ${text("coins")}`}
            disabled={materialDisabled || progression.coins < YOUTUBE_CONTINUE_COST}
            onPress={() => {
              void run(() => authority.buyContinue());
            }}
            testID="buy-continue"
          />
          <ActionButton
            label={text("finishRun")}
            disabled={materialDisabled}
            onPress={() => {
              void run(() => authority.finishWithoutContinue());
            }}
            testID="finish-run"
          />
        </View>
      ) : (
        <View style={styles.actions}>
          <ActionButton
            tone="primary"
            label={text("submit")}
            disabled={materialDisabled || displayLetters.some((letter) => !letter)}
            onPress={() => {
              focusAnswer();
              submit();
            }}
            testID="submit"
          />
          <View style={styles.secondaryActions}>
            <ActionButton
              label={`${text("hint")} · ${YOUTUBE_HINT_COST}`}
              disabled={materialDisabled || progression.coins < YOUTUBE_HINT_COST}
              onPress={() => {
                focusAnswer();
                void run(() => authority.requestHint());
              }}
              style={styles.secondaryAction}
              testID="hint"
            />
            {active.mode === "classic" && (
              <ActionButton
                label={`${text("skip")} · ${YOUTUBE_CLASSIC_SKIP_COST}`}
                disabled={materialDisabled || progression.coins < YOUTUBE_CLASSIC_SKIP_COST}
                onPress={() => {
                  void run(() => authority.skipClassic());
                }}
                style={styles.secondaryAction}
                testID="skip"
              />
            )}
          </View>
        </View>
      )}
    </Screen>
  );
}
/** Styles for the game screen. */
const styles = StyleSheet.create({
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
});
