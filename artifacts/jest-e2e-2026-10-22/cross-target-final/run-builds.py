import datetime,json,os,pathlib,re,subprocess,time
root=pathlib.Path("/home/craig-beswetherick/Documents/riddle-quest")
out=root/"artifacts/jest-e2e-2026-10-22/cross-target-final"
env=os.environ.copy();env.pop("DEBUG",None);env["SENTRY_UPLOAD_SOURCEMAPS"]="0"
commands=[("facebook",["pnpm","--dir","packages/portal","build:facebook"]),("reddit",["pnpm","--dir","packages/reddit-app","build:package"]),("youtube",["pnpm","--dir","packages/portal","build:youtube"]),("netflix",["pnpm","--dir","packages/portal","build:netflix"]),("yahoo",["pnpm","--dir","packages/portal","build:yahoo"]),("gamesnacks",["pnpm","--dir","packages/portal","build:gamesnacks"])]
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
status={"startedAt":now(),"complete":False,"sequential":True,"runtimeEdits":False,"canonicalJestBuild":False,"immutableSnapshotEdits":False,"deployments":False,"sourceMapUpload":False,"environment":{"SENTRY_UPLOAD_SOURCEMAPS":"0","DEBUG":"unset"},"results":[]}
if (out/"status.json").exists():raise SystemExit("Refusing to overwrite existing final verification results")
for target,command in commands:
 print("START "+target,flush=True);started=time.monotonic();entry={"target":target,"command":command,"startedAt":now(),"log":target+".log"}
 with (out/(target+".log")).open("w") as log:result=subprocess.run(command,cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT)
 text=(out/(target+".log")).read_text();entry.update({"exitCode":result.returncode,"status":"passed" if result.returncode==0 else "failed","completedAt":now(),"elapsedSeconds":round(time.monotonic()-started,3),"verificationSummary":[line.strip() for line in text.splitlines() if any(marker in line for marker in ["artifact audit passed:","Devvit package contract passed:","Prepared GameSnacks bundle"]) ]})
 passed=re.search(r"# pass (\d+)",text)
 if passed:entry["packageTestsPassed"]=int(passed.group(1))
 status["results"].append(entry);status["updatedAt"]=now();(out/"status.json").write_text(json.dumps(status,indent=2)+"\n");print("DONE "+target+" exit="+str(result.returncode),flush=True)
status["complete"]=True;(out/"status.json").write_text(json.dumps(status,indent=2)+"\n")
raise SystemExit(0 if all(row["exitCode"]==0 for row in status["results"]) else 1)
