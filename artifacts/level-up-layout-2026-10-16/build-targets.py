import json
import pathlib
import subprocess

out = pathlib.Path(__file__).parent
results = []
for target in ["jest", "facebook", "reddit", "youtube", "netflix", "yahoo"]:
    log = out / f"build-{target}.log"
    with log.open("w") as stream:
        result = subprocess.run(
            ["pnpm", "--filter", "@qwordly/portal", f"build:{target}"],
            stdout=stream,
            stderr=subprocess.STDOUT,
        )
    results.append({"target": target, "exitCode": result.returncode, "log": str(log)})
    (out / "build-results.json").write_text(json.dumps(results, indent=2) + "\n")
    print(f"{target}: {'PASS' if result.returncode == 0 else 'FAIL'}", flush=True)
