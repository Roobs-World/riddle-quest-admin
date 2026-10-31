import datetime,hashlib,json,pathlib,subprocess,zipfile
root=pathlib.Path('/home/craig-beswetherick/Documents/riddle-quest')
stage=root/'artifacts/current-source-readiness-2026-10-25/upload'
sha=lambda b:hashlib.sha256(b).hexdigest()
snapshot=root/'artifacts/current-source-readiness-2026-10-25/current-source-snapshot.json'
source=json.loads(snapshot.read_text());digest=source['sourceAfter']
assert digest=='638b7f64386297df7d547de3cba867f0c9c07fedd2b75989b0fc6cc7c7ea8619' and source['sourceBefore']==digest and source['sourceStable']
actual={str(p.relative_to(root/'builds/jest')):sha(p.read_bytes()) for p in sorted((root/'builds/jest').rglob('*')) if p.is_file()}
with zipfile.ZipFile(stage/'build.zip') as archive:
 assert archive.testzip() is None
 names=archive.namelist();files=[x for x in archive.infolist() if not x.is_dir()]
 assert 'index.html' in names and len(files)==419 and len(files)==len(actual)
 assert all(not n.startswith(('/','\\')) and '..' not in n.replace('\\','/').split('/') for n in names)
 zipped={x.filename:sha(archive.read(x)) for x in files}
 assert zipped==actual
manifest=json.dumps(actual,indent=2)+'\n';(stage/'artifact-files.json').write_text(manifest)
prepared={'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'prepared-not-uploaded','buildVersion':'1.0.0-dev.20261025-maintenance-638b7f643862','gameId':'019faa68-f3ec-755d-9ab5-c887fb426801','activationRequested':False,'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'sourceDirty':True,'sourceDigest':digest,'sourceSnapshotSha256':sha(snapshot.read_bytes()),'archiveSha256':sha((stage/'build.zip').read_bytes()),'archiveBytes':(stage/'build.zip').stat().st_size,'archiveEntries':len(names),'regularFiles':len(files),'allExtractedBytesMatchTestedCanonicalBuild':True,'artifactFileManifestSha256':sha(manifest.encode()),'preflightLogSha256':sha((stage/'preflight.log').read_bytes()),'manualActiveVersionId':'01a17226-db08-708f-86a1-6733b1fe4824','indexSha256BeforeDelivery':sha((root/'.git/index').read_bytes()),'branchBeforeDelivery':subprocess.check_output(['git','branch','--show-current'],cwd=root,text=True).strip(),'gate':'Full final182-command and192-receipt proof required before transmission. Exact dirty-worktree provenance approved; no clean snapshot claim.'}
(stage/'preparation.json').write_text(json.dumps(prepared,indent=2)+'\n')
print(json.dumps({k:prepared[k] for k in ['status','sourceDigest','archiveSha256','archiveBytes','regularFiles','activationRequested']}))
