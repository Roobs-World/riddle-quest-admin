/** Requires the exact commit's Production readiness workflow to succeed. */
export function evaluateWorkflowRuns(workflowRuns, headSha) {
  const run = workflowRuns.find((candidate) => candidate.head_sha === headSha && candidate.event === "pull_request");
  if (!run || run.status !== "completed") return {state: "pending"};
  return run.conclusion === "success"
    ? {state: "passed", runId: run.id}
    : {state: "failed", runId: run.id, conclusion: run.conclusion};
}
