const normalizeForComparison = (value: string): string =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{Z}\p{S}_]+/gu, "");

export function clueContainsLiteralAnswer(question: string, answer: string): boolean {
  const normalizedQuestion = normalizeForComparison(question);
  const normalizedAnswer = normalizeForComparison(answer);

  if (!normalizedQuestion || !normalizedAnswer) {
    return false;
  }

  if (normalizedQuestion === normalizedAnswer) {
    return true;
  }

  return normalizedQuestion.includes(normalizedAnswer);
}
