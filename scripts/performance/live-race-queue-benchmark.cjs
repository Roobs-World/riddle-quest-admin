/* eslint-disable @typescript-eslint/no-require-imports -- Measures the compiled Functions runtime. */
"use strict";
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const {createHash} = require("node:crypto");
const {createRequire} = require("node:module");
const backendRequire = createRequire(path.resolve(__dirname, "../../firebase-functions/package.json"));
const {initializeApp, deleteApp} = backendRequire("firebase-admin/app");
const {getFirestore, Timestamp} = backendRequire("firebase-admin/firestore");
const PROJECT = "demo-riddle-quest-queue-performance";
const NOW = 1_800_000_000_000;
const SCENARIOS = ["empty", "one-rival", "forty-last-eligible", "forty-blocked"];
const argumentsMap = Object.fromEntries(process.argv.slice(2).map(value => value.split("=")));
if (!/^(127\.0\.0\.1|localhost):[1-9][0-9]{1,4}$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? "") ||
  process.env.GCLOUD_PROJECT !== PROJECT || !argumentsMap.baseline || !argumentsMap.output)
  throw Error("Requires a loopback emulator, the dedicated demo project, baseline= and output=.");
const profileOnly = argumentsMap.profile === "true";
const concurrencyOnly = argumentsMap.concurrent === "true";
const baselinePath = path.resolve(argumentsMap.baseline);
const candidatePath = path.resolve(argumentsMap.candidate ?? argumentsMap.baseline);
const userId = index => `facebook_${(index + 1).toString(16).padStart(40, "0")}`;
const hash = value => createHash("sha256").update(value).digest("hex");
const ticketId = index => hash(`queue-performance-${index}`);
const pointerId = id => hash(`${id}\u0000active-live-race`);
const ownerId = userId(0);
const pool = hash("facebook:en:history");
const sorted = values => [...values].sort((a, b) => a - b);
const distribution = values => ({median: sorted(values)[Math.floor(values.length / 2)], min: Math.min(...values), max: Math.max(...values)});

function instrument(db, counters) {
  return new Proxy(db, {get(target, key) {
    if (key !== "runTransaction") {
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
    return (callback, options) => target.runTransaction(transaction => {
      counters.attempts++;
      return callback(new Proxy(transaction, {get(tx, member) {
        const value = Reflect.get(tx, member, tx);
        if (typeof value !== "function") return value;
        if (["get", "getAll"].includes(member)) return async (...args) => {
          counters.readCalls++;
          counters.documentReadAttempts += args.filter(argument => typeof argument?.path === "string").length;
          const started = performance.now();
          const result = await value.apply(tx, args);
          counters.readCompletions.push({member, documents: args.filter(argument => typeof argument?.path === "string").length,
            startedMs: started - counters.startedAt, elapsedMs: performance.now() - started});
          return result;
        };
        if (["create", "set", "update", "delete"].includes(member)) return (...args) => {
          counters.writes++;
          return value.apply(tx, args);
        };
        return value.bind(tx);
      }}));
    }, options);
  }});
}

async function main() {
  const app = initializeApp({projectId: PROJECT});
  const db = getFirestore(app);
  const baseline = require(path.join(baselinePath, "race/raceLiveService.js"));
  const candidate = require(path.join(candidatePath, "race/raceLiveService.js"));
  const {liveRun} = require(path.join(baselinePath, "race/raceLiveState.js"));
  const {requestDocumentId} = require(path.join(baselinePath, "race/raceSetupService.js"));
  if (pointerId(ownerId) !== requestDocumentId(ownerId, "active-live-race")) throw Error("Pointer fixture differs from production.");
  const riddles = Array.from({length: 15}, (_, position) => ({riddleId: `queue-riddle-${position}`,
    canonicalRiddleId: `history:queue-${position}`, text: `Historical clue for question ${position}`,
    answer: "answer", position}));
  const expiresAt = Timestamp.fromMillis(NOW + 7 * 86_400_000);
  const makeTicket = index => ({userId: userId(index), pool, waitForPlayer: true,
    createdAtMs: NOW - 1000 + index, seenAtMs: NOW,
    player: {displayName: `Queue player ${index}`, level: 1, avatarUrl: null, bot: false, correctCount: 0},
    run: liveRun({riddles, locale: "en", categoryId: "history", contentVersion: "queue-benchmark"}, userId(index), ticketId(index)), expiresAt});
  const reset = async () => {
    const response = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, {method: "DELETE"});
    if (!response.ok) throw Error(`Demo reset failed: ${response.status}`);
  };
  const seed = async scenario => {
    await reset();
    const count = scenario === "empty" ? 0 : scenario === "one-rival" ? 1 : 40;
    const batch = db.batch();
    for (let index = 0; index <= count; index++) {
      batch.set(db.doc(`users/${userId(index)}`), {username: `Queue player ${index}`, level: 1,
        coins: 100, unrelatedLargeProfile: "p".repeat(32_768)});
      batch.set(db.doc(`liveRaceTickets/${ticketId(index)}`), makeTicket(index));
      batch.set(db.doc(`liveRacePlayers/${pointerId(userId(index))}`), {ticketId: ticketId(index), expiresAt});
      if (index && (scenario === "forty-blocked" || scenario === "forty-last-eligible" && index < count))
        batch.set(db.doc(`users/${ownerId}/blockedRivals/${userId(index)}`), {blocked: true});
    }
    batch.set(db.doc(`liveRaceQueues/${pool}`), {tickets: Array.from({length: count}, (_, index) => ticketId(index + 1)), expiresAt});
    await batch.commit();
    return count;
  };
  const samples = [];
  const hostBefore = {loadAverage: os.loadavg(), cores: os.availableParallelism(), uptimeSeconds: os.uptime()};
  try {
    if (concurrencyOnly) {
      await reset();
      const batch = db.batch();
      for (let index = 0; index < 8; index++) batch.set(db.doc(`users/${userId(index)}`),
        {username: `Concurrent player ${index}`, level: 1, coins: 100, unrelatedLargeProfile: "p".repeat(32_768)});
      for (let index = 0; index < 30; index++) batch.set(db.doc(`localizedRiddles/en/riddles/queue-concurrent-${index}`), {
        riddleId: `queue-concurrent-${index}`, canonicalRiddleId: `history:queue-concurrent-${index}`, categoryId: "history",
        text: `Unique historical question ${index} follows its own trail`, answer: `a${String(index).padStart(6, "0")}`,
        difficultyBand: ["easy", "medium", "hard"][index % 3], raceEligible: true, qualityVersion: "human_review_v1",
      });
      await batch.commit();
      const started = performance.now();
      const joins = await Promise.all(Array.from({length: 8}, async (_, index) => {
        const counters = {readCalls: 0, documentReadAttempts: 0, writes: 0, attempts: 0, readCompletions: [], startedAt: performance.now()};
        const joinStart = performance.now();
        try {
          const response = await candidate.joinLiveRaceForUser(userId(index), {locale: "en", categoryId: "history",
            requestId: `queue-concurrent-join-${index}`, waitForPlayer: true, retirementAware: true},
          {db: instrument(db, counters), nowMs: NOW});
          return {userId: userId(index), status: "fulfilled", elapsedMs: performance.now() - joinStart,
            ticketId: response.ticketId, phase: response.phase, ...counters, startedAt: undefined};
        } catch (error) {
          return {userId: userId(index), status: "rejected", elapsedMs: performance.now() - joinStart,
            error: {name: error.name, message: error.message, code: error.code}, ...counters, startedAt: undefined};
        }
      }));
      const allJoinsElapsedMs = performance.now() - started;
      const [tickets, matches, profiles] = await Promise.all([db.collection("liveRaceTickets").get(),
        db.collection("liveRaceMatches").get(), db.collection("users").get()]);
      const participantIds = matches.docs.flatMap(snapshot => snapshot.data().participantIds ?? []);
      const expectedUsers = new Set(Array.from({length: 8}, (_, index) => userId(index)));
      const checks = {allJoinsSucceeded: joins.every(join => join.status === "fulfilled"), eightOwnedTickets: tickets.size === 8 &&
        new Set(tickets.docs.map(snapshot => snapshot.data().userId)).size === 8,
      fourHumanMatches: matches.size === 4 && matches.docs.every(snapshot => snapshot.data().tickets.every(Boolean)),
      eachPlayerMatchedOnce: participantIds.length === 8 && new Set(participantIds).size === 8 && participantIds.every(id => expectedUsers.has(id)),
      everyTicketAssigned: tickets.docs.every(snapshot => snapshot.data().matchId && matches.docs.some(match =>
        match.id === snapshot.data().matchId && match.data().tickets.includes(snapshot.id))),
      balancesUnchanged: profiles.size === 8 && profiles.docs.every(snapshot => snapshot.data().coins === 100)};
      const passed = Object.values(checks).every(Boolean);
      const report = {passed, mode: "eight-concurrent-real-joins", projectId: PROJECT, candidatePath,
        nodeVersion: process.version, hostBefore, hostAfter: {loadAverage: os.loadavg()}, allJoinsElapsedMs,
        successfulJoins: joins.filter(join => join.status === "fulfilled").length,
        failedJoins: joins.filter(join => join.status === "rejected").length,
        transactionAttempts: joins.reduce((total, join) => total + join.attempts, 0), checks, joins,
        limitations: ["One bounded correctness and latency run on local Firestore; no throughput or before/after claim.",
          "Transaction counters exclude content queries outside the transaction and include discarded retry writes.",
          "No hosted provider transport, cold starts or production traffic."]};
      await fs.writeFile(path.resolve(argumentsMap.output), `${JSON.stringify(report, null, 2)}\n`);
      process.stdout.write(`${JSON.stringify({passed, allJoinsElapsedMs, transactionAttempts: report.transactionAttempts, checks}, null, 2)}\n`);
      if (!passed) process.exitCode = 1;
      return;
    }
    // Warm both implementations and the emulator before recording alternating pairs.
    for (const implementation of [baseline, candidate]) {
      await seed("one-rival");
      await implementation.updateLiveRaceForUser(ownerId, {ticketId: ticketId(0), action: "poll", requestId: "queue-warmup"}, {db, nowMs: NOW});
    }
    for (const scenario of profileOnly ? ["forty-last-eligible"] : SCENARIOS) {
      for (let iteration = 0; iteration < (profileOnly ? 1 : 5); iteration++) {
        for (const side of profileOnly ? ["baseline"] : ["baseline", "candidate"]) {
          const candidateCount = await seed(scenario);
          const counters = {readCalls: 0, documentReadAttempts: 0, writes: 0, attempts: 0, readCompletions: [], startedAt: performance.now()};
          const measuredDb = instrument(db, counters);
          const implementation = side === "baseline" ? baseline : candidate;
          const cpuBefore = process.cpuUsage();
          const start = performance.now();
          const profileWindowStartUs = Number(process.hrtime.bigint() / 1000n);
          let response;
          let failure;
          try {response = await implementation.updateLiveRaceForUser(ownerId,
            {ticketId: ticketId(0), action: "poll", requestId: `queue-${side}-${iteration}`}, {db: measuredDb, nowMs: NOW});}
          catch (error) {failure = {name: error.name, message: error.message, code: error.code};}
          const elapsedMs = performance.now() - start;
          const profileWindowEndUs = Number(process.hrtime.bigint() / 1000n);
          const cpu = process.cpuUsage(cpuBefore);
          const shouldMatch = ["one-rival", "forty-last-eligible"].includes(scenario);
          const expectedRival = scenario === "one-rival" ? 1 : 40;
          const [owned, matches, queue, ownProfile] = await Promise.all([
            db.doc(`liveRaceTickets/${ticketId(0)}`).get(), db.collection("liveRaceMatches").get(),
            db.doc(`liveRaceQueues/${pool}`).get(), db.doc(`users/${ownerId}`).get()]);
          const correct = !failure && response.phase === (shouldMatch ? "countdown" : "searching") &&
            matches.size === (shouldMatch ? 1 : 0) && ownProfile.data().coins === 100 &&
            (!shouldMatch || owned.data().matchId === ticketId(expectedRival) &&
              matches.docs[0].data().participantIds.includes(ownerId) &&
              matches.docs[0].data().participantIds.includes(userId(expectedRival)) &&
              matches.docs[0].data().runs.every(run => JSON.stringify(run.riddles) === JSON.stringify(riddles))) &&
            queue.data().tickets.length <= 40;
          samples.push({scenario, iteration, side, elapsedMs, profileWindowStartUs, profileWindowEndUs, cpuMs: (cpu.user + cpu.system) / 1000,
            correct, failure, candidateCount, ...counters, startedAt: undefined});
        }
      }
    }
  } finally {await reset(); await db.terminate(); await deleteApp(app);}
  const summaries = SCENARIOS.flatMap(scenario => ["baseline", "candidate"].flatMap(side => {
    const rows = samples.filter(row => row.scenario === scenario && row.side === side);
    return rows.length ? [{scenario, side, successes: rows.filter(row => row.correct).length, failures: rows.filter(row => !row.correct).length,
      runs: rows.length, elapsedMs: distribution(rows.map(row => row.elapsedMs)), cpuMs: distribution(rows.map(row => row.cpuMs)),
      readCalls: distribution(rows.map(row => row.readCalls)), documentReadAttempts: distribution(rows.map(row => row.documentReadAttempts)),
      writes: distribution(rows.map(row => row.writes)), attempts: distribution(rows.map(row => row.attempts))}] : [];
  }));
  const passed = samples.every(row => row.correct);
  const report = {passed, projectId: PROJECT, emulatorHost: process.env.FIRESTORE_EMULATOR_HOST, nodeVersion: process.version,
    baselinePath, candidatePath, hostBefore, hostAfter: {loadAverage: os.loadavg()}, profileOnly, samples, summaries,
    limitations: ["Warm compiled production Functions on local Firestore emulator, synthetic 32 KiB account payloads, sequential requests.",
      "Counts are application document-read attempts and SDK read calls, not billed reads or network packet counts.",
      "No cloud network, cold starts, transport, hosted Facebook SDK, cross-instance contention or production SLO claim."]};
  await fs.writeFile(path.resolve(argumentsMap.output), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({output: argumentsMap.output, successes: samples.filter(row => row.correct).length,
    failures: samples.filter(row => !row.correct).length, summaries}, null, 2)}\n`);
  if (!passed) process.exitCode = 1;
}
main().catch(error => {process.stderr.write(`${error.stack}\n`); process.exitCode = 1;});
