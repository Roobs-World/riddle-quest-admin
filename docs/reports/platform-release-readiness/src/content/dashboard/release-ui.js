// Interpret operational states without treating missing verification as success.
export function releaseStateTone(value) {
  const state = String(value ?? "").trim();
  if (/blocked|failed|rejected|\berror\b/iu.test(state)) return "critical";
  if (/\bnot\b|unverified|unavailable|absent|unauthorized|no partner|pending|gated|candidate|partial|\bhold\b|to do|to investigate|to review|to verify/iu.test(state)) return "attention";
  if (/prohibited|disabled|no action/iu.test(state)) return "neutral";
  if (/passed|implemented|integrated|deployed|testing|accepted|submitted|complete|verified|\bdone\b/iu.test(state)) return "positive";
  return "neutral";
}

export function summarizeActions(rows) {
  const complete = rows.filter(({status}) => /^(complete|completed|done|verified)$/iu.test(String(status).trim())).length;
  const blocked = rows.filter(({status}) => /^blocked$/iu.test(String(status).trim())).length;
  const held = rows.filter(({status}) => /^on hold$/iu.test(String(status).trim())).length;
  const remaining = rows.length - complete;
  const now = rows.filter(({priority, status}) => priority === "Now" && !/^(complete|completed|done|verified)$/iu.test(String(status).trim())).length;
  return {complete, blocked, held, remaining, now, progress: rows.length ? complete / rows.length * 100 : 0};
}

export function displayDate(value) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", {day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC"}).format(date);
}
