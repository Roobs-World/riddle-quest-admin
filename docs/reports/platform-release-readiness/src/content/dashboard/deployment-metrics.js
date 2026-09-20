export const metricFields = ["activePlayers", "sessions", "gamesStarted", "gamesCompleted", "engagedSeconds", "loadSamples", "loadP95Ms", "errorSessions", "observedSessions"];

export function ratio(numerator, denominator) {
  return numerator == null || denominator == null || denominator === 0 ? null : numerator / denominator;
}

export function measurement(value, unit = "") {
  return value == null ? "Unavailable" : `${value.toLocaleString("en-GB", {maximumFractionDigits: 1})}${unit}`;
}

export function coverage(row, now = Date.now()) {
  const count = metricFields.filter((key) => row[key] != null).length;
  if (!count) return "Missing";
  const stale = now - (Date.parse(row.date) + 86400000) > 48 * 3600000;
  return `${stale ? "Stale · " : ""}${count === metricFields.length ? "Complete" : "Partial"}`;
}
