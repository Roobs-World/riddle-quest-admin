import json
import shutil
from pathlib import Path

out = Path(__file__).resolve().parent
records = json.loads((out / 'firefox-mcp-records.json').read_text())

def result(response_id):
    row = next(row for row in records if row['response'].get('id') == response_id)
    text = row['response']['result']['content'][0]['text']
    encoded = text.split('```json\n')[1].split('\n```')[0]
    return json.loads(json.loads(encoded))

german, arabic = result(29), result(42)
(out / 'firefox-de-observations.json').write_text(json.dumps(german, indent=2, ensure_ascii=False))
(out / 'firefox-ar-observations.json').write_text(json.dumps(arabic, indent=2, ensure_ascii=False))
checks = []

def check(case, field, actual, expected):
    checks.append(dict(case=case, field=field, actual=actual, expected=expected))
    assert actual == expected, (case, field, actual, expected)

for rows in [german[1:], arabic]:
    for row in rows:
        case = row['case']
        for field in ['messageMatches', 'retryLabelMatches', 'noticeFits', 'noticeAboveGame', 'controlsFit', 'documentFits', 'initializationsUnchanged']:
            if field in row:
                check(case, field, row[field], True)
        for field in ['errors', 'unhandled']:
            if field in row:
                check(case, field, row[field], [])
        if 'exhausted' in case:
            check(case, 'status', row['status'], 'unsaved')
            check(case, 'draft', row['draft'], 'PIAN')
            check(case, 'retryHeight', row['retryHeight'] >= 44, True)
        elif case.endswith('held-retry') and 'playable' not in case:
            for field, expected in [('status', 'saving'), ('visible', True), ('disabled', True), ('busy', 'true')]:
                check(case, field, row[field], expected)
        elif 'playable' in case:
            for field, expected in [('draft', 'PIANO'), ('checkpoint', 'PIANO'), ('visible', True)]:
                check(case, field, row[field], expected)
        elif 'latest-ack' in case:
            for field, expected in [('status', 'quiet'), ('notice', 0), ('draft', 'PIANO'), ('durable', 'PIANO')]:
                check(case, field, row[field], expected)
        elif 'completion' in case:
            for field, expected in [('guesses', 1), ('completions', 1), ('activeGame', None), ('status', 'quiet'), ('notice', 0)]:
                check(case, field, row[field], expected)
check('ar-exhausted', 'direction', arabic[0]['direction'], 'rtl')
check('de-actual-viewport', 'width', german[1]['width'], 500)
check('de-actual-viewport', 'height', german[1]['height'], 568)

for response_id, name in [(11, 'firefox-de-requested-280-actual-500x494.png'), (37, 'firefox-ar-500x832.png')]:
    row = next(row for row in records if row['response'].get('id') == response_id)
    text = row['response']['result']['content'][0]['text']
    source = text.split('Screenshot saved to: ')[1].split(' (')[0]
    shutil.copyfile(source, out / name)

(out / 'firefox-assertions.json').write_text(json.dumps(checks, indent=2))
print(f'{len(checks)} Firefox assertions passed')
