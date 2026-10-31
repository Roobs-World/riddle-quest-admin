#!/usr/bin/env python3
"""Stage verified compiled Functions without deployment, source builds, or environment disclosure."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shlex
import shutil
import stat
import tempfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SOURCE = ROOT / "firebase-functions"
PLAN = json.loads((ROOT / "artifacts/human-wait-backend-deployment-plan-2026-10-18.json").read_text())
PROJECT = "riddle-quest-ec2b2"
NODE22 = "/home/craig-beswetherick/.nvm/versions/node/v22.23.1/bin/node"
CLI = SOURCE / "node_modules/firebase-tools/lib/bin/firebase.js"


def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


for item in PLAN["preparedFileHashes"]:
    for field, hash_field in [("source", "sourceSha256"), ("compiled", "compiledSha256"), ("deploymentCopy", "deploymentCopySha256")]:
        if field in item:
            assert digest(ROOT / item[field]) == item[hash_field], f"Prepared hash changed: {item[field]}"

stage = Path(tempfile.mkdtemp(prefix="riddle-quest-continuation-deploy-20261020-"))
os.chmod(stage, 0o700)
target = stage / "functions"
target.mkdir(mode=0o700)
try:
    shutil.copytree(SOURCE / "lib", target / "lib", ignore=shutil.ignore_patterns("__tests__", "__mocks__"))
    (target / "packages").mkdir()
    shutil.copytree(SOURCE / "packages/core", target / "packages/core")
    original_package = json.loads((SOURCE / "package.json").read_text())
    package = {**original_package, "scripts": {"gcp-build": ""}}
    assert package["main"] == "lib/index.js"
    assert package["engines"]["node"] == "22"
    assert package["dependencies"] == original_package["dependencies"]
    (target / "package.json").write_text(json.dumps(package, indent=2) + "\n")
    shutil.copyfile(SOURCE / "package-lock.json", target / "package-lock.json")
    lock = json.loads((target / "package-lock.json").read_text())
    lock_root = lock["packages"][""]
    for field in ["name", "dependencies", "devDependencies", "engines"]:
        assert lock_root.get(field) == package.get(field), f"Lock root metadata disagrees: {field}"
    assert "scripts" not in lock_root and "hasInstallScript" not in lock_root
    core_package = json.loads((target / "packages/core/package.json").read_text())
    core_lock = lock["packages"]["packages/core"]
    assert core_lock.get("version") == core_package.get("version")
    assert core_lock.get("dependencies", {}) == core_package.get("dependencies", {})
    assert lock["packages"]["node_modules/@qwordly/core"].get("link") is True
    env_copies = []
    for name in [".env", f".env.{PROJECT}"]:
        source_file = SOURCE / name
        assert source_file.is_file(), f"Required runtime environment file absent: {name}"
        destination = target / name
        destination.write_bytes(source_file.read_bytes())
        os.chmod(destination, 0o600)
        env_copies.append({"name": name, "copied": True, "matchesOriginalBytes": destination.read_bytes() == source_file.read_bytes(),
                           "mode": oct(stat.S_IMODE(destination.stat().st_mode))})
    assert sorted(file.name for file in target.glob(".env*")) == [".env", f".env.{PROJECT}"]
    (target / "node_modules").symlink_to(SOURCE / "node_modules", target_is_directory=True)
    (stage / "node_modules").symlink_to(ROOT / "node_modules", target_is_directory=True)
    config = {"functions": {"source": "functions", "runtime": "nodejs22", "ignore": ["node_modules", ".git", "*.log", ".env*", "**/__tests__/**", "**/__mocks__/**"]}}
    (stage / "firebase.json").write_text(json.dumps(config, indent=2) + "\n")
    files = []
    aggregate = hashlib.sha256()
    for directory in ["lib", "packages/core"]:
        for destination in sorted((target / directory).rglob("*")):
            if not destination.is_file():
                continue
            relative = destination.relative_to(target)
            original = SOURCE / relative
            original_hash = digest(original)
            copied_hash = digest(destination)
            assert original_hash == copied_hash, f"Copied runtime differs: {relative}"
            aggregate.update(str(relative).encode() + b"\0" + destination.read_bytes())
            files.append({"path": str(relative), "bytes": destination.stat().st_size, "sourceSha256": original_hash, "stagedSha256": copied_hash, "matchesOriginal": True})
    assert not list((target / "lib").rglob("__tests__")) and not list((target / "lib").rglob("__mocks__"))
    assert digest(SOURCE / "package-lock.json") == digest(target / "package-lock.json")
    selectors = ",".join(PLAN["deploymentSelectors"])
    command = [NODE22, str(CLI), "deploy", "--project", PROJECT, "--non-interactive", "--config", str(stage / "firebase.json"), "--only", selectors]
    command_text = shlex.join(command)
    cleanup_env = shlex.join(["rm", "--", str(target / ".env"), str(target / f".env.{PROJECT}")])
    report = {"preparedAt": datetime.now(timezone.utc).isoformat(), "project": PROJECT, "stageDirectory": str(stage),
              "stageDirectoryMode": oct(stat.S_IMODE(stage.stat().st_mode)), "functionSourceDirectoryMode": oct(stat.S_IMODE(target.stat().st_mode)),
              "deploymentPerformed": False, "testsRun": False, "exactFunctionSelectors": PLAN["deploymentSelectors"],
              "configSha256": digest(stage / "firebase.json"), "config": config,
              "stagedPackageSha256": digest(target / "package.json"), "originalPackageSha256": digest(SOURCE / "package.json"),
              "packageLockSha256": digest(target / "package-lock.json"), "packageLockByteIdentical": True,
              "packageLockMetadataChangeRequired": False,
              "vendoredCoreLockVersionDependenciesAndLinkMatch": True,
              "packageLockExplanation": "The lock root tracks name, dependency maps, devDependency maps and engines, all unchanged. It contains neither scripts nor a root hasInstallScript marker; the lock is copied byte-for-byte without dependency resolution.",
              "packageChange": {"changedFields": ["scripts"], "stagedScripts": package["scripts"], "allOtherFieldsPreserved": all(package.get(key) == value for key, value in original_package.items() if key != "scripts")},
              "cloudBuildScriptDocumentation": "https://docs.cloud.google.com/docs/buildpacks/nodejs#execute_custom_build_steps_during_deployment",
              "environmentFiles": env_copies, "environmentValuesOrHashesRecorded": False,
              "nodeModulesDiscoverySymlink": str(SOURCE / "node_modules"), "nodeModulesExcludedFromUpload": True,
              "parentNodeModulesDiscoverySymlink": str(ROOT / "node_modules"),
              "parentNodeModulesOutsideFunctionSourceAndExcludedFromUpload": True,
              "runtimeFileCount": len(files), "runtimeByteCount": sum(item["bytes"] for item in files),
              "aggregateRuntimeSha256": aggregate.hexdigest(), "runtimeFingerprintAlgorithm": "Sorted lib files, then sorted packages/core files; update SHA-256 with relative UTF-8 path, NUL byte and exact file bytes.",
              "runtimeFiles": files, "copiedRuntimeVerifiedByteForByte": True,
              "deployCommand": command, "deployCommandShell": command_text, "deployCwd": str(stage),
              "cleanupEnvironmentCommandShell": cleanup_env,
              "cleanupWholeStageCommandShell": shlex.join(["rm", "-rf", "--", str(stage)])}
    (HERE / "staging-receipt.json").write_text(json.dumps(report, indent=2) + "\n")
    (HERE / "deploy-command.txt").write_text(command_text + "\n")
    (HERE / "cleanup-environment-command.txt").write_text(cleanup_env + "\n")
    print(json.dumps({"stageDirectory": str(stage), "runtimeFiles": len(files), "runtimeByteCount": report["runtimeByteCount"],
                      "aggregateRuntimeSha256": aggregate.hexdigest(), "allCopiedRuntimeMatches": True, "packageLockByteIdentical": True,
                      "environmentFilesCopiedAndPrivate": all(item["matchesOriginalBytes"] and item["mode"] == "0o600" for item in env_copies), "deploymentPerformed": False}))
except BaseException:
    shutil.rmtree(stage)
    raise
