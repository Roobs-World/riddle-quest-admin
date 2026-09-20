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
  Object.freeze({
    target: "netflix",
    title: "Netflix",
    boundary: "local-validated-artifact",
    publicCommand: "pnpm release:netflix",
    summary: "Build and audit the isolated Netflix candidate artifact.",
    externalEffect: "None until a Netflix partner upload command is configured.",
    command: Object.freeze({executable: "pnpm", args: Object.freeze(["build:netflix"])}),
    handoff: "Use packages/portal/dist-netflix with the Netflix partner delivery tooling.",
    runbook: "docs/netflix-yahoo-candidate-builds.md",
  }),
  Object.freeze({
    target: "yahoo",
    title: "Yahoo",
    boundary: "local-validated-artifact",
    publicCommand: "pnpm release:yahoo",
    summary: "Build and audit the isolated Yahoo candidate artifact.",
    externalEffect: "None until a Yahoo partner upload command is configured.",
    command: Object.freeze({executable: "pnpm", args: Object.freeze(["build:yahoo"])}),
    handoff: "Use packages/portal/dist-yahoo with the Yahoo partner delivery tooling.",
    runbook: "docs/netflix-yahoo-candidate-builds.md",
  }),
  Object.freeze({
    target: "gamesnacks",
    title: "Google GameSnacks",
    boundary: "local-immutable-handoff",
    publicCommand: "pnpm release:gamesnacks",
    summary: "Build and package the isolated GameSnacks SDK target with its required game.json metadata.",
    externalEffect: "None; licensing and authenticated Developer Console upload remain manual.",
    command: Object.freeze({executable: "pnpm", args: Object.freeze(["build:gamesnacks"])}),
    handoff: "Complete the GameSnacks licensing agreement, then upload build-gamesnacks.zip in the Developer Console.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "itch",
    title: "itch.io",
    boundary: "local-immutable-handoff",
    publicCommand: "pnpm release:itch",
    summary: "Build the provider-neutral HTML5 game and create an itch.io-specific immutable handoff.",
    externalEffect: "None locally; the configured GitHub Actions Butler stage publishes this artifact after verification.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "itch"])}),
    handoff: "Create the initial itch.io project once, then configure Butler for automatic updates.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "crazygames",
    title: "CrazyGames Basic Launch",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:crazygames",
    summary: "Create the SDK-free, ad-free HTML5 archive accepted for a CrazyGames Basic Launch.",
    externalEffect: "None; CrazyGames Developer Portal upload and QA review remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "crazygames"])}),
    handoff: "Upload build-crazygames-basic.zip in the Developer Portal and retain its manifest digest.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "newgrounds",
    title: "Newgrounds",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:newgrounds",
    summary: "Create a provider-neutral HTML5 archive for an authenticated Newgrounds game project.",
    externalEffect: "None; Newgrounds project creation, terms review, upload, and publication remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "newgrounds"])}),
    handoff: "Use build-newgrounds.zip only after the authenticated project requirements are reviewed.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "gamejolt",
    title: "Game Jolt",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:gamejolt",
    summary: "Create a provider-neutral browser-game archive for a Game Jolt release package.",
    externalEffect: "None; game creation, package upload and publication remain authenticated dashboard steps.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "gamejolt"])}),
    handoff: "Create the Game Jolt game and browser package, then upload build-gamejolt.zip and publish its release.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "coolmath",
    title: "Coolmath Games pitch",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:coolmath",
    summary: "Create a neutral HTML5 archive for the non-exclusive Coolmath Games licensing pitch.",
    externalEffect: "None; licensing acceptance is required before any Coolmath SDK work or publication.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "coolmath"])}),
    handoff: "Submit the playable URL and retain build-coolmath-pitch.zip for requested review.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "armor",
    title: "Armor Games pitch",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:armor",
    summary: "Create a neutral HTML5 archive for a non-exclusive Armor Games licensing pitch.",
    externalEffect: "None; outreach, contract review and publication remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "armor"])}),
    handoff: "Send the playable URL and retain build-armor-pitch.zip if Armor requests the archive.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "gamepix",
    title: "GamePix review",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:gamepix",
    summary: "Create the SDK-free HTML5 archive permitted by the GamePix submission guidelines.",
    externalEffect: "None; account setup, upload, syndication choice and provider review remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "gamepix"])}),
    handoff: "Upload build-gamepix-review.zip without enabling syndication until the current terms are accepted.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "addictinggames",
    title: "Addicting Games review",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:addictinggames",
    summary: "Create a neutral HTML5 review archive for Addicting Games.",
    externalEffect: "None; the provider submission form and licensing review remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "addictinggames"])}),
    handoff: "Submit the hosted game URL and retain build-addictinggames-review.zip if the reviewer requests files.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "htmlgames",
    title: "HTMLGames.com pitch",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:htmlgames",
    summary: "Create a neutral HTML5 archive for the HTMLGames.com developer contact process.",
    externalEffect: "None; commercial review, file transfer and publication remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "htmlgames"])}),
    handoff: "Use the official developer form and retain build-htmlgames-pitch.zip for requested delivery.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "playkovo",
    title: "PlayKovo review",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:playkovo",
    summary: "Create a neutral HTML5 archive for PlayKovo manual review.",
    externalEffect: "None; submission review and publication remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "playkovo"])}),
    handoff: "Submit the hosted build or build-playkovo-review.zip through the provider review channel.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "kongregate",
    title: "Kongregate",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:kongregate",
    summary: "Create a provider-neutral HTML5 archive for Kongregate developer review.",
    externalEffect: "None; developer approval, agreement acceptance, upload and publication remain authenticated portal steps.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "kongregate"])}),
    handoff: "Apply for developer status, review the upload agreement, then upload build-kongregate.zip for review.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "lagged",
    title: "Lagged review",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:lagged",
    summary: "Create a neutral HTML5 archive for the Lagged developer application and integration review.",
    externalEffect: "None; developer approval and account-issued SDK configuration are required before monetized publication.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "lagged"])}),
    handoff: "Apply with the production playable URL and retain build-lagged-review.zip for provider review.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "gamedistribution",
    title: "GameDistribution review",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:gamedistribution",
    summary: "Create a neutral HTML5 archive for GameDistribution contracting and SDK review.",
    externalEffect: "None; contracting, assigned game ID, SDK integration, upload and activation remain authenticated provider steps.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "gamedistribution"])}),
    handoff: "Apply with the production playable URL and retain build-gamedistribution-review.zip for technical review.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "gamemonetize",
    title: "GameMonetize review",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:gamemonetize",
    summary: "Create a neutral HTML5 archive for GameMonetize account and SDK review.",
    externalEffect: "None; game creation, GameId issuance, SDK integration, upload and activation remain authenticated provider steps.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "gamemonetize"])}),
    handoff: "Create the provider game record, obtain its GameId, then integrate and validate the SDK before activation.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
  }),
  Object.freeze({
    target: "yandex",
    title: "Yandex Games review",
    boundary: "local-manual-handoff",
    publicCommand: "pnpm release:yandex",
    summary: "Create a neutral HTML5 archive for Yandex Games contract and integration review.",
    externalEffect: "None; developer registration, contract, mandatory SDK integration, Console upload and moderation remain manual.",
    command: Object.freeze({executable: "node", args: Object.freeze(["scripts/release/package-html5-platform.mjs", "yandex"])}),
    handoff: "Confirm contracting eligibility and obtain Console access before building the isolated mandatory SDK adapter.",
    runbook: "docs/research/html5-publishing-platforms-2026-09-20.md",
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
  for (const {target} of releasePlans) {
    results.push(await runPlatformRelease(target, {commandRunner, environment, log}));
  }
  return results;
}
