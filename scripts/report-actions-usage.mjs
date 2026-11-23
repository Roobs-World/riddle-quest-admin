#!/usr/bin/env node
import {execFile} from "node:child_process";
import {promisify} from "node:util";

const execFileAsync = promisify(execFile);
const PAGE_SIZE = 100;
const MAX_RUN_PAGES = 10;
const MAX_JOB_PAGES = 100;
const MAX_ATTEMPTS = 100;
const CONCURRENCY = 4;

function options(args) {
  const result = {repo: "Grindhead/riddle-quest", month: new Date().toISOString().slice(0, 7), json: false};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") result.json = true;
    else if (arg === "--help" || arg === "-h") result.help = true;
    else if (arg === "--repo" || arg === "--month") {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value.`);
      result[arg.slice(2)] = value;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(result.repo)) throw new Error("--repo must be owner/repo.");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(result.month) || result.month.startsWith("0000")) {
    throw new Error("--month must be YYYY-MM with a valid month.");
  }
  return result;
}

async function api(endpoint, params = {}) {
  const query = new URLSearchParams(params);
  const path = `${endpoint}?${query}`;
  try {
    const {stdout} = await execFileAsync("gh", ["api", "--method", "GET", path,
      "-H", "Accept: application/vnd.github+json", "-H", "X-GitHub-Api-Version: 2022-11-28"],
    {encoding: "utf8", timeout: 60_000, maxBuffer: 16 * 1024 * 1024});
    return JSON.parse(stdout);
  } catch (error) {
    const detail = error.stderr?.trim() || error.message;
    const failure = new Error(`GitHub request failed for ${endpoint}: ${detail}`);
    failure.missing = /\bHTTP (404|410)\b/.test(detail);
    throw failure;
  }
}

async function listRuns(repo, month, warnings) {
  const first = `${month}-01`;
  const last = new Date(Date.parse(`${first}T00:00:00Z`) + 32 * 86_400_000);
  last.setUTCDate(0);
  const lastDay = last.toISOString().slice(0, 10);
  const endpoint = `repos/${repo}/actions/runs`;

  async function range(start, end, splitLargeRange = false) {
    const runs = [];
    let expected = 0;
    for (let page = 1; page <= MAX_RUN_PAGES; page += 1) {
      const data = await api(endpoint, {created: `${start}..${end}`, per_page: PAGE_SIZE, page});
      if (!Array.isArray(data.workflow_runs)) throw new Error(`Invalid workflow run response for ${start}..${end}.`);
      expected = Math.max(expected, data.total_count || 0);
      if (page === 1 && expected > MAX_RUN_PAGES * PAGE_SIZE && splitLargeRange) {
        for (let day = 1; day <= Number(lastDay.slice(-2)); day += 1) {
          const date = `${month}-${String(day).padStart(2, "0")}`;
          runs.push(...await range(date, date));
        }
        return runs;
      }
      runs.push(...data.workflow_runs);
      if (data.workflow_runs.length < PAGE_SIZE || runs.length >= expected) break;
    }
    if (expected > runs.length) warnings.add(`Incomplete run history for ${start}..${end}: fetched ${runs.length} of ${expected}. GitHub caps filtered searches at 1,000 runs.`);
    return runs;
  }

  const runs = await range(first, lastDay, true);
  return [...new Map(runs.filter((run) => run.created_at?.slice(0, 7) === month).map((run) => [run.id, run])).values()];
}

async function listAttemptJobs(repo, runId, attempt, warnings) {
  const jobs = [];
  let expected = 0;
  for (let page = 1; page <= MAX_JOB_PAGES; page += 1) {
    const data = await api(`repos/${repo}/actions/runs/${runId}/attempts/${attempt}/jobs`, {per_page: PAGE_SIZE, page});
    if (!Array.isArray(data.jobs)) throw new Error(`Invalid jobs response for run ${runId}, attempt ${attempt}.`);
    expected = Math.max(expected, data.total_count || 0);
    jobs.push(...data.jobs);
    if (data.jobs.length < PAGE_SIZE || jobs.length >= expected) break;
  }
  if (jobs.length < expected) warnings.add(`Incomplete jobs for run ${runId}, attempt ${attempt}: fetched ${jobs.length} of ${expected}.`);
  return jobs;
}

function stats() {
  return {runs: 0, runConclusions: {}, jobs: 0, jobConclusions: {}, executionSeconds: 0, roundedJobMinutes: 0,
    excludedJobs: {skipped: 0, unfinished: 0, invalidOrZeroDuration: 0, duplicate: 0},
    attemptsExpected: 0, attemptsFetched: 0, attemptsUnavailable: 0};
}

function increment(counts, key) {
  counts[key] = (counts[key] || 0) + 1;
}

function addRun(target, run, attemptCount) {
  target.runs += 1;
  target.attemptsExpected += attemptCount;
  increment(target.runConclusions, run.conclusion || run.status || "unknown");
}

function addJob(target, job, seen) {
  if (seen) { target.excludedJobs.duplicate += 1; return; }
  if (job.conclusion === "skipped") { target.excludedJobs.skipped += 1; return; }
  if (job.status !== "completed") { target.excludedJobs.unfinished += 1; return; }
  const duration = Date.parse(job.completed_at) - Date.parse(job.started_at);
  if (!Number.isFinite(duration) || duration <= 0) { target.excludedJobs.invalidOrZeroDuration += 1; return; }
  target.jobs += 1;
  target.executionSeconds += duration / 1000;
  target.roundedJobMinutes += Math.ceil(duration / 60_000);
  increment(target.jobConclusions, job.conclusion || "unknown");
}

function group(map, name) {
  if (!map.has(name)) map.set(name, {name, ...stats()});
  return map.get(name);
}

function sorted(map) {
  return [...map.values()].sort((a, b) => b.roundedJobMinutes - a.roundedJobMinutes || a.name.localeCompare(b.name));
}

async function report({repo, month}) {
  const warnings = new Set([
    "This is a recorded job execution estimate, not an invoice or billing quota. Account billing requires separate permissions. Runner prices, free allowances, multipliers and self-hosted runners are not applied.",
    "Scope is runs created in the selected UTC month, including all available attempts. Jobs and later reruns are not clipped to the month, and reruns of older runs are outside this scope.",
    "Deleted or expired runs, attempts and jobs cannot be recovered through this report. Missing history can make the estimate incomplete."
  ]);
  const runs = await listRuns(repo, month, warnings);
  const totals = stats();
  const workflow = new Map();
  const event = new Map();
  const branch = new Map();
  const runReports = [];
  let cursor = 0;
  let failed = false;
  const seenJobs = new Set();

  async function worker() {
    while (!failed && cursor < runs.length) {
      const run = runs[cursor++];
      const attempts = Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0 ? run.run_attempt : 1;
      if (!run.run_attempt) warnings.add(`Run ${run.id} has no attempt count. Only attempt 1 was requested.`);
      if (attempts > MAX_ATTEMPTS) warnings.add(`Run ${run.id} has ${attempts} attempts. Only the first ${MAX_ATTEMPTS} were requested.`);
      const runReport = {id: run.id, workflow: run.path || run.name || String(run.workflow_id), name: run.name,
        event: run.event || "unknown", branch: run.head_branch || "(no branch)",
        createdAt: run.created_at, url: run.html_url, ...stats()};
      const targets = [totals, group(workflow, runReport.workflow), group(event, runReport.event), group(branch, runReport.branch), runReport];
      targets.forEach((target) => addRun(target, run, attempts));
      for (let attempt = 1; attempt <= Math.min(attempts, MAX_ATTEMPTS); attempt += 1) {
        if (failed) return;
        let jobs;
        try {
          jobs = await listAttemptJobs(repo, run.id, attempt, warnings);
        } catch (error) {
          if (!error.missing) { failed = true; throw error; }
          targets.forEach((target) => { target.attemptsUnavailable += 1; });
          warnings.add(`Run ${run.id}, attempt ${attempt} is unavailable. Its execution time is missing.`);
          continue;
        }
        targets.forEach((target) => { target.attemptsFetched += 1; });
        for (const job of jobs) {
          const duplicate = seenJobs.has(job.id);
          seenJobs.add(job.id);
          targets.forEach((target) => addJob(target, job, duplicate));
        }
      }
      runReports.push(runReport);
    }
  }

  await Promise.all(Array.from({length: Math.min(CONCURRENCY, runs.length)}, () => worker()));
  if (totals.excludedJobs.unfinished) warnings.add(`${totals.excludedJobs.unfinished} unfinished jobs were excluded. Run this report again after they complete.`);
  if (totals.excludedJobs.invalidOrZeroDuration) warnings.add(`${totals.excludedJobs.invalidOrZeroDuration} completed jobs had zero or invalid execution timestamps and were excluded.`);
  if (totals.attemptsExpected > totals.attemptsFetched + totals.attemptsUnavailable) warnings.add("Some run attempts were not fetched because the attempt limit was reached.");
  return {repo, month, generatedAt: new Date().toISOString(), metric: "recorded_job_execution_estimate",
    durationSource: "Sum of completed_at minus started_at for completed, non-skipped jobs. Queue time is excluded. Each positive job duration is rounded up separately for roundedJobMinutes.",
    totals, byWorkflow: sorted(workflow), byEvent: sorted(event), byBranch: sorted(branch),
    runs: runReports.sort((a, b) => b.roundedJobMinutes - a.roundedJobMinutes || a.id - b.id), warnings: [...warnings].sort()};
}

function textReport(result) {
  console.log(`${result.repo} GitHub Actions usage estimate for runs created in ${result.month} UTC`);
  console.log(`${result.totals.runs} runs, ${result.totals.jobs} completed jobs, ${result.totals.attemptsFetched}/${result.totals.attemptsExpected} attempts fetched`);
  console.log(`${(result.totals.executionSeconds / 60).toFixed(1)} execution minutes; ${result.totals.roundedJobMinutes} minutes after rounding each job up`);
  console.log(`Run conclusions: ${JSON.stringify(result.totals.runConclusions)}`);
  console.log(`Excluded jobs: ${JSON.stringify(result.totals.excludedJobs)}`);
  for (const [title, rows] of [["Workflow", result.byWorkflow], ["Event", result.byEvent], ["Branch", result.byBranch]]) {
    console.log(`\n${title}\tRuns\tJobs\tExecution minutes\tRounded job minutes\tRun conclusions`);
    for (const row of rows) console.log(`${row.name.replace(/[\t\r\n]/g, " ")}\t${row.runs}\t${row.jobs}\t${(row.executionSeconds / 60).toFixed(1)}\t${row.roundedJobMinutes}\t${JSON.stringify(row.runConclusions)}`);
  }
  console.log("\nWarnings:");
  for (const warning of result.warnings) console.log(`- ${warning}`);
}

try {
  const parsed = options(process.argv.slice(2));
  if (parsed.help) {
    console.log("Usage: node scripts/report-actions-usage.mjs [--repo owner/repo] [--month YYYY-MM] [--json]");
    console.log("Uses the existing gh login. Reads Actions history only; does not start workflows or request billing access.");
  } else {
    const result = await report(parsed);
    if (parsed.json) console.log(JSON.stringify(result, null, 2));
    else textReport(result);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
