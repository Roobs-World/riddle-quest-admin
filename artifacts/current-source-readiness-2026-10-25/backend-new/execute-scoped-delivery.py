"""Approved five-target source-only rollout; never persist raw CLI/config secrets."""
import concurrent.futures
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import subprocess
import tempfile
import time
from datetime import datetime, timezone
ROOT=pathlib.Path('/home/craig-beswetherick/Documents/riddle-quest')
OUT=pathlib.Path(__file__).parent
PRIVATE=pathlib.Path('/var/tmp/riddle-backend-surgical-20261025')
PLAN=json.loads((OUT/'backend-delivery-plan-summary.json').read_text())
PROJECT='riddle-quest-ec2b2'
ENV=dict(os.environ,DEBUG='',CLOUDSDK_CORE_LOG_HTTP='false',CLOUDSDK_CORE_DISABLE_FILE_LOGGING='true',TMPDIR=str(PRIVATE/'deploy-temp'))
pathlib.Path(ENV['TMPDIR']).mkdir(mode=0o700,exist_ok=True)
os.environ.update({k:ENV[k] for k in ['DEBUG','CLOUDSDK_CORE_LOG_HTTP','CLOUDSDK_CORE_DISABLE_FILE_LOGGING','TMPDIR']})
spec=importlib.util.spec_from_file_location('snapshots',OUT/'read-config-preservation.py')
snapshots=importlib.util.module_from_spec(spec);spec.loader.exec_module(snapshots)
RESULT={'startedAt':datetime.now(timezone.utc).isoformat(),'status':'preflight','targets':[],'gamePublicationChanged':False,'rawCliOrEnvironmentValuesPersisted':False}
class Stop(Exception): pass

def save(): (OUT/'targeted-backend-delivery.json').write_text(json.dumps(RESULT,indent=2)+'\n')
def event(phase,**fields):
    item={'at':datetime.now(timezone.utc).isoformat(),'phase':phase,**fields}
    with(OUT/'delivery-events.jsonl').open('a')as f:f.write(json.dumps(item)+'\n')
    print(json.dumps(item),flush=True)
def read(args):
    p=subprocess.run(['gcloud',*args,'--project',PROJECT,'--quiet'],capture_output=True,text=True,env=ENV)
    if p.returncode: raise Stop('Read-only verification command failed; raw output withheld')
    return json.loads(p.stdout)
def sha(data):return hashlib.sha256(data).hexdigest()
def files(directory):return {str(p.relative_to(directory)):sha(p.read_bytes())for p in directory.rglob('*')if p.is_file()}
def expected_stages():
    a=json.loads((OUT/'callables-isolated-candidate.json').read_text());b=json.loads((OUT/'reddit-isolated-candidate.json').read_text())
    olda=a['safeOriginalFileHashes'];newa=dict(olda)
    for item in a['exactChangedFiles']:newa[item['path']]=item['newSha256']
    census=next(x for x in json.loads((OUT/'deployed-build-behavior-census.json').read_text())['bundles']if x['function']=='redditGameplay')
    oldb=dict(census['safeRuntimeAssetHashes']);p=next(x for x in json.loads((OUT/'reddit-deployed-baseline-comparison.json').read_text())['functions']if x['function']=='redditGameplay');oldb.update(p['safePackageInputSha256']);newb=dict(oldb)
    for item in b['exactChangedFiles']:newb[item['path']]=item['newSha256']
    return {'callables-before':olda,'callables-candidate':newa,'reddit-before':oldb,'reddit-candidate':newb}
STAGES=expected_stages()
def check_stages():
    for name,wanted in STAGES.items():
        directory=PRIVATE/name
        if files(directory)!=wanted or any(p.is_symlink()for p in directory.rglob('*')):raise Stop('Stage bytes or membership changed')
    if(PRIVATE/'empty-upload.gcloudignore').read_bytes()!=b'':raise Stop('External ignore file changed')
def check_runtime():
    wanted=json.loads((OUT/'final-compiled-runtime-hashes.json').read_text())['compiledRuntimeSha256']
    for path,digest in wanted.items():
        p=ROOT/'firebase-functions'/path if path.startswith('lib/')else ROOT/path
        if sha(p.read_bytes())!=digest:raise Stop('Canonical runtime changed before rollout')
    return len(wanted)
def invoke(command,label):
    event('command-start',**label);start=time.monotonic()
    p=subprocess.Popen(command,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,env=ENV)
    while True:
        try: raw,_=p.communicate(timeout=30);break
        except subprocess.TimeoutExpired:event('building',elapsedSeconds=round(time.monotonic()-start),**label)
    code=p.returncode;del raw
    event('command-finished',exitCode=code,elapsedSeconds=round(time.monotonic()-start),**label)
    return code

def inventory():
    rows=read(['functions','list','--v2','--format=json(name,state,buildConfig.runtime,buildConfig.source.storageSource,serviceConfig.revision,serviceConfig.allTrafficOnLatestRevision)'])
    return {x['name']:x for x in rows}
def key_for(inv,target):
    ending='/locations/'+target['region']+'/functions/'+target['function']
    keys=[k for k in inv if k.endswith(ending)]
    if len(keys)!=1:raise Stop('Target does not uniquely exist in inventory')
    return keys[0]
def run_state(target):
    service=target['function'].lower();region=target['region']
    data=read(['run','services','describe',service,'--region',region,'--format=json'])
    template=data.get('spec',{}).get('template',{});specification=template.get('spec',{})
    def scaling(annotations):return {k:v for k,v in annotations.items()if 'scale'in k.lower()or 'cpu'in k.lower()}
    runtime={'serviceScaling':scaling(data.get('metadata',{}).get('annotations',{})),'templateScaling':scaling(template.get('metadata',{}).get('annotations',{})),'concurrency':specification.get('containerConcurrency'),'timeout':specification.get('timeoutSeconds'),'serviceAccount':specification.get('serviceAccountName'),'containerResources':[x.get('resources',{})for x in specification.get('containers',[])]}
    status=data.get('status',{});revision=status.get('latestReadyRevisionName')
    return {'runtime':runtime,'latestReadyRevision':revision,'ready':any(x.get('type')=='Ready'and x.get('status')=='True'for x in status.get('conditions',[])),'traffic':status.get('traffic',[])}
def source_and_build(target):
    data=read(['functions','describe',target['function'],'--gen2','--region',target['region'],'--format=json(buildConfig)'])['buildConfig']
    source=data.get('sourceProvenance',{}).get('resolvedStorageSource')or data['source']['storageSource']
    if not source.get('generation'):
        meta=read(['storage','objects','describe','gs://'+source['bucket']+'/'+source['object'],'--format=json(generation)']);source['generation']=meta['generation']
    build=data.get('build','');parts=build.split('/');region=parts[parts.index('locations')+1]if'locations'in parts else target['region']
    info=read(['builds','describe',parts[-1],'--region',region,'--format=json(status)'])
    if info.get('status')!='SUCCESS':raise Stop('Cloud Build is not successful')
    return source,build

def archive(target,wanted):
    source,build=source_and_build(target);uri='gs://'+source['bucket']+'/'+source['object']+'#'+str(source['generation'])
    import zipfile
    with tempfile.TemporaryDirectory(prefix='verify-safe-source-',dir=PRIVATE)as folder:
        path=pathlib.Path(folder)/'source.zip';p=subprocess.run(['gcloud','storage','cp',uri,str(path),'--quiet'],capture_output=True,text=True,env=ENV)
        if p.returncode:raise Stop('Immutable source read failed')
        with zipfile.ZipFile(path)as z:
            names={n for n in z.namelist()if not n.endswith('/')}
            if names!=set(wanted):raise Stop('Immutable deployed source membership differs')
            if any(sha(z.read(n))!=wanted[n]for n in wanted):raise Stop('Immutable deployed source bytes differ')
        digest=sha(path.read_bytes())
    return {'source':source,'archiveSha256':digest,'filesCompared':len(wanted),'allMatch':True,'build':build,'buildStatus':'SUCCESS','temporaryArchiveRemoved':True}

def verify(target,before,run_before,wanted):
    after=snapshots.read_target((target['function'],target['region']));equal=snapshots.compare([before],[after])[0]
    if not all(equal['privateConfigPreserved'].values())or not all(equal['nonSourceConfigPreserved'].values()):raise Stop('Non-source configuration or IAM changed')
    if after['safe']['state']!='ACTIVE':raise Stop('Function is not active')
    state=run_state(target)
    if not state['ready']or state['latestReadyRevision']!=after['safe']['revision']or state['runtime']!=run_before['runtime']:raise Stop('Cloud Run readiness or runtime/scaling changed')
    revision=read(['run','revisions','describe',after['safe']['revision'],'--region',target['region'],'--format=json(status.conditions)'])
    required=[x for x in revision.get('status',{}).get('conditions',[])if x.get('type')in['Ready','ContainerHealthy','ResourcesAvailable']]
    if not required or any(x.get('status')!='True'for x in required):raise Stop('Revision health not ready')
    active=[x for x in state['traffic']if x.get('percent',0)>0]
    if sum(x.get('percent',0)for x in active)!=100 or any(x.get('revisionName')!=after['safe']['revision']for x in active):raise Stop('Traffic is not entirely on verified revision')
    return {'safeAfter':after['safe'],'configurationEquality':equal,'cloudRun':state,'revisionReadyAndHealthy':True,'immutableSource':archive(target,wanted)}

try:
    check_stages();RESULT['canonicalRuntimeFilesRehashed']=check_runtime()
    reloc=json.loads((OUT/'verified-gates-119a3d/relocation-index.json').read_text())
    for row in reloc['entries']:
        if sha((ROOT/row['immutableLog']).read_bytes())!=row['logSha256']or sha((ROOT/row['immutableReceipt']).read_bytes())!=row['receiptSha256']:raise Stop('Immutable gate evidence changed')
    services=read(['services','list','--enabled','--format=json(config.name)']);enabled={x['config']['name']for x in services}
    if not {'run.googleapis.com','cloudbuild.googleapis.com','artifactregistry.googleapis.com','cloudfunctions.googleapis.com'}<=enabled:raise Stop('Required API is disabled; no API changes permitted')
    expected=json.loads((OUT/'config-preservation-before-safe.json').read_text())['functions'];before_rows=snapshots.read_all();baseline={(x['safe']['function'],x['safe']['region']):x for x in before_rows}
    for item in expected:
        current=baseline[(item['function'],item['region'])]['safe']
        for field in ['rollbackSource','runtimeConfigExcludingEnvironmentAndSecretsSha256','buildConfigExcludingSourceAndEnvironmentSha256','cloudRunIamPolicySha256','triggerConfigSha256','labelsSha256']:
            if current[field]!=item[field]:raise Stop('Live configuration/source changed since approval')
        if baseline[(item['function'],item['region'])]['private']['environment'].get('GOOGLE_APPLICATION_CREDENTIALS'):raise Stop('Custom credential-file dependency requires review before excluding restricted files')
    expected_order=[('updateLiveRace','europe-west1'),('joinLiveRace','europe-west1'),('updateLiveRace','us-central1'),('joinLiveRace','us-central1'),('redditGameplay','us-central1')]
    if [(x['function'],x['region'])for x in PLAN['targets']]!=expected_order:raise Stop('Target order changed')
    inv=inventory();RESULT['inventoryBeforeCount']=len(inv);RESULT['status']='rolling-out';save();event('preflight-passed',targets=5,runtimeFiles=243)
    for target in PLAN['targets']:
        name=target['function'];region=target['region'];label={'function':name,'region':region};before=baseline[(name,region)];run_before=run_state(target);is_reddit=name=='redditGameplay';candidate='reddit-candidate'if is_reddit else'callables-candidate';original='reddit-before'if is_reddit else'callables-before'
        check_stages();check_runtime();entry={'function':name,'region':region,'startedAt':datetime.now(timezone.utc).isoformat(),'command':target['command'],'rollbackCommand':target['rollbackCommand'],'safeBefore':before['safe'],'status':'deploying'};RESULT['targets'].append(entry);save()
        try:
            if invoke(target['command'],label)!=0:raise Stop('Target deployment command failed; raw CLI output withheld')
            event('verifying',**label);entry['verification']=verify(target,before,run_before,STAGES[candidate]);new_inv=inventory();key=key_for(inv,target)
            if set(new_inv)!=set(inv)or any(inv[k]!=new_inv[k]for k in inv if k!=key):raise Stop('Unselected function inventory/revision changed')
            inv=new_inv;entry['status']='verified';entry['completedAt']=datetime.now(timezone.utc).isoformat();save();event('target-verified',revision=entry['verification']['safeAfter']['revision'],**label)
        except Exception as error:
            reason=str(error)if isinstance(error,Stop)else'Unexpected verifier exception; raw details withheld';entry['status']='rolling-back';entry['failureReason']=reason;save();event('rollback-start',reason=reason,**label)
            entry['rollbackExitCode']=invoke(target['rollbackCommand'],{**label,'rollback':True})
            try:entry['rollbackVerification']=verify(target,before,run_before,STAGES[original]);entry['status']='rolled-back-and-stopped'
            except Exception:entry['status']='rollback-not-fully-verified-stopped'
            RESULT['status']='stopped-after-failure';save();raise Stop('Target verification failed; rollback attempted and sequence stopped')
    RESULT['status']='verified-complete';RESULT['completedAt']=datetime.now(timezone.utc).isoformat();RESULT['inventoryAfterCount']=len(inv);RESULT['allFiveVerifiedBeforeAdvancing']=True;RESULT['unselectedFunctionsUnchanged']=True;RESULT['safeOriginalRollbackStagesRetained']=True;save();event('delivery-complete',targets=5)
except Exception as error:
    if RESULT['status']!='stopped-after-failure':RESULT['status']='stopped-before-next-action'
    RESULT['safeFailureReason']=str(error)if isinstance(error,Stop)else'Unexpected execution exception; raw details withheld';save();event('stopped',reason=RESULT['safeFailureReason']);raise SystemExit(1)
