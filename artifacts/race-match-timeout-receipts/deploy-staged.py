from pathlib import Path
import json, tempfile, shutil, subprocess, os, hashlib
repo=Path('/home/craig-beswetherick/Documents/riddle-quest')
source=repo/'firebase-functions'
stage=Path(tempfile.mkdtemp(prefix='riddle-quest-timeout-deploy-'))
try:
    target=stage/'functions';target.mkdir()
    for directory in ['lib','packages']:
        shutil.copytree(source/directory,target/directory)
    for filename in ['package-lock.json','.env.riddle-quest-ec2b2']:
        shutil.copy2(source/filename,target/filename)
    package=json.loads((source/'package.json').read_text())
    # This deployment consumes the already validated and built runtime snapshot.
    # Development build hooks depend on the workspace and must not run in this snapshot.
    package['scripts']={}
    (target/'package.json').write_text(json.dumps(package,indent=2)+'\n')
    (target/'node_modules').symlink_to(source/'node_modules',target_is_directory=True)
    (stage/'firebase.json').write_text(json.dumps({'functions':{'source':'functions','runtime':'nodejs22','ignore':['node_modules','.git','*.log']}}))
    digest=hashlib.sha256()
    for directory in ['lib','packages']:
        for file in sorted((source/directory).rglob('*')):
            if file.is_file():
                relative=file.relative_to(source)
                assert file.read_bytes()==(target/relative).read_bytes()
                digest.update(str(relative).encode()+b'\0'+file.read_bytes())
    (repo/'artifacts/race-match-timeout-receipts/staged-runtime.json').write_text(json.dumps({'runtimeSha256':digest.hexdigest(),'compiledCodeVerified':True,'project':'riddle-quest-ec2b2'},indent=2)+'\n')
    env=os.environ.copy();env['PATH']='/home/craig-beswetherick/.nvm/versions/node/v22.23.1/bin:'+env['PATH']
    result=subprocess.run(['/home/craig-beswetherick/.nvm/versions/node/v22.23.1/bin/node',str(source/'node_modules/firebase-tools/lib/bin/firebase.js'),'deploy','--project','riddle-quest-ec2b2','--non-interactive','--only','functions:startRaceRun,functions:readyRaceRun,functions:submitRaceGuess,functions:requestRaceHint,functions:skipRaceRiddle,functions:resumeRaceRun,functions:abandonRaceRun,functions:publishRaceChallenge,functions:getRaceOutcome,functions:findRaceMatch,functions:settleRaceDeadlines,functions:redditGameplay'],cwd=stage,env=env)
    raise SystemExit(result.returncode)
finally:
    shutil.rmtree(stage)
