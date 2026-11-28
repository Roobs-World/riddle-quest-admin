const phases = [
  "guard", "operation", "preparation", "previous-preparation", "projection", "presence", "invoke", "returned", "finished", "retired",
] as const;
const prefix = "riddle-quest:facebook:quit:";
let latestToken: object | undefined;

export type FacebookQuitTracePhase = typeof phases[number];
export type FacebookQuitTraceRecorder = (phase: FacebookQuitTracePhase) => void;

export function beginFacebookQuitTrace(): {record: FacebookQuitTraceRecorder; close: () => void} {
  const token = {};
  latestToken = token;
  let closed = false;
  let timeline: Performance | undefined;
  try {
    timeline = globalThis.performance;
    for (const phase of phases) timeline.clearMarks(prefix + phase);
  } catch {
    closed = true;
  }
  return {
    record: phase => {
      if (closed || latestToken !== token || !timeline || !phases.includes(phase)) return;
      try {
        timeline.clearMarks(prefix + phase);
        timeline.mark(prefix + phase);
      } catch {}
    },
    close: () => {closed = true;},
  };
}
