import argparse
import concurrent.futures
import copy
import datetime
import hashlib
import json
import os
import pathlib
import re
import subprocess
import tempfile
import time
import zipfile

ROOT = pathlib.Path('/home/craig-beswetherick/Documents/riddle-quest')
PRIVATE = pathlib.Path('/tmp/riddle-legacy-security-20261024')
STAGE = PRIVATE / 'stage'
OUT = ROOT / 'artifacts/goal-completion-2026-10-24/riddle/backend/legacy'
PROJECT = 'riddle-quest-ec2b2'
NODE = '/home/craig-beswetherick/.nvm/versions/node/v22.23.1/bin/node'
NAMES = ['blockLiveRaceOpponent', 'reportLiveRaceOpponent', 'listLiveRaceHistoryPage']
TARGETS = sorted([(name, 'us-central1') for name in NAMES] + [('listLiveRaceHistoryPage', 'europe-west1')])
FULL_NAMES = {f'projects/{PROJECT}/locations/{region}/functions/{name}' for name, region in TARGETS}
SELECTORS = ','.join('functions:' + name for name in NAMES)
OPTIONS = ['availableMemory', 'availableCpu', 'timeoutSeconds', 'maxInstanceCount', 'minInstanceCount', 'maxInstanceRequestConcurrency', 'serviceAccountEmail', 'ingressSettings', 'vpcConnector', 'vpcConnectorEgressSettings']
SCALING = ['autoscaling.knative.dev/maxScale', 'autoscaling.knative.dev/minScale', 'run.googleapis.com/maxScale', 'run.googleapis.com/minScale', 'run.googleapis.com/scalingMode', 'run.googleapis.com/manualInstanceCount']
PROVIDER_ENV_KEYS = {'FIREBASE_CONFIG', 'GCLOUD_PROJECT', 'FUNCTION_TARGET', 'FUNCTION_REGION', 'FUNCTION_SIGNATURE_TYPE', 'LOG_EXECUTION_ID', 'EVENTARC_CLOUD_EVENT_SOURCE', 'K_SERVICE', 'K_REVISION', 'K_CONFIGURATION'}
SUCCESS_PATTERN = re.compile(r'✔  functions\[[A-Za-z0-9_-]+\([a-z0-9-]+\)\] Successful update operation\.')
ANSI_PATTERN = re.compile(r'\x1b\[[0-?]*[ -/]*[@-~]')
ENV = dict(os.environ)
for key in ['DEBUG', 'FIREBASE_DEBUG', 'FIREBASE_CLI_LOGGING', 'NODE_DEBUG', 'SNAP_COOKIE']:
    ENV.pop(key, None)
ARCHIVED_ENV = None
ENV_BASELINES = {}


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def run_read(args):
    result = subprocess.run(['gcloud', *args, '--project', PROJECT], env=ENV, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError('Read-only deployment metadata command failed; raw output was not forwarded')
    return json.loads(result.stdout)


def environment_observation(live, archived, baseline=None):
    application = {k: v for k, v in live.items() if k not in PROVIDER_ENV_KEYS}
    expected_application = {k: v for k, v in archived.items() if k not in PROVIDER_ENV_KEYS}
    result = {
        'applicationKeySetMatchesPreparedArchive': set(application) == set(expected_application),
        'applicationValuesMatchPreparedArchive': application == expected_application,
        'unexpectedApplicationKeyNames': sorted(set(application) - set(expected_application)),
        'missingApplicationKeyNames': sorted(set(expected_application) - set(application)),
        'applicationKeyCount': len(application),
        'completeEnvironmentKeyCount': len(live),
        'completeEnvironmentKeySetMatchesBefore': True,
        'completeEnvironmentValuesExactlyMatchBefore': True,
        'completeEnvironmentValuesSemanticallyMatchBefore': True,
        'providerManagedSerializationOnlyKeys': [],
    }
    if baseline is not None:
        result['completeEnvironmentKeySetMatchesBefore'] = set(live) == set(baseline)
        result['completeEnvironmentValuesExactlyMatchBefore'] = live == baseline
        differences = [k for k in set(live) | set(baseline) if live.get(k) != baseline.get(k)]
        allowed = []
        for key in differences:
            if key != 'FIREBASE_CONFIG' or key not in live or key not in baseline:
                continue
            try:
                if json.loads(live[key]) == json.loads(baseline[key]):
                    allowed.append(key)
            except (ValueError, TypeError):
                pass
        result['providerManagedSerializationOnlyKeys'] = sorted(allowed)
        result['completeEnvironmentValuesSemanticallyMatchBefore'] = result['completeEnvironmentKeySetMatchesBefore'] and set(differences) <= set(allowed)
    return result


def environment_ok(result):
    return result['applicationKeySetMatchesPreparedArchive'] and result['applicationValuesMatchPreparedArchive'] and result['completeEnvironmentKeySetMatchesBefore'] and result['completeEnvironmentValuesSemanticallyMatchBefore']


def scale(annotations):
    return {key: annotations[key] for key in SCALING if key in annotations}


def capture_one(target, phase):
    name, region = target
    fmt = 'json(name,state,buildConfig.runtime,buildConfig.source.storageSource,serviceConfig.service,serviceConfig.revision,serviceConfig.allTrafficOnLatestRevision,serviceConfig.availableMemory,serviceConfig.availableCpu,serviceConfig.timeoutSeconds,serviceConfig.maxInstanceCount,serviceConfig.minInstanceCount,serviceConfig.maxInstanceRequestConcurrency,serviceConfig.serviceAccountEmail,serviceConfig.ingressSettings,serviceConfig.vpcConnector,serviceConfig.vpcConnectorEgressSettings,serviceConfig.environmentVariables,serviceConfig.secretEnvironmentVariables)'
    fn = run_read(['functions', 'describe', name, '--gen2', '--region', region, '--format=' + fmt])
    assert fn['name'] in FULL_NAMES
    cfg = fn['serviceConfig']
    live_environment = cfg.get('environmentVariables', {})
    if phase == 'approved-before':
        ENV_BASELINES[fn['name']] = dict(live_environment)
        baseline = None
    else:
        baseline = ENV_BASELINES[fn['name']]
    observed_environment = environment_observation(live_environment, ARCHIVED_ENV, baseline)
    service = cfg['service'].split('/')[-1]
    svc = run_read(['run', 'services', 'describe', service, '--region', region, '--format=json(metadata.name,metadata.annotations,spec.template.metadata.annotations,status.latestReadyRevisionName,status.traffic)'])
    revision = cfg['revision']
    rev = run_read(['run', 'revisions', 'describe', revision, '--region', region, '--format=json(metadata.name,metadata.annotations,spec.containerConcurrency,spec.timeoutSeconds,spec.serviceAccountName)'])
    return {
        'name': fn['name'], 'region': region, 'functionState': fn['state'],
        'runtime': fn['buildConfig']['runtime'], 'source': fn['buildConfig']['source']['storageSource'],
        'revision': revision, 'allTrafficOnLatestRevision': cfg.get('allTrafficOnLatestRevision'),
        'functionRuntimeOptions': {key: cfg.get(key) for key in OPTIONS},
        'serviceScaling': scale(svc.get('metadata', {}).get('annotations', {})),
        'serviceTemplateScaling': scale(svc.get('spec', {}).get('template', {}).get('metadata', {}).get('annotations', {})),
        'revisionScaling': scale(rev.get('metadata', {}).get('annotations', {})),
        'revisionConcurrency': rev.get('spec', {}).get('containerConcurrency'),
        'revisionTimeoutSeconds': rev.get('spec', {}).get('timeoutSeconds'),
        'revisionServiceAccount': rev.get('spec', {}).get('serviceAccountName'),
        'environmentEquality': observed_environment,
        'secretBindingCount': len(cfg.get('secretEnvironmentVariables', [])),
        'trafficShape': [{'latestRevision': entry.get('latestRevision', False), 'percent': entry.get('percent', 0)} for entry in svc.get('status', {}).get('traffic', [])],
    }


def capture(phase):
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        rows = list(pool.map(lambda target: capture_one(target, phase), TARGETS))
    receipt = {'capturedAt': now(), 'phase': phase, 'project': PROJECT, 'instances': rows, 'completeEnvironmentMapsComparedPrivately': True, 'environmentOrSecretValuesAndTheirHashesRecorded': False}
    (OUT / (phase + '-runtime-and-scaling.json')).write_text(json.dumps(receipt, indent=2) + '\n')
    return receipt


COMPARE = ['runtime', 'allTrafficOnLatestRevision', 'functionRuntimeOptions', 'serviceScaling', 'serviceTemplateScaling', 'revisionScaling', 'revisionConcurrency', 'revisionTimeoutSeconds', 'revisionServiceAccount', 'trafficShape', 'secretBindingCount']


def differences(before, after):
    old = {x['name']: x for x in before['instances']}
    new = {x['name']: x for x in after['instances']}
    assert set(old) == set(new) and len(new) == 4
    return [{'name': name, 'field': key, 'before': old[name].get(key), 'after': new[name].get(key)} for name in sorted(old) for key in COMPARE if old[name].get(key) != new[name].get(key)]


def inventory(phase):
    rows = run_read(['functions', 'list', '--v2', '--format=json(name,state,buildConfig.runtime,buildConfig.source.storageSource,serviceConfig.revision,serviceConfig.allTrafficOnLatestRevision)'])
    assert len(rows) == 120 and FULL_NAMES <= {x['name'] for x in rows}
    (OUT / (phase + '-all-functions-inventory.json')).write_text(json.dumps({'capturedAt': now(), 'instances': rows, 'environmentValuesNotRequested': True}, indent=2) + '\n')
    return {x['name']: x for x in rows}


def guard():
    proof = json.load(open(OUT / 'preserving-manifest-offline-proof.json'))
    assert proof['maxAndMinInstanceFieldsNotPresentInApiUpdateMask']
    assert hashlib.sha256((STAGE / 'functions.yaml').read_bytes()).hexdigest() == proof['manifestSha256']
    assert {x['name'] for x in proof['regionalInstances']} == FULL_NAMES
    runtime_files = json.load(open(OUT / 'runtime-hashes.json'))
    assert len(runtime_files) == 513
    for name, wanted in runtime_files.items():
        assert hashlib.sha256((STAGE / name).read_bytes()).hexdigest() == wanted
    assert json.load(open(OUT / 'production-audit.json'))['metadata']['vulnerabilities']['total'] == 0
    return proof, runtime_files


def attest_archive(archive, runtime_files):
    aggregate = hashlib.sha256()
    with zipfile.ZipFile(archive) as z:
        for name in sorted(runtime_files):
            data = z.read(name)
            assert hashlib.sha256(data).hexdigest() == runtime_files[name]
            aggregate.update(name.encode() + b'\0' + data)
        components = {}
        for name in ['package.json', 'package-lock.json', 'functions.yaml']:
            data = z.read(name)
            assert data == (STAGE / name).read_bytes(), 'Deployed dependency or discovery manifest differs from approved stage'
            components[name] = hashlib.sha256(data).hexdigest()
    return {'runtimeAndVendoredCoreFiles': len(runtime_files), 'runtimeFilesAggregateSha256': aggregate.hexdigest(), 'componentSha256': components, 'allNonEnvironmentSourceComponentsMatchApprovedStage': True}


def verify_prepared_live_sources(before, runtime_files):
    prepared = json.load(open(PRIVATE / 'sources.json'))
    expected = {f"projects/{PROJECT}/locations/{row['region']}/functions/{row['name']}": row for row in prepared}
    assert set(expected) == FULL_NAMES
    rows = []
    for item in before['instances']:
        source = item['source']
        live_uri = 'gs://' + source['bucket'] + '/' + source['object'] + '#' + str(source['generation'])
        retained = expected[item['name']]
        assert live_uri == retained['uri'], 'Live immutable source changed since dependency-only preparation; stop before writing'
        aggregate = hashlib.sha256()
        with zipfile.ZipFile(retained['archive']) as archive:
            for name in sorted(runtime_files):
                data = archive.read(name)
                assert hashlib.sha256(data).hexdigest() == runtime_files[name], 'Retained original runtime differs from approved stage; stop before writing'
                aggregate.update(name.encode() + b'\0' + data)
        rows.append({'name': item['name'], 'revision': item['revision'], 'sourceGeneration': source['generation'], 'liveImmutableSourceIdentityMatchesPreparedArchive': True, 'runtimeAndVendoredCoreFiles': len(runtime_files), 'runtimeFilesAggregateSha256': aggregate.hexdigest(), 'retainedOriginalRuntimeMatchesApprovedStage': True})
    receipt = {'attestedAt': now(), 'regionalInstances': rows, 'allFourLiveImmutableSourceIdentitiesMatchPreparation': len(rows) == 4, 'environmentFilesNotReadOrHashed': True}
    (OUT / 'approved-before-source-attestation.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return receipt


def attest_deployed_sources(after, runtime_files):
    directory = PRIVATE / 'approved-post-deploy-source'
    directory.mkdir(mode=0o700, exist_ok=True)
    rows = []
    for item in after['instances']:
        source = item['source']
        assert re.fullmatch(r'gcf-v2-sources-329028367192-(us-central1|europe-west1)', source['bucket'])
        uri = 'gs://' + source['bucket'] + '/' + source['object'] + '#' + str(source['generation'])
        destination = directory / (item['region'] + '-' + item['name'].split('/')[-1] + '.zip')
        result = subprocess.run(['gcloud', 'storage', 'cp', uri, str(destination), '--project', PROJECT], env=ENV, capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError('Immutable deployed-source attestation download failed; raw output was not forwarded')
        destination.chmod(0o600)
        rows.append({'name': item['name'], 'revision': item['revision'], 'sourceGeneration': source['generation'], **attest_archive(destination, runtime_files)})
    receipt = {'attestedAt': now(), 'regionalInstances': rows, 'environmentFilesNotReadOrHashed': True}
    (OUT / 'approved-deployed-source-attestation.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return receipt


def self_test():
    proof, runtime_files = guard()
    fixture = {'instances': [{'name': name, 'runtime': 'nodejs22', 'functionRuntimeOptions': {'maxInstanceCount': None}, 'serviceScaling': {'run.googleapis.com/maxScale': '20'}, 'revisionScaling': {}} for name in sorted(FULL_NAMES)]}
    assert differences(fixture, copy.deepcopy(fixture)) == []
    cases = 1
    for field, value in [('functionRuntimeOptions', {'maxInstanceCount': 20}), ('serviceScaling', {'run.googleapis.com/maxScale': '10'}), ('revisionScaling', {'autoscaling.knative.dev/maxScale': '20'})]:
        mutated = copy.deepcopy(fixture)
        mutated['instances'][0][field] = value
        assert any(row['field'] == field for row in differences(fixture, mutated))
        cases += 1
    archived = {'EXAMPLE_APP_KEY': 'synthetic'}
    live = {**archived, 'GCLOUD_PROJECT': PROJECT, 'FIREBASE_CONFIG': '{"projectId":"example","storageBucket":"example"}'}
    assert environment_ok(environment_observation(live, archived, dict(live))); cases += 1
    extra = {**live, 'UNEXPECTED_TEST_APPLICATION_KEY': 'synthetic'}
    assert not environment_ok(environment_observation(extra, archived)); cases += 1
    missing = dict(live); missing.pop('EXAMPLE_APP_KEY')
    assert not environment_ok(environment_observation(missing, archived, live)); cases += 1
    changed = {**live, 'EXAMPLE_APP_KEY': 'changed synthetic'}
    assert not environment_ok(environment_observation(changed, archived, live)); cases += 1
    serialized = {**live, 'FIREBASE_CONFIG': '{"storageBucket":"example","projectId":"example"}'}
    assert environment_ok(environment_observation(serialized, archived, live)); cases += 1
    assert SUCCESS_PATTERN.fullmatch('✔  functions[blockLiveRaceOpponent(us-central1)] Successful update operation.'); cases += 1
    assert not SUCCESS_PATTERN.fullmatch('unrelated text'); cases += 1
    with tempfile.TemporaryDirectory(prefix='legacy-attestation-selftest-', dir=PRIVATE) as folder:
        archive = pathlib.Path(folder) / 'source.zip'
        with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
            for name in runtime_files:
                z.writestr(name, (STAGE / name).read_bytes())
            for name in ['package.json', 'package-lock.json', 'functions.yaml']:
                z.writestr(name, (STAGE / name).read_bytes())
        assert attest_archive(archive, runtime_files)['allNonEnvironmentSourceComponentsMatchApprovedStage']; cases += 1
        invalid = pathlib.Path(folder) / 'invalid.zip'
        with zipfile.ZipFile(archive) as original, zipfile.ZipFile(invalid, 'w', zipfile.ZIP_DEFLATED) as z:
            for name in original.namelist():
                z.writestr(name, b'{}' if name == 'package-lock.json' else original.read(name))
        try:
            attest_archive(invalid, runtime_files)
            raise RuntimeError('Corrupt lock was accepted')
        except AssertionError:
            cases += 1
    print(json.dumps({'selfTestCases': cases, 'allPassed': True, 'cloudCalls': 0, 'productionWrites': 0}))


parser = argparse.ArgumentParser()
parser.add_argument('--execute-after-explicit-user-approval', action='store_true')
parser.add_argument('--approval-reference')
parser.add_argument('--self-test', action='store_true')
args = parser.parse_args()
if args.self_test:
    self_test()
    raise SystemExit(0)
if not args.execute_after_explicit_user_approval or not args.approval_reference:
    print('HELD: explicit user authorization for these four legacy production instances is required. No cloud calls or writes performed.')
    raise SystemExit(3)

proof, runtime_files = guard()
parse_code = "const fs=require('fs'),dotenv=require('node:module').createRequire('/home/craig-beswetherick/Documents/riddle-quest/firebase-functions/node_modules/firebase-tools/package.json')('dotenv');console.log(JSON.stringify(dotenv.parse(fs.readFileSync('.env.riddle-quest-ec2b2'))));"
parsed = subprocess.run([NODE, '-e', parse_code], cwd=STAGE, env=ENV, capture_output=True, text=True)
assert parsed.returncode == 0, 'Private archived environment parsing failed'
ARCHIVED_ENV = json.loads(parsed.stdout)
before_inventory = inventory('approved-before')
before = capture('approved-before')
assert all(x['functionState'] == 'ACTIVE' and x['runtime'] == 'nodejs22' and x['allTrafficOnLatestRevision'] and environment_ok(x['environmentEquality']) and x['secretBindingCount'] == 0 for x in before['instances']), 'Pre-deploy endpoint or complete application environment differs; stop before writing'
old_configs = {x['name']: x for x in json.load(open(ROOT / 'artifacts/goal-completion-2026-10-24/riddle/backend/function-config-before.json'))}
for row in before['instances']:
    expected = old_configs[row['name']]['serviceConfig']
    for key in ['availableMemory', 'timeoutSeconds', 'maxInstanceRequestConcurrency', 'serviceAccountEmail', 'ingressSettings', 'maxInstanceCount', 'minInstanceCount']:
        assert row['functionRuntimeOptions'][key] == expected.get(key), 'Runtime configuration changed since preserving manifest preparation; stop before writing'

before_source_attestation = verify_prepared_live_sources(before, runtime_files)

cli = ROOT / 'firebase-functions/node_modules/firebase-tools/lib/bin/firebase.js'
command = [NODE, str(cli), 'deploy', '--project', PROJECT, '--non-interactive', '--config', str(STAGE / 'firebase.json'), '--only', SELECTORS]
started = now(); timer = time.monotonic(); raw = PRIVATE / 'deployment-private.log'
with raw.open('w') as log:
    raw.chmod(0o600)
    result = subprocess.run(command, cwd=STAGE, env=ENV, stdout=log, stderr=subprocess.STDOUT)
lines = [ANSI_PATTERN.sub('', line) for line in raw.read_text().splitlines()]
safe = [line for line in lines if SUCCESS_PATTERN.fullmatch(line.strip()) or line.startswith('i  functions: updating Node.js 22 (2nd Gen) function ') or line.strip() == '✔  Deploy complete!']
public_log = OUT / 'deployment.log'
public_log.write_text('\n'.join(safe) + '\n')
after = capture('approved-after')
after_inventory = inventory('approved-after')
delta = differences(before, after)
assert set(before_inventory) == set(after_inventory)
untouched = [name for name in before_inventory if name not in FULL_NAMES and before_inventory[name] != after_inventory[name]]
old = {x['name']: x for x in before['instances']}
new_revisions = [x['name'] for x in after['instances'] if x['revision'] != old[x['name']]['revision']]
new_sources = [x['name'] for x in after['instances'] if x['source'] != old[x['name']]['source']]
healthy = all(x['functionState'] == 'ACTIVE' and x['allTrafficOnLatestRevision'] and environment_ok(x['environmentEquality']) and x['secretBindingCount'] == 0 for x in after['instances'])
attestation = attest_deployed_sources(after, runtime_files) if result.returncode == 0 else None
report = {
    'startedAt': started, 'completedAt': now(), 'exitCode': result.returncode, 'elapsedSeconds': round(time.monotonic() - timer, 3),
    'approvalReference': args.approval_reference, 'selectedExports': NAMES, 'expectedRegionalInstances': 4,
    'successfulUpdateMessages': sum(bool(SUCCESS_PATTERN.fullmatch(line.strip())) for line in safe),
    'newRevisions': new_revisions, 'newImmutableSourceGenerations': new_sources,
    'runtimeAndVendoredCoreFilesUnchanged': len(runtime_files), 'preservingManifestSha256': proof['manifestSha256'],
    'completeEnvironmentMapsComparedPrivately': True, 'environmentValuesOrHashesRecorded': False,
    'allFourBeforeImmutableSourcesMatchPreparation': before_source_attestation['allFourLiveImmutableSourceIdentitiesMatchPreparation'],
    'beforeAndAfterRuntimeScalingAttested': True, 'runtimeOrScalingDifferences': delta,
    'allFourActiveLatestAndEnvironmentPreserved': healthy, 'other116CurrentSourceInstancesUnchanged': not untouched,
    'unexpectedOtherInstanceChanges': untouched, 'allFourImmutableSourcesAttested': bool(attestation and len(attestation['regionalInstances']) == 4),
    'sanitizedStatusLogOnly': True, 'logSha256': hashlib.sha256(public_log.read_bytes()).hexdigest(),
    'lockSha256': hashlib.sha256((STAGE / 'package-lock.json').read_bytes()).hexdigest(),
}
passed = result.returncode == 0 and not delta and healthy and not untouched and len(new_revisions) == 4 and len(new_sources) == 4 and report['allFourImmutableSourcesAttested']
report['approvedDependencyOnlyDeliveryPassed'] = passed
(OUT / 'deployment.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
if passed:
    raw.unlink()
    for file in STAGE.glob('*debug*.log'):
        if file.is_file():
            file.unlink()
raise SystemExit(0 if passed else result.returncode or 1)
