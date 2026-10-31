import json, os, pathlib, subprocess, time
root=pathlib.Path("/home/craig-beswetherick/Documents/riddle-quest")
out=root/"artifacts/jest-e2e-2026-10-22/multiplayer"
env=os.environ.copy(); env.pop("DEBUG",None); env["NODE_OPTIONS"]="--experimental-vm-modules"
stages=[
("restored-integration-suites",root/"firebase-functions",["pnpm","exec","jest","--config","jest.rules.config.js","--runInBand","--runTestsByPath","src/__tests__/race/raceLivePublicWait.it.test.ts","src/__tests__/race/raceLiveStreamAdmission.it.test.ts","--json","--outputFile",str(out/"restored-integration-results.json")],{}),
("public-match-browser",root/"packages/portal",["node","scripts/verify-live-public-match-browser.mjs"],{"LIVE_PUBLIC_MATCH_REPORT_DIR":str(out/"public-match")}),
("invitations-browser",root/"packages/portal",["node","scripts/verify-live-race-invitations-browser.mjs"],{"LIVE_RACE_REPORT_DIR":str(out/"invitations"),"LIVE_RACE_TARGETS":"jest"}),
("live-race-browser",root/"packages/portal",["node","scripts/verify-live-race-browser.mjs"],{"LIVE_RACE_REPORT_DIR":str(out/"live-race"),"LIVE_RACE_USE_EMULATOR":"1"}),
]
results=[]
for name,cwd,cmd,extra in stages:
    print("START "+name,flush=True)
    start=time.time(); stage_env={**env,**extra}
    with (out/(name+".log")).open("w") as log:
        result=subprocess.run(cmd,cwd=cwd,env=stage_env,stdout=log,stderr=subprocess.STDOUT)
    results.append({"stage":name,"exitCode":result.returncode,"seconds":round(time.time()-start,3),"command":cmd,"environment":extra})
    (out/"emulator-stage-results.json").write_text(json.dumps(results,indent=2)+"\n")
    print("DONE "+name+" exit="+str(result.returncode),flush=True)
raise SystemExit(0 if all(r["exitCode"]==0 for r in results) else 1)
