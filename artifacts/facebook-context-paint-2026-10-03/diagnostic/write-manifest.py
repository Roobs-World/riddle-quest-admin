from pathlib import Path
import datetime, hashlib, json, subprocess

root = Path(__file__).resolve().parents[3]
reports = root / 'artifacts/facebook-context-paint-2026-10-03'
prior = root / 'artifacts/facebook-context-capabilities-2026-10-03/screenshots'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

full_pages = [p for p in prior.glob('*.png') if not p.name.endswith('.panel.png')]
assert len(full_pages) == 6 and len({sha(p) for p in full_pages}) == 1
for name in ['facebook-chooser-only-browser.log', 'facebook-full-sdk-browser.log']:
    assert '1 passed, 1 total' in (reports / name).read_text()
for name in ['chooser-only-pixels.log', 'full-sdk-pixels.log']:
    assert json.loads((reports / name).read_text())['painted'] is True
fresh = sorted((reports / 'screenshots').glob('*.png'))
assert len(fresh) == 2 and {sha(p) for p in fresh} == {sha(full_pages[0])}
sources = [
    'packages/portal/src/facebook/__tests__/raceDialogs.jest-playwright.support.ts',
    'packages/portal/src/facebook/__tests__/facebookBrowser.jest-playwright.test.ts',
    'docs/evidence/facebook-context-capture-check-2026-10-03.md',
    'docs/evidence/facebook-context-capabilities-2026-10-03.md',
]
manifest = {
    'generatedAtUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
    'sourceBuildProvenanceConfirmed': False,
    'uploadEligible': False,
    'deploymentPerformedByThisChat': False,
    'providerWritesPerformedByThisChat': False,
    'previousCaptureDefectInferenceWithdrawn': True,
    'retainedFullPageHash': sha(full_pages[0]),
    'retainedByteIdenticalFullPages': len(full_pages),
    'freshFacebookBrowserVariants': 2,
    'freshPixelProbesPassed': 2,
    'broaderChecks': 'Six-target/Reddit/selected Jest evidence belongs to preceding context-capability report, not this harness-only cleanup.',
    'sources': [{'path': name, 'sha256': sha(root / name)} for name in sources],
    'evidence': [{'path': str(file.relative_to(reports)), 'sha256': sha(file)}
                 for file in sorted(reports.rglob('*')) if file.is_file() and file.name != 'manifest.json'],
}
(reports / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'manifest': 'written', 'previewInferenceWithdrawn': True, 'uploadEligible': False}))
