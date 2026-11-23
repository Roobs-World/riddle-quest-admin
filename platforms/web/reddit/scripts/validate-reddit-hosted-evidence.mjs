#!/usr/bin/env node
import {readFile} from "node:fs/promises";
import path from "node:path";
import {validateRedditHostedEvidence} from "./reddit-hosted-evidence.mjs";

const evidencePath = path.resolve(process.argv[2] ?? "docs/evidence/reddit-hosted-evidence.json");
let evidence;
try { evidence = JSON.parse(await readFile(evidencePath, "utf8")); }
catch { throw new Error("reddit-hosted-evidence-missing"); }
validateRedditHostedEvidence(evidence);
console.log("Reddit hosted evidence passed: deployment, artifact, approvals, roles, and three clients");
