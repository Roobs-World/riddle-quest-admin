import {releaseRegistry} from "./release-registry.mjs";
import {spawn} from "node:child_process";
import {constants as osConstants} from "node:os";
import {fileURLToPath} from "node:url";
import path from "node:path";

const repositoryDirectory = fileURLToPath(new URL("../..", import.meta.url));

const releasePlans = releaseRegistry;

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
    throw new Error(`Unknown release target ${JSON.stringify(target)}; run pnpm release:plan for supported targets`);
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

/** Verifies once, then executes every target-specific release adapter in a deterministic order. */
export async function runAllPlatformReleases({
  dryRun = false,
  commandRunner = runReleaseCommand,
  environment = process.env,
  log = console.log,
} = {}) {
  if (dryRun) {
    log("All-target release plan (no build, upload, package, or publish action will be performed).\n");
    for (const plan of releasePlans) log(`${formatPlatformReleasePlan(clonePlan(plan))}\n`);
    return releasePlans.map(({target, boundary}) => ({target, status: "planned", boundary}));
  }
  log("Running the shared target verification gate before any release adapter.");
  await commandRunner({executable: "pnpm", args: ["verify:all-targets"], cwd: repositoryDirectory, environment});
  const results = [];
  let sourcePrepared = false;
  for (const {target, delivery} of releasePlans) {
    if (delivery.startsWith("neutral-") && !sourcePrepared) {
      await commandRunner({executable: "pnpm", args: ["release:html5"], cwd: repositoryDirectory, environment});
      sourcePrepared = true;
    }
    const releaseEnvironment = sourcePrepared ? {...environment, HTML5_SOURCE_PREPARED: "1"} : environment;
    results.push(await runPlatformRelease(target, {commandRunner, environment: releaseEnvironment, log}));
  }
  return results;
}
