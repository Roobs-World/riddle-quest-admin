import {validateRepairPayload} from "./repair-payload.mjs";

const REPOSITORY = "Grindhead/riddle-quest";
export async function completeRepair(context, payload, token, checkContext, fetcher = fetch) {
  const {changes, summary} = validateRepairPayload(payload);
  const request = async (path, options = {}) => {
    const response = await fetcher(`https://api.github.com/repos/${REPOSITORY}${path}`, {signal: AbortSignal.timeout(12_000), redirect: "error", ...options, headers: {Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "Content-Type": "application/json"}});
    if (!response.ok) throw new Error(`github_repair_request_failed_${response.status}`);
    return response.status === 204 ? null : response.json();
  };
  const gate = await checkContext(context);
  if (!gate.allowed) return {status: "blocked", reason: gate.reason};
  const ref = await request(`/git/ref/heads/${encodeURIComponent(context.branch)}`);
  if (ref.object.sha !== context.claimSha) return {status: "blocked", reason: "claim_already_completed_or_changed"};
  const claim = await request(`/git/commits/${context.claimSha}`);
  const tree = [];
  for (const change of changes) {
    const blob = await request("/git/blobs", {method: "POST", body: JSON.stringify({content: change.content, encoding: "base64"})});
    tree.push({path: change.path, mode: "100644", type: "blob", sha: blob.sha});
  }
  const updatedTree = await request("/git/trees", {method: "POST", body: JSON.stringify({base_tree: claim.tree.sha, tree})});
  const commit = await request("/git/commits", {method: "POST", body: JSON.stringify({message: `Fix Sentry issue ${context.issueId}`, tree: updatedTree.sha, parents: [context.claimSha]})});
  const finalGate = await checkContext(context);
  if (!finalGate.allowed) return {status: "blocked", reason: finalGate.reason};
  await request(`/git/refs/heads/${encodeURIComponent(context.branch)}`, {method: "PATCH", body: JSON.stringify({sha: commit.sha, force: false})});
  const pull = await request("/pulls", {method: "POST", body: JSON.stringify({title: `Fix Sentry issue ${context.issueId}`, head: context.branch, base: context.base, draft: false, body: `${summary}\n\nSentry issue: ${context.issueId}\n\nThe service rechecks deployment, source and exact CI head before merging. Uploads and deployments remain separate operations.\n\n<!-- sentry-worker-ticket:${payload.ticket} -->`})});
  return {status: "pull_request_opened", pullRequest: pull.number};
}
