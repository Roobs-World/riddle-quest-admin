import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.parse
import urllib.request
import zipfile

ROOT = Path('/home/craig-beswetherick/Documents/riddle-quest')
OUTPUT = ROOT / 'artifacts/testing-readiness-20261020/hosted-content'
REFERENCE = Path('/tmp/riddle-quest-testing-content-url.json')
OUTPUT.mkdir(parents=True, exist_ok=True)
entry_url = json.loads(REFERENCE.read_text())['contentUrl']
origin = urllib.parse.urlsplit(entry_url)
assert origin.scheme == 'https'
with zipfile.ZipFile(ROOT / 'packages/portal/build.zip') as archive:
    expected = {item.filename: archive.read(item) for item in archive.infolist() if not item.is_dir()}


def read_resource(item):
    name, content = item
    url = entry_url if name == 'index.html' else urllib.parse.urljoin(entry_url, name)
    request = urllib.request.Request(url, headers={'User-Agent': 'RiddleQuest-Readiness/1.0', 'Accept-Encoding': 'identity'})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            actual = response.read(len(content) + 1)
            content_type = response.headers.get_content_type()
            mime_valid = True
            if name.endswith('.js'):
                mime_valid = content_type in ['text/javascript', 'application/javascript']
            elif name.endswith('.css'):
                mime_valid = content_type == 'text/css'
            elif name.endswith('.html'):
                mime_valid = content_type == 'text/html'
            return {'path': name, 'status': response.status, 'contentType': content_type,
                    'bytes': len(actual), 'sha256': hashlib.sha256(actual).hexdigest(),
                    'matchesUploadedArchive': actual == content, 'browserCriticalMimeValid': mime_valid}
    except Exception as error:
        return {'path': name, 'errorType': type(error).__name__,
                'httpStatus': getattr(error, 'code', None), 'matchesUploadedArchive': False,
                'browserCriticalMimeValid': False}


with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
    resources = list(executor.map(read_resource, expected.items()))
failures = [item for item in resources if not item['matchesUploadedArchive'] or not item['browserCriticalMimeValid']]
sdk = {'url': 'https://cdn.jest.com/sdk/latest/jestsdk.js'}
try:
    request = urllib.request.Request(sdk['url'], headers={'User-Agent': 'RiddleQuest-Readiness/1.0'})
    with urllib.request.urlopen(request, timeout=30) as response:
        sdk.update({'status': response.status, 'contentType': response.headers.get_content_type(),
                    'nonemptyJavaScriptResponse': bool(response.read(256))})
    sdk['available'] = sdk['status'] == 200 and sdk['contentType'] in ['text/javascript', 'application/javascript'] and sdk['nonemptyJavaScriptResponse']
except Exception as error:
    sdk.update({'errorType': type(error).__name__, 'available': False})
report = {'activeVersionId': '01a1567e-c03d-712d-b40e-2ef13b822050',
          'scope': 'Read-only HTTPS static content comparison. No game execution, browser harness, identity, purchases or messages.',
          'host': origin.netloc, 'resourcesChecked': len(resources), 'allArchiveFilesMatch': not failures,
          'failures': failures, 'jestSdk': sdk, 'resources': resources,
          'ready': not failures and sdk['available']}
(OUTPUT / 'readback.json').write_text(json.dumps(report, indent=2) + '\n')
REFERENCE.unlink(missing_ok=True)
print(json.dumps({key: report[key] for key in ['resourcesChecked', 'allArchiveFilesMatch', 'failures', 'jestSdk', 'ready']}))
if not report['ready']:
    raise SystemExit(1)
