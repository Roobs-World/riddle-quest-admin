import {spawn} from "node:child_process";
import {constants as osConstants} from "node:os";
import {fileURLToPath} from "node:url";
import path from "node:path";

const repositoryDirectory = fileURLToPath(new URL("../..", import.meta.url));

const releasePlans = Object.freeze([
  Object.freeze({
    target: "jest",
    title: "Jest",
    boundary: "remote-active-on-ready",
    publicCommand: "pnpm release:jest",
    summary: "Run the hardened production gate and upload one immutable build for automatic activation.",
    externalEffect: "Uploads to Jest and activates the exact build automatically after processing succeeds; it never submits the game for review or makes a private game public.",
    command: Object.freeze({
      executable: "pnpm",
      args: Object.freeze(["--filter", "@qwordly/portal", "release:jest:timestamped"]),
    }),
    handoff: "Wait for authoritative completion, verify the exact version is active, then run the deployed sandbox smoke.",
    runbook: "docs/jest-html5-operations.md",
  }),
  Object.freeze({
    target: "facebook",
    title: "Facebook",
    boundary: "local-immutable-handoff",
    publicCommand: "pnpm release:facebook",
    summary: "Verify the Facebook artifact and create its immutable manual-upload handoff.",
    externalEffect: "None; Meta Dashboard upload and production promotion remain manual.",
    command: Object.freeze({
      executable: "pnpm",
      args: Object.freeze(["--filter", "@qwordly/portal", "release:facebook"]),
    }),
    handoff: "Upload only the printed read-only archive to Meta as a non-production Draft.",
    runbook: "docs/facebook-instant-games-operations.md",
  }),
  Object.freeze({
    target: "youtube",
    title: "YouTube",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:youtube",
    summary: "Verify all isolated targets and create the deterministic YouTube release bundle.",
    externalEffect: "None; Developer Portal ingestion and certification remain manual.",
    command: Object.freeze({
      executable: "pnpm",
      args: Object.freeze(["--filter", "@qwordly/portal", "preflight:youtube-upload"]),
    }),
    handoff: "Upload build-youtube.zip and retain its manifest and test report for manual certification.",
    runbook: "docs/youtube-playables-operations.md",
  }),
  Object.freeze({
    target: "reddit",
    title: "Reddit",
    boundary: "local-immutable-handoff",
    publicCommand: "pnpm release:reddit",
    summary: "Validate release contracts and create the commit-bound immutable Reddit candidate handoff.",
    externalEffect: "None; Devvit ingestion and promotion remain blocked pending exact-byte proof.",
    command: Object.freeze({
      executable: "pnpm",
      args: Object.freeze(["--filter", "@qwordly/reddit-app", "release:candidate"]),
    }),
    handoff: "Remote ingestion remains blocked until an exact-byte Devvit adapter or equivalent proof is available.",
    runbook: "docs/reddit-games-operations.md",
  }),
]);

const plansByTarget = new Map(releasePlans.map((plan) => [plan.target, plan]));

function clonePlan(plan) {
  const {command: _command, ...publicPlan} = plan;
  return {
    ...publicPlan,
  };
}

/** Lists the supported platform release plans without exposing mutable internal state. */
export function listPlatformReleasePlans() {
  return releasePlans.map(clonePlan);
}

/** Gets one validated platform release plan. */
export function getPlatformReleasePlan(target) {
  const plan = plansByTarget.get(target);
  if (!plan) {
    throw new Error(`Unknown release target ${JSON.stringify(target)}; expected jest, facebook, youtube, or reddit`);
  }
  return clonePlan(plan);
}

/** Formats a platform release plan for an operator before any command runs. */
export function formatPlatformReleasePlan(plan) {
  return [
    `Release target: ${plan.title}`,
    `Boundary: ${plan.boundary}`,
    `Action: ${plan.summary}`,
    `External effect: ${plan.externalEffect}`,
    `Command: ${plan.publicCommand}`,
    `Handoff: ${plan.handoff}`,
    `Runbook: ${plan.runbook}`,
  ].join("\n");
}

/** Runs a child release command and rejects on every non-successful outcome. */
export function runReleaseCommand({
  executable,
  args,
  cwd = repositoryDirectory,
  environment = process.env,
}) {
  return new Promise((resolve, reject) => {
    const detached = process.platform !== "win32";
    const child = spawn(executable, args, {
      cwd,
      detached,
      env: environment,
      stdio: "inherit",
    });
    let terminationTimer;
    let forwardedSignal;
    let settled = false;
    const terminateChild = (signal) => {
      try {
        if (detached && child.pid) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch (error) {
        if (error?.code !== "ESRCH") throw error;
      }
    };
    const signalHandlers = new Map(["SIGINT", "SIGTERM"].map((signal) => [signal, () => {
      if (forwardedSignal) {
        terminateChild("SIGKILL");
        return;
      }
      forwardedSignal = signal;
      terminateChild(signal);
      terminationTimer = setTimeout(() => terminateChild("SIGKILL"), 10_000);
    }]));
    const cleanup = () => {
      if (terminationTimer) clearTimeout(terminationTimer);
      for (const [signal, handler] of signalHandlers) process.removeListener(signal, handler);
    };
    const finish = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    for (const [signal, handler] of signalHandlers) process.on(signal, handler);
    child.once("error", finish);
    child.once("close", (code, signal) => {
      if (code === 0 && signal === null && !forwardedSignal) {
        finish();
        return;
      }
      const terminalSignal = forwardedSignal ?? signal;
      const error = new Error(
        `Release child failed (exit ${code ?? "none"}, signal ${terminalSignal ?? "none"})`,
      );
      if (terminalSignal && osConstants.signals[terminalSignal]) {
        error.exitCode = 128 + osConstants.signals[terminalSignal];
      }
      finish(error);
    });
  });
}

/** Executes one canonical platform release while preserving its target-specific boundary. */
export async function runPlatformRelease(
  target,
  {
    dryRun = false,
    commandRunner = runReleaseCommand,
    environment = process.env,
    log = console.log,
  } = {},
) {
  const definition = plansByTarget.get(target);
  if (!definition) getPlatformReleasePlan(target);
  const plan = clonePlan(definition);
  log(formatPlatformReleasePlan(plan));
  if (dryRun) {
    log("Dry run: no build, upload, package, or publish action was performed.");
    return {target, status: "planned", boundary: plan.boundary};
  }
  if (
    target === "jest" &&
    (environment.JEST_UPLOAD_IS_ACTIVE !== undefined || environment.JEST_CONFIRM_ACTIVATION !== undefined)
  ) {
    throw new Error(
      "release:jest has a fixed automatic-activation contract; remove JEST_UPLOAD_IS_ACTIVE and " +
      "JEST_CONFIRM_ACTIVATION instead of overriding the committed release policy",
    );
  }
  await commandRunner({...definition.command, cwd: repositoryDirectory, environment});
  log(`Release handoff ready for ${plan.title}. ${plan.handoff}`);
  return {target, status: "handoff-ready", boundary: plan.boundary};
}
