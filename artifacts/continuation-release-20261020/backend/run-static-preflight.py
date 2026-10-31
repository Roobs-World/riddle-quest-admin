#!/usr/bin/env python3
"""Compile and check only the prepared backend cohort, without test-running wrappers."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
FUNCTIONS = ROOT / "firebase-functions"
NODE22 = "/home/craig-beswetherick/.nvm/versions/node/v22.23.1/bin/node"
PLAN = ROOT / "artifacts/human-wait-backend-deployment-plan-2026-10-18.json"
plan = json.loads(PLAN.read_text())
compiler_shim = (FUNCTIONS / "node_modules/.bin/tsc").read_text()
compiler_target = next(line.removeprefix("# cmd-shim-target=") for line in compiler_shim.splitlines() if line.startswith("# cmd-shim-target="))


def fingerprints():
    checks = []
    for item in plan["preparedFileHashes"]:
        for field, hash_field in [("source", "sourceSha256"), ("compiled", "compiledSha256"), ("deploymentCopy", "deploymentCopySha256")]:
            if field not in item:
                continue
            file = ROOT / item[field]
            actual = hashlib.sha256(file.read_bytes()).hexdigest() if file.exists() else None
            checks.append({"path": item[field], "expectedSha256": item[hash_field], "actualSha256": actual, "matchesPreparedPlan": actual == item[hash_field]})
    return checks


before = fingerprints()
if not all(item["matchesPreparedPlan"] for item in before):
    (HERE / "hash-mismatch-before.json").write_text(json.dumps(before, indent=2) + "\n")
    raise SystemExit("Prepared hashes no longer match; inspect hash-mismatch-before.json before compiling.")

commands = [
    ("prepare-deploy", ["node", str(FUNCTIONS / "scripts/prepare-deploy.js")], ROOT, {}),
    ("typescript", [NODE22, compiler_target, "-p", "tsconfig.json"], FUNCTIONS, {}),
    ("deploy-environment", [NODE22, "scripts/validate-deploy-env.js"], FUNCTIONS, {"REQUIRE_REDDIT_DEPLOY_CONFIG": "1"}),
    ("module-cycles", [NODE22, "scripts/audit-module-cycles.mjs"], FUNCTIONS, {}),
    ("source-capacity", [NODE22, "scripts/audit-function-capacity.mjs"], ROOT, {}),
    ("compiled-capacity", [NODE22, "scripts/audit-function-capacity.mjs", "--built"], ROOT, {}),
    ("changed-runtime-eslint", [NODE22, "node_modules/eslint/bin/eslint.js", *[item["source"].removeprefix("firebase-functions/") for item in plan["preparedFileHashes"] if item["source"].startswith("firebase-functions/")]], FUNCTIONS, {}),
]
results = []
for label, command, cwd, overrides in commands:
    with (HERE / f"{label}.log").open("w") as log:
        result = subprocess.run(command, cwd=cwd, env={**os.environ, **overrides}, stdout=log, stderr=subprocess.STDOUT, check=False)
    results.append({"name": label, "command": command, "cwd": str(cwd), "exitCode": result.returncode, "log": f"{label}.log"})
    print(json.dumps({"check": label, "exitCode": result.returncode}), flush=True)
    if result.returncode:
        break

after = fingerprints()
report = {"verifiedAt": datetime.now(timezone.utc).isoformat(), "preparedPlan": str(PLAN.relative_to(ROOT)),
          "sourceRevision": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
          "includesDirtyWorkingTree": True, "testsRun": False, "deploymentRun": False, "checks": results,
          "hashesBefore": before, "hashesAfter": after,
          "allPreparedHashesStillMatch": all(item["matchesPreparedPlan"] for item in after),
          "verificationPassed": len(results) == len(commands) and all(item["exitCode"] == 0 for item in results) and all(item["matchesPreparedPlan"] for item in after)}
(HERE / "static-preflight.json").write_text(json.dumps(report, indent=2) + "\n")
if not report["verificationPassed"]:
    raise SystemExit(1)
