#!/usr/bin/env python3
"""Read a bounded deployment cohort without collecting environment values or secrets."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess

PROJECT = "riddle-quest-ec2b2"
DUAL_REGION = ["joinLiveRace", "updateLiveRace", "retireLiveRaceJoin", "getLiveRaceChallenge", "listLiveRaceChallenges", "startRaceRun"]
SINGLE_REGION = ["redditGameplay", "dailyChallengeScheduler", "replenishClassicSupplyOnDemand", "retryClassicSupplyOnDemand"]
TARGETS = [(name, region) for name in DUAL_REGION for region in ["us-central1", "europe-west1"]] + [(name, "us-central1") for name in SINGLE_REGION]
FORMAT = "json(name,state,updateTime,buildConfig.runtime,buildConfig.build,buildConfig.source.storageSource,buildConfig.sourceProvenance.resolvedStorageSource,serviceConfig.revision,serviceConfig.allTrafficOnLatestRevision)"

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--phase", choices=["before", "after"], required=True)
parser.add_argument("--output-directory", default=str(Path(__file__).resolve().parent))
args = parser.parse_args()
output = Path(args.output_directory)
output.mkdir(parents=True, exist_ok=True)


def read_target(target):
    name, region = target
    command = ["gcloud", "functions", "describe", name, "--gen2", "--project", PROJECT, "--region", region, "--format", FORMAT, "--quiet"]
    process = subprocess.run(command, capture_output=True, text=True, timeout=120, check=False)
    if process.returncode:
        return {"id": name, "region": region, "readSucceeded": False, "exitCode": process.returncode}
    data = json.loads(process.stdout)
    build = data.get("buildConfig", {})
    service = data.get("serviceConfig", {})
    provenance = {"build": build.get("build"), "source": build.get("source"), "sourceProvenance": build.get("sourceProvenance")}
    fingerprint = hashlib.sha256(json.dumps(provenance, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return {"id": name, "region": region, "name": data.get("name"), "readSucceeded": True,
            "state": data.get("state"), "updateTime": data.get("updateTime"), "runtime": build.get("runtime"),
            "revision": service.get("revision"), "allTrafficOnLatestRevision": service.get("allTrafficOnLatestRevision"),
            "sourceProvenance": provenance, "sourceProvenanceSha256": fingerprint}


with ThreadPoolExecutor(max_workers=4) as executor:
    functions = list(executor.map(read_target, TARGETS))

failures = []
before = {}
if args.phase == "after":
    before_file = output / "functions-before.json"
    if before_file.exists():
        before = {(item["id"], item["region"]): item for item in json.loads(before_file.read_text())["functions"]}
    else:
        failures.append("Before metadata is absent; regional revision comparison cannot be established.")

for item in functions:
    if not item["readSucceeded"]:
        failures.append(f"{item['id']}:{item['region']}: metadata read failed with exit {item['exitCode']}")
        continue
    for field, expected in [("state", "ACTIVE"), ("runtime", "nodejs22"), ("allTrafficOnLatestRevision", True)]:
        if item.get(field) != expected:
            failures.append(f"{item['id']}:{item['region']}: {field} is not {expected!r}")
    if not item.get("revision") or not item.get("updateTime"):
        failures.append(f"{item['id']}:{item['region']}: revision or updateTime absent")
    if args.phase == "after" and before:
        prior = before.get((item["id"], item["region"]), {})
        item["previousRevision"] = prior.get("revision")
        item["revisionChanged"] = item["revision"] != prior.get("revision")
        if not item["revisionChanged"]:
            failures.append(f"{item['id']}:{item['region']}: regional revision has not changed")

report = {"project": PROJECT, "phase": args.phase, "readAt": datetime.now(timezone.utc).isoformat(),
          "expectedExportCount": 10, "expectedRegionalInstanceCount": 16, "functions": functions,
          "verificationPassed": not failures, "errors": failures,
          "sourceFingerprintMeaning": "SHA-256 of sanitized Cloud Functions build/source provenance metadata, not a deployed code-content digest.",
          "collectionScope": "Read-only gcloud functions describe for exactly the listed 16 instances; selected metadata excludes environment and secret settings."}
(output / f"functions-{args.phase}.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"phase": args.phase, "instancesRead": sum(item["readSucceeded"] for item in functions), "verificationPassed": not failures, "errors": failures}))
if failures:
    raise SystemExit(1)
