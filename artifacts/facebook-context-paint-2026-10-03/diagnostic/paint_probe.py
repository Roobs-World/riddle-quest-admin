import json, sys
from pathlib import Path
from PIL import Image

image_path = Path(sys.argv[1])
metadata = json.loads(Path(sys.argv[2]).read_text())
panel = next(row for row in metadata['nodes'] if row['selector'] == '.race-context-panel')
assert metadata['screens'] == 1 and panel['visibility'] == 'visible' and panel['opacity'] == '1'
assert panel['background'] == 'rgb(255, 255, 255)', 'This probe verifies the existing light context panel.'
with Image.open(image_path) as img:
    pixels = img.convert('RGB')
    x0, y0 = int(panel['x'] + 8), int(panel['y'] + 8)
    x1, y1 = int(panel['x'] + panel['width'] - 8), int(panel['y'] + panel['height'] - 8)
    assert 0 <= x0 < x1 <= pixels.width and 0 <= y0 < y1 <= pixels.height
    region = [pixels.getpixel((x, y)) for y in range(y0, y1) for x in range(x0, x1)]
    light_fraction = sum(min(pixel) >= 175 for pixel in region) / len(region)
result = {'image': str(image_path), 'panelLightFraction': round(light_fraction, 4), 'painted': light_fraction > 0.5}
print(json.dumps(result))
sys.exit(0 if result['painted'] else 1)
