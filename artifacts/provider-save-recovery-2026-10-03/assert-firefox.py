import json
import shutil
from pathlib import Path

root = Path(__file__).resolve().parent
records = json.loads((root / 'firefox-final/firefox-mcp-records.json').read_text())
observations = []


def content(call_id):
    row = next(row for row in records if row['response']['id'] == call_id)
    assert not row['response']['result'].get('isError'), call_id
    return row['response']['result']['content'][0]['text']


def returned(call_id):
    return json.loads(json.loads(content(call_id).split('```json\n')[1].split('\n```')[0]))


def verify(case, values):
    for key, expected in values.items():
        actual = case[key]
        observations.append({'case': case['case'], 'name': key, 'actual': actual, 'expected': expected})
        assert actual == expected, (case['case'], key, actual, expected)


facebook = returned(9)
reddit = returned(26)
verify(facebook[0], {'draft': 'PIAN', 'durable': 'PIAN', 'attempts': 2, 'status': 'quiet', 'initializationsUnchanged': True, 'errors': [], 'unhandled': []})
verify(facebook[1], {'guesses': 1, 'completions': 1, 'activeGame': None, 'errors': [], 'unhandled': []})
verify(reddit[0], {'draft': 'PIAN', 'durablePIAN': False, 'attempts': 4, 'status': 'unsaved', 'retryVisible': True, 'enabled': True, 'fits': True, 'initializationsUnchanged': True, 'errors': [], 'unhandled': []})
verify(reddit[1], {'holding': True, 'status': 'saving', 'disabled': True, 'busy': 'true'})
verify(reddit[2], {'draft': 'PIA', 'status': 'saving'})
verify(reddit[3], {'draft': 'PIA', 'durable': 'PIA', 'status': 'quiet', 'gatewayOnly': True, 'errors': [], 'unhandled': []})
verify(reddit[4], {'guesses': 1, 'completions': 1, 'activeGame': None, 'errors': [], 'unhandled': []})
assert all(not row['response'].get('result', {}).get('isError') for row in records)
for call_id, name in [(16, 'firefox-final-reddit-unsaved.png'), (23, 'firefox-final-reddit-recovered.png')]:
    file = content(call_id).split('Screenshot saved to: ')[1].split(' (')[0]
    shutil.copyfile(file, root / name)
(root / 'firefox-assertions.json').write_text(json.dumps({'checks': len(observations), 'failures': [], 'observations': observations}, indent=2) + '\n')
print(json.dumps({'checks': len(observations), 'failures': []}))
