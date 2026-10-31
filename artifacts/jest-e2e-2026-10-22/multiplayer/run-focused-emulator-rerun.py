import json, os, pathlib, subprocess, time
root=pathlib.Path("/home/craig-beswetherick/Documents/riddle-quest")
out=root/"artifacts/jest-e2e-2026-10-22/multiplayer"
env=os.environ.copy();env.pop("DEBUG",None)
stages=[
("referral-replay-emulator",root,["node",str(out/"verify-referral-replay.cjs")],{}),
("live-race-browser-rerun",root/"packages/portal",["node","scripts/verify-live-race-browser.mjs"],{"LIVE_RACE_REPORT_DIR":str(out/"live-race-corrected-expectations"),"LIVE_RACE_USE_EMULATOR":"1"}),
]
results=[]
for name,cwd,cmd,extra in stages:
 print("START "+name,flush=True);start=time.time()
 with (out/(name+".log")).open("w") as log:
  result=subprocess.run(cmd,cwd=cwd,env={**env,**extra},stdout=log,stderr=subprocess.STDOUT)
 results.append({"stage":name,"exitCode":result.returncode,"seconds":round(time.time()-start,3),"command":cmd,"environment":extra})
 (out/"focused-emulator-rerun-results.json").write_text(json.dumps(results,indent=2)+"\n")
 print("DONE "+name+" exit="+str(result.returncode),flush=True)
raise SystemExit(0 if all(r["exitCode"]==0 for r in results) else 1)
