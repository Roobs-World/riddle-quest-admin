from pathlib import Path
import subprocess,json
r=Path.cwd();e=r/"artifacts/race-live-deck-compatibility-2026-10-05"
owned=json.loads((e/"owned-files.json").read_text()); paths={name:r/path for name,path in owned.items() if name!="sdk-test"}
fixed={name:path.read_bytes() for name,path in paths.items()}
for name,value in fixed.items():(e/(name+"-fixed.ts")).write_bytes(value)
try:
 for name,path in paths.items():path.write_bytes((e/(name+"-before.ts")).read_bytes())
 with (e/"red-emulator.log").open("w") as log:
  result=subprocess.run(["pnpm","exec","firebase","emulators:exec","--config",str(e/"emulator.json"),"--project","demo-race-live-deck-compatibility","--only","firestore,database","pnpm exec jest --config "+str(e/"probe.config.cjs")+" --runInBand > "+str(e/"red-sdk.log")+" 2>&1"],cwd=r/"firebase-functions",stdout=log,stderr=subprocess.STDOUT)
 assert result.returncode==1,result.returncode
finally:
 for name,path in paths.items():path.write_bytes(fixed[name])
assert all(path.read_bytes()==fixed[name] for name,path in paths.items())
print("Matching SDK baseline exit1; owned production bytes restored")
