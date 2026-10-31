"""Run retained browser acceptance against one immutable Jest artifact."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

root = Path(__file__).resolve().parents[2]
evidence = Path(__file__).resolve().parent / "compiled"
artifact = Path(sys.argv[1]).resolve()
evidence.mkdir(exist_ok=True)
previous = json.loads((root / "artifacts/jest-e2e-2026-10-22/browser-journal/retained-rerun/retained-browser-results.json").read_text())
suites = [str(Path(item["name"]).relative_to(root / "packages/portal")) for item in previous["testResults"]]
source_paths = [root / item["path"] for item in json.loads((evidence.parent / "runtime-before.json").read_text())["files"]]
source_paths += [root / "packages/portal" / name for name in suites]

def hashes(paths):
    return {str(p.relative_to(root)) if p.is_relative_to(root) else str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}

artifact_before = hashes(sorted(p for p in artifact.rglob("*") if p.is_file()))
source_before = hashes(source_paths)
shared = [Path(p) for p in ["/tmp/profile-tour-stats.png", "/tmp/jest-feedback-solo.png", "/tmp/jest-feedback-multiplayer-unavailable.png", "/tmp/riddle-leaderboard-clipped.png", "/tmp/riddle-leaderboard-fixed.png", "/tmp/jest-feedback-victory.png", "/tmp/jest-feedback-loss.png", "/tmp/jest-feedback-profile.png", "/tmp/riddle-settings-subscription.png", "/tmp/riddle-subscription-cancelled.png"]]
shared += [root / f"artifacts/coin-economy/shop-{width}.png" for width in [390, 1280]]
originals = {p: p.read_bytes() if p.exists() else None for p in shared}
env = dict(os.environ, PORTAL_BROWSER_TESTS="1", PORTAL_USE_EXISTING_BUILD="1", PORTAL_JEST_BUILD_DIR=str(artifact), PORTAL_JEST_LOAD_EVIDENCE_DIR=str(evidence / "load"))
(evidence / "load").mkdir(exist_ok=True)
started = time.monotonic()
try:
    with (evidence / "browser.log").open("w") as log:
        result = subprocess.run(["pnpm", "exec", "jest", "--config", "jest.config.cjs", "--runInBand", "--runTestsByPath", *suites, "--json", "--outputFile", str(evidence / "results.json")], cwd=root / "packages/portal", env=env, stdout=log, stderr=subprocess.STDOUT)
finally:
    for path, content in originals.items():
        if path.exists():
            shutil.copy2(path, evidence / path.name)
        if content is None:
            path.unlink(missing_ok=True)
        else:
            path.write_bytes(content)

data = json.loads((evidence / "results.json").read_text())
summary = {"exitCode": result.returncode, "elapsedSeconds": round(time.monotonic() - started, 3), "artifact": str(artifact), "artifactFiles": len(artifact_before), "artifactHashesUnchanged": artifact_before == hashes(sorted(p for p in artifact.rglob("*") if p.is_file())), "sourceHashesUnchanged": source_before == hashes(source_paths), "sharedScreenshotPathsRestored": len(shared), "counts": {key: data[key] for key in ["numPassedTestSuites", "numFailedTestSuites", "numPassedTests", "numFailedTests", "numPendingTests"]}}
(evidence / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
print(json.dumps(summary, indent=2), flush=True)
sys.exit(result.returncode or (0 if summary["artifactHashesUnchanged"] and summary["sourceHashesUnchanged"] else 1))
