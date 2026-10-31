#!/usr/bin/env python3
"""Inspect release-revision errors while persisting only fixed categories and deployment metadata."""
from collections import Counter
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import re
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
release_dir = ROOT / "artifacts/continuation-release-20261020/backend"
released = json.loads((release_dir / "functions-after.json").read_text())
revisions = sorted({item["revision"] for item in released["functions"]})
services = sorted({item["id"].lower() for item in released["functions"]})
earliest = min(datetime.fromisoformat(item["updateTime"].replace("Z", "+00:00")) for item in released["functions"])
since = (earliest - timedelta(minutes=2)).isoformat()
revision_filter = " OR ".join(f"resource.labels.revision_name={json.dumps(value)}" for value in revisions)
service_filter = " OR ".join(f"resource.labels.service_name={json.dumps(value)}" for value in services)
query = f'resource.type="cloud_run_revision" severity>=ERROR timestamp>={json.dumps(since)} ({service_filter}) ({revision_filter})'
command = ["gcloud", "logging", "read", query, "--project", "riddle-quest-ec2b2", "--limit", "200", "--order", "asc", "--format", "json", "--quiet"]
process = subprocess.run(command, capture_output=True, text=True, timeout=120, check=False)
if process.returncode:
    report = {"readSucceeded": False, "exitCode": process.returncode, "checkedAt": datetime.now(timezone.utc).isoformat(), "rawMessageTextPersisted": False}
else:
    entries = json.loads(process.stdout)
    sanitized = []
    for entry in entries:
        payload = json.dumps({"text": entry.get("textPayload"), "json": entry.get("jsonPayload"), "http": entry.get("httpRequest")}, ensure_ascii=False).lower()
        if any(pattern in payload for pattern in ["cannot find module", "uncaught", "unhandledrejection", "unhandled rejection", "out of memory", "memory limit", "container failed", "startup probe failed", "failed to start and listen"]):
            category = "runtime-or-startup-failure"
        elif any(pattern in payload for pattern in ["daily generation incomplete", "immutable daily generation finished with missing locales"]):
            category = "daily-content-generation-incomplete"
        elif "daily scheduler failed while preparing immutable daily riddles" in payload:
            category = "daily-scheduler-content-failure"
        elif any(pattern in payload for pattern in ["unauthenticated", "invalid app check", "appcheck token", "app check token", "authentication required", "auth token was rejected"]):
            category = "auth-or-attestation-rejection"
        else:
            category = "unclassified-error-needs-review"
        labels = entry.get("resource", {}).get("labels", {})
        structured = entry.get("jsonPayload", {})
        diagnostics = {}
        if isinstance(structured, dict):
            for field in ["attemptCount", "failedLocaleCount", "generatedLocaleCount", "status"]:
                value = structured.get(field)
                if isinstance(value, int) and 0 <= value <= 10000:
                    diagnostics[field] = value
            for field in ["errorClass", "code"]:
                value = structured.get(field)
                if isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9_.-]{1,64}", value):
                    diagnostics[field] = value
            locales = structured.get("failedLocales")
            allowed = {"en", "es", "pt", "fr", "de", "ja", "ko", "hi", "ru", "tr", "ar", "id", "it", "nl", "pl", "vi"}
            if isinstance(locales, list) and all(value in allowed for value in locales):
                diagnostics["failedLocales"] = locales
            date = structured.get("challengeDate")
            if isinstance(date, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
                diagnostics["challengeDate"] = date
        sanitized.append({"timestamp": entry.get("timestamp"), "severity": entry.get("severity"),
                          "service": labels.get("service_name"), "region": labels.get("location"), "revision": labels.get("revision_name"),
                          "httpStatus": entry.get("httpRequest", {}).get("status"), "category": category, "diagnostics": diagnostics})
    counts = Counter(item["category"] for item in sanitized)
    report = {"readSucceeded": True, "checkedAt": datetime.now(timezone.utc).isoformat(), "earliestReleaseUpdateTime": earliest.isoformat(),
              "queryStartTime": since, "query": query, "limit": 200, "returnedEntries": len(entries), "limitReached": len(entries) == 200,
              "categories": dict(counts), "entries": sanitized, "rawMessageTextPersisted": False,
              "scope": "ERROR or higher Cloud Run logs for the 16 released revisions, starting two minutes before their earliest successful Functions update; messages inspected only in process memory and not saved."}
(HERE / "post-deploy-errors.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({key: report[key] for key in ["readSucceeded", "returnedEntries", "categories", "limitReached"] if key in report}))
if not report["readSucceeded"]:
    raise SystemExit(1)
