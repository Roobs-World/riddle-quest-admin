/** Normalizes for comparison. */
const normalizeForComparison = (value: string, locale?: string): string =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase(locale)
    .replace(/[\p{P}\p{Z}\p{S}_]+/gu, "");

/** Provides clue contains literal answer behavior. */
export function clueContainsLiteralAnswer(question: string, answer: string, locale?: string): boolean {
  const normalizedQuestion = normalizeForComparison(question, locale);
  const normalizedAnswer = normalizeForComparison(answer, locale);

  if (!normalizedQuestion || !normalizedAnswer) {
    return false;
  }

  if (normalizedQuestion === normalizedAnswer) {
    return true;
  }

  return normalizedQuestion.includes(normalizedAnswer);
}
