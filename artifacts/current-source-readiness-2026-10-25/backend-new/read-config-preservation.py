"""Read-only snapshots. Raw environment/binding values remain only in process memory."""
import concurrent.futures
import copy
import hashlib
import json
import pathlib
import subprocess
from datetime import datetime, timezone
PROJECT = 'riddle-quest-ec2b2'
TARGETS = [(name, region) for name in ['joinLiveRace', 'updateLiveRace'] for region in ['europe-west1', 'us-central1']] + [('redditGameplay', 'us-central1')]

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

def command(args):
    result = subprocess.run(['gcloud', *args, '--project', PROJECT, '--quiet'], capture_output=True, text=True, timeout=120)
    if result.returncode:
        raise RuntimeError('Read-only metadata command failed; raw output omitted')
    return json.loads(result.stdout)

def read_target(target):
    name, region = target
    raw = command(['functions', 'describe', name, '--gen2', '--region', region, '--format=json'])
    service_name = raw['serviceConfig']['service'].split('/')[-1]
    iam = command(['run', 'services', 'get-iam-policy', service_name, '--region', region, '--format=json'])
    service = copy.deepcopy(raw.get('serviceConfig', {}))
    build = copy.deepcopy(raw.get('buildConfig', {}))
    environment = service.pop('environmentVariables', {})
    build_environment = build.pop('environmentVariables', {})
    secret_environment = service.pop('secretEnvironmentVariables', [])
    secret_volumes = service.pop('secretVolumes', [])
    service.pop('revision', None)
    for field in ['build', 'source', 'sourceProvenance']:
        build.pop(field, None)
    policy = copy.deepcopy(iam)
    policy.pop('etag', None)
    for binding in policy.get('bindings', []):
        binding['members'] = sorted(binding.get('members', []))
    policy['bindings'] = sorted(policy.get('bindings', []), key=lambda item: json.dumps(item, sort_keys=True))
    safe = {
        'function': name, 'region': region, 'state': raw.get('state'),
        'revision': raw['serviceConfig'].get('revision'),
        'rollbackSource': raw['buildConfig']['source']['storageSource'],
        'runtimeAndScaling': {key: raw['serviceConfig'].get(key) for key in ['maxInstanceCount', 'minInstanceCount', 'availableMemory', 'availableCpu', 'timeoutSeconds', 'maxInstanceRequestConcurrency', 'allTrafficOnLatestRevision']},
        'runtime': raw['buildConfig'].get('runtime'),
        'runtimeConfigExcludingEnvironmentAndSecretsSha256': digest(service),
        'buildConfigExcludingSourceAndEnvironmentSha256': digest(build),
        'triggerConfigSha256': digest(raw.get('eventTrigger')),
        'labelsSha256': digest(raw.get('labels', {})),
        'cloudRunIamPolicySha256': digest(policy),
        'environmentVariableCount': len(environment),
        'buildEnvironmentVariableCount': len(build_environment),
        'secretEnvironmentBindingCount': len(secret_environment), 'secretVolumeCount': len(secret_volumes),
        'buildSelectorPresent': 'GOOGLE_NODE_RUN_SCRIPTS' in build_environment,
        'buildSelectorExactlyEmpty': build_environment.get('GOOGLE_NODE_RUN_SCRIPTS') == '',
        'rawEnvironmentOrSecretValuesRecorded': False,
    }
    return {'safe': safe, 'private': {'environment': environment, 'buildEnvironment': build_environment, 'secretEnvironment': secret_environment, 'secretVolumes': secret_volumes}}

def read_all():
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        return list(pool.map(read_target, TARGETS))

def compare(before, after):
    comparisons = []
    for old, new in zip(before, after):
        private_equal = {key: old['private'][key] == new['private'][key] for key in old['private']}
        safe_keys = ['runtime', 'runtimeAndScaling', 'runtimeConfigExcludingEnvironmentAndSecretsSha256', 'buildConfigExcludingSourceAndEnvironmentSha256', 'triggerConfigSha256', 'labelsSha256', 'cloudRunIamPolicySha256']
        comparisons.append({'function': old['safe']['function'], 'region': old['safe']['region'], 'privateConfigPreserved': private_equal, 'nonSourceConfigPreserved': {key: old['safe'][key] == new['safe'][key] for key in safe_keys}})
    return comparisons

if __name__ == '__main__':
    result = read_all()
    report = {'readAt': datetime.now(timezone.utc).isoformat(), 'project': PROJECT, 'functions': [item['safe'] for item in result], 'scope': 'Read-only current function config and Cloud Run IAM policy. No environment, binding or IAM member values are written; only safe digests/counts and build-selector predicates.'}
    destination = pathlib.Path(__file__).with_name('config-preservation-before-safe.json')
    destination.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'instances': len(result), 'allActive': all(item['safe']['state']=='ACTIVE' for item in result), 'allBuildSelectorsEmpty': all(item['safe']['buildSelectorExactlyEmpty'] for item in result), 'rawValuesRecorded': False}))
