import json
import shutil
from pathlib import Path

root = Path(__file__).resolve().parent
main = json.loads((root / "firefox-mcp-records.json").read_text())
system = json.loads((root / "system-firefox/firefox-mcp-records.json").read_text())
observations = []


def content(records, call_id):
    row = next(row for row in records if row.get("response", {}).get("id") == call_id)
    return row["response"]["result"]["content"][0]["text"]


def returned(records, call_id):
    value = content(records, call_id).split("```json\n")[1].split("\n```")[0]
    return json.loads(json.loads(value))


def check(name, actual, expected):
    observations.append({"name": name, "actual": actual, "expected": expected})
    assert actual == expected, (name, actual, expected)


baseline = returned(main, 7)
transition = returned(main, 14)
probe = returned(main, 30)
check("baseline reproduces small keys", baseline["keyHeight"] < 32, True)
check("baseline uses a nonzero global transition", transition["transitionDuration"], "0.000001s")
check("baseline candidates keep the prior fitted height", all(c["height"] == 844 for trace in baseline["trace"] for c in trace["candidates"]), True)
check("controlled zero-duration probe resolves immediately", probe["transition"], "0s")
check("controlled probe restores usable key height", probe["keyHeight"] >= 32, True)
check("controlled probe releases the prior minimum height", all(c["height"] == 624 for trace in probe["trace"] for c in trace["candidates"]), True)

app = returned(main, 36)
os = returned(system, 15)
for records, name, expected_system in [(app, "app", False), (os, "system", True)]:
    layout = records[0]
    check(name + " measured viewport", [layout["width"], layout["height"]], [500, 494])
    check(name + " usable key height", layout["keys"] >= 32, True)
    check(name + " controls fit", layout["fits"], True)
    check(name + " no geometry interpolation", layout["transition"], "0s")
    check(name + " actual system preference", layout["systemReduced"], expected_system)
    check(name + " no page errors", layout["errors"], [])
    check(name + " no unhandled rejection", layout["unhandled"], [])
    check(name + " accepts native input", records[1]["draft"], "PIAN")
check("system-only case disables the app setting", os[0]["appReduced"], False)
check("repeated resize preserves the draft", os[2]["draft"], "PIAN")
check("repeated resize keeps usable keys", os[2]["keys"] >= 32, True)
check("native submission happens once", os[3]["guesses"], 1)
check("completion happens once", os[3]["completions"], 1)
check("completed draft is acknowledged clear", os[3]["activeGame"], None)
check("completion has no page errors", os[3]["errors"], [])
check("completion has no unhandled rejection", os[3]["unhandled"], [])
for records, call_id, name in [(main, 37, "firefox-de-app-short.png"), (system, 9, "firefox-ar-system-short.png")]:
    screenshot = content(records, call_id).split("Screenshot saved to: ")[1].split(" (")[0]
    shutil.copyfile(screenshot, root / name)
report = {"checks": len(observations), "failures": [], "observations": observations}
(root / "firefox-assertions.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"checks": len(observations), "failures": []}))
