import datetime,hashlib,json,os,pathlib,subprocess,sys,termios
os.umask(0o077)
root=pathlib.Path('/home/craig-beswetherick/Documents/riddle-quest')
stage=root/'artifacts/current-source-readiness-2026-10-25/upload'
checks_path=root/'artifacts/development-checks/current-source-20261025/checks-report.json'
receipts_path=root/'artifacts/development-checks/current-source-20261025/receipt-report.json'
sha=lambda b:hashlib.sha256(b).hexdigest()
prepared=json.loads((stage/'preparation.json').read_text())
checks=json.loads(checks_path.read_text());receipts=json.loads(receipts_path.read_text())
assert prepared['sourceDigest']==checks['sourceDigest']==receipts['sourceDigest']
assert receipts['status']=='passed' and receipts['selected']==192 and receipts['sourceStillMatches'] and receipts['priorRowsPreserved'] and receipts['otherQueriesPreserved']
assert receipts['checksReportSha256']==sha(checks_path.read_bytes())
assert checks['requiredCommandCount']==182 and checks['passedCommandCount']==182 and len(checks['checks'])==182
assert all(c['status']=='passed' and c['exitCode']==0 and c['sourceStillMatches'] and c['sourceBefore']==checks['sourceDigest']==c['sourceAfter'] for c in checks['checks'])
assert sha((stage/'build.zip').read_bytes())==prepared['archiveSha256']
assert sha((root/'artifacts/current-source-readiness-2026-10-25/current-source-snapshot.json').read_bytes())==prepared['sourceSnapshotSha256']
expected=json.loads((stage/'artifact-files.json').read_text())
actual={str(p.relative_to(root/'builds/jest')):sha(p.read_bytes()) for p in (root/'builds/jest').rglob('*') if p.is_file()}
assert actual==expected and len(actual)==419
node='/home/craig-beswetherick/.nvm/versions/node/v24.17.0/bin/node'
def source_digest():
 return subprocess.check_output([node,'--input-type=module','-e',"import{developmentSourceDigest}from'./scripts/release/development-source-digest.mjs';console.log(await developmentSourceDigest(process.cwd()));"],cwd=root,text=True).strip()
assert source_digest()==prepared['sourceDigest']
assert sha((root/'.git/index').read_bytes())==prepared['indexSha256BeforeDelivery']
settings=termios.tcgetattr(sys.stdin.fileno());settings[3]&=~termios.ECHO;termios.tcsetattr(sys.stdin.fileno(),termios.TCSANOW,settings)
print('Exact current-source proof passed. Ready for one scoped inactive-upload credential.',flush=True)
credential=json.loads(sys.stdin.readline())
assert credential['uploadUrl']=='https://jest.com/api/management/games/019faa68-f3ec-755d-9ab5-c887fb426801/upload-build'
assert credential['uploadToken'] and not any(c in credential['uploadToken'] for c in '\r\n')
assert source_digest()==prepared['sourceDigest']
lock=stage/'transmission.lock';fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);os.close(fd)
config=stage/'private-upload.curl'
attempt={'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'transmitting','gameId':prepared['gameId'],'buildVersion':prepared['buildVersion'],'isActive':False,'sourceCommit':prepared['sourceCommit'],'sourceDirty':True,'sourceDigest':prepared['sourceDigest'],'archiveSha256':prepared['archiveSha256'],'checksReportSha256':sha(checks_path.read_bytes()),'receiptReportSha256':sha(receipts_path.read_bytes()),'expectedManualActiveVersionId':prepared['manualActiveVersionId']}
(stage/'attempt.json').write_text(json.dumps(attempt,indent=2)+'\n')
lines=['url = '+json.dumps(credential['uploadUrl']),'request = "POST"','header = '+json.dumps('x-build-version: '+prepared['buildVersion']),'header = '+json.dumps('x-game-upload-token: '+credential['uploadToken']),'form = '+json.dumps('file=@'+str(stage/'build.zip')+';type=application/zip'),'form-string = "isActive=false"','form-string = '+json.dumps('description=Inactive maintenance candidate. Frozen source '+prepared['sourceDigest']+'. All 182 retained commands and 192 canonical task revalidations pass; strict client budget and final Continue browser cases pass. Manual active build is preserved. No review submission, activation or publication requested.'),'output = '+json.dumps(str(stage/'private-response.json')),'write-out = "%{http_code}"','connect-timeout = 15','max-time = 180','proto = "=https"','silent','show-error','fail-with-body']
fd=os.open(config,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as output:output.write('\n'.join(lines)+'\n')
try:
 result=subprocess.run(['curl','--disable','--config',str(config)],capture_output=True,text=True)
 status=result.stdout.strip();response_path=stage/'private-response.json'
 try:response=json.loads(response_path.read_text())
 except:response={}
 accepted=result.returncode==0 and status.startswith('2')
 version_id=response.get('versionId') or response.get('id')
 attempt.update({'completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'accepted-for-processing' if accepted else 'ambiguous-or-rejected-do-not-retry','curlExitCode':result.returncode,'httpStatus':status,'responseFields':list(response),'versionId':version_id,'sourceDigestAfter':source_digest(),'indexSha256AfterDelivery':sha((root/'.git/index').read_bytes())})
 (stage/'attempt.json').write_text(json.dumps(attempt,indent=2)+'\n')
 print(json.dumps({k:attempt[k] for k in ['status','curlExitCode','httpStatus','versionId','sourceDigestAfter']}),flush=True)
 if not accepted:sys.exit(1)
finally:
 config.unlink(missing_ok=True)
