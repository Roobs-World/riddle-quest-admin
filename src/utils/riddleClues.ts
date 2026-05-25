const ANSWER_TOKEN_PATTERN = /[a-z0-9]+/gi;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeForComparison = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

export const clueContainsLiteralAnswer = (clue: string, answer: string): boolean => {
  const normalizedAnswer = normalizeForComparison(answer);
  const normalizedClue = normalizeForComparison(clue);

  if (!normalizedAnswer || !normalizedClue) {
    return false;
  }

  if (normalizedClue === normalizedAnswer) {
    return true;
  }

  const answerPattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(answer.toLowerCase())}([^a-z0-9]|$)`, "i");
  return answerPattern.test(clue);
};

export const buildFallbackClue = (answer: string): string => {
  const answerLength = answer.trim().length;
  if (answerLength <= 0) {
    return "Solve this word.";
  }
  return `Solve this ${answerLength}-letter word.`;
};

export const resolvePlayableRiddleText = (riddleText: string, answer: string): string => {
  if (!clueContainsLiteralAnswer(riddleText, answer)) {
    return riddleText;
  }

  return buildFallbackClue(answer);
};

export const getAnswerTokens = (answer: string): string[] => answer.match(ANSWER_TOKEN_PATTERN) ?? [];
