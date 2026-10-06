from pathlib import Path
import hashlib,json,re,subprocess,sys
r=Path.cwd();e=r/"artifacts/race-live-deck-compatibility-2026-10-05"
def read(name):return (e/name).read_text()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def counts(name,tests,suites):
 value=read(name)
 assert re.search(rf"Tests:\s+{tests} passed, {tests} total",value),name
 assert re.search(rf"Test Suites:\s+{suites} passed, {suites} total",value),name
subprocess.run([sys.executable,str(e/"source-manifest.py"),"source-report"],check=True)
source=json.loads(read("source-before.json"));assert len(source)==2379 and source==json.loads(read("source-report.json"))
assert re.search(r"Tests:\s+33 failed, 9 passed, 42 total",read("red-sdk.log"))
assert re.search(r"Tests:\s+4 failed, 1 passed, 5 total",read("red-unit-work.log"))
counts("green-sdk.log",42,1);counts("green-unit-work.log",5,1)
counts("backend-units.log",1674,135);counts("live-integrations.log",454,29);counts("node22-sdk.log",42,1)
counts("core-units-corrected.log",374,38);counts("portal-focused.log",121,7);counts("built-browser.log",8,3)
assert "Script exited successfully (code 0)" in read("emulator-run.log") and "Stopping Firestore Emulator" in read("emulator-run.log")
assert "[Pinned Functions runtime v"+(r/"firebase-functions/.nvmrc").read_text().strip()+"] retained live deck SDK compatibility" in read("node22-sdk.log")
for name in ["core-types.log","backend-types.log","portal-types.log","backend-lint.log"]:assert read(name)=="",name
assert "26154 declarations are documented across 1172 files" in read("tsdoc.log")
assert "Prepared deploy build artifact" in read("prepare-fixed.log")
core=json.loads(read("core-copies.json"));assert len(core)==24
for path,expected in core.items():assert sha(r/path)==expected,path
targets=["jest","facebook","reddit","youtube","netflix","yahoo"]
for target in targets:assert "artifact audit passed" in read("build-"+target+".log").lower(),target
assert read("builds-run.log").splitlines()==[target+" build passed" for target in targets]
assert "YOUTUBE_ALLOW_INCOMPLETE_CONTENT_FIXTURE=1" in read("build-youtube.log") and "audit:youtube-artifact:fixture" in read("build-youtube.log")
assert "expect(bufferedTransitionMs).toBeLessThan(100);" in (r/"packages/portal/src/play/__tests__/hostedBrowser.jest-playwright.test.ts").read_text()
built={str(p.relative_to(e/"built")):sha(p) for p in sorted((e/"built").rglob("*")) if p.is_file()};assert len(built)==1300 and built==json.loads(read("built-sha256.json"))
rows=json.loads(read("target-dependencies.json"));assert len(rows)==6
for row in rows:assert not (r/row["original"]).exists() and sha(r/row["preserved"])==row["sha256"]
cleanup=json.loads(read("cleanup.json"));assert cleanup=={"temporaryBuildRemoved":True,"ownedTargetMetadataPreservedAndRemoved":6,"ownedEmulatorsStopped":True}
assert not Path(read("build-root.txt").strip()).exists()
jobs=json.loads(read("owned-jobs.json"));assert len(jobs)==23 and all(j["status"]=="terminal" for j in jobs)
resolved={j["name"] for j in jobs if j["exitCode"]!=j["expectedExitCode"]};assert resolved=={"green-sdk-initial","tsdoc-command-preflight","tsdoc-declarations-probe","core-command-preflight"}
assert all(j.get("resolution") for j in jobs if j["name"] in resolved)
assert all(j["exitCode"]==0 for j in jobs if j["name"].startswith("final-"))
assert re.search(r"Tests:\s+2 failed, 23 passed, 25 total",read("green-sdk-initial.log"))
assert "Command \"audit:tsdoc\" not found" in read("tsdoc-probe.log")
assert "6 production declarations are undocumented" in read("tsdoc-probe-corrected.log")
assert "Can't find a root directory while resolving a config file path" in read("core-units.log")
owned=json.loads(read("owned-files.json"));assert len(owned)==5
for label,path in owned.items():assert (e/(label+"-after.ts")).read_bytes()==(r/path).read_bytes(),path
subprocess.run(["git","apply","--check","--reverse",str(e/"owned.diff")],check=True);subprocess.run(["git","diff","--check"],check=True)
summary={"goal":"active","change":"Validate complete retained frozen decks before new public/private/bot live matches; keep healthy matchmaking, available previews and bounded Unicode processing coherent while retaining accepted recovery and settlement.","newSdkCases":42,"matchingRedSdkFailures":33,"newUnitCases":5,"matchingRedUnitFailures":4,"backendUnitTests":1674,"backendUnitSuites":135,"emulatorTests":454,"emulatorSuites":29,"pinnedNode22SdkCases":42,"coreTests":374,"coreSuites":38,"portalFocusedTests":121,"portalFocusedSuites":7,"builtBrowserTests":8,"builtBrowserSuites":3,"types":["core","backend","portal"],"backendLint":"passed","tsdocDeclarations":26154,"tsdocFiles":1172,"sixBuilds":"passed","youtube":"fixture","stableSourceInputs":2379,"compiledCoreHashes":24,"preservedBuildFiles":1300,"ownedParentJobsTerminal":23,"resolvedPreflights":sorted(resolved),"cleanup":cleanup,"limits":"No measured network latency reduction or release certification; transaction retry with changing retained content was reviewed in source but not forced by this new suite."}
(e/"verification-summary.json").write_text(json.dumps(summary,indent=2)+"\n");print(json.dumps(summary,indent=2))
