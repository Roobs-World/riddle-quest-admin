# Web media assets

Run the fixed image recipes with FFmpeg and FFprobe installed:

```sh
node scripts/web/optimize-media.mjs
node scripts/web/optimize-media.mjs --write
```

The first command encodes and inspects temporary candidates without replacing
project files. `--write` replaces the web derivatives after both outputs pass
codec, dimension and full-decode checks. It keeps the original PNG files.
The recipes use FFmpeg's [libwebp encoder](https://ffmpeg.org/ffmpeg-codecs.html#libwebp),
lossless BGRA encoding, compression level 6 and quality 100 for compression effort.
The November 26 conversion used FFmpeg 8.0.1.

| Asset | Previous bytes | Current bytes | Change |
| --- | ---: | ---: | --- |
| Closed chest, PNG to WebP | 56,647 | 51,020 | 9.9% smaller |
| Header mascot, WebP | 42,316 | 29,816 | 29.5% smaller |
| Combined | 98,963 | 80,836 | 18,127 bytes, 18.3% smaller |

The chest remains 512 by 512 pixels. The mascot is generated from the original
`assets/images/icon.png` with Lanczos resizing to 256 by 256 pixels. Its maximum
display size is 68 CSS pixels, so this covers more than three device pixels per
CSS pixel. It decodes 65,536 pixels instead of 1,572,516, a 95.8% reduction.
Resizing removes unnecessary source detail; the resized image is encoded losslessly.

Decoded RGBA inspection confirmed identical transparency and visible RGB values
against the chest source and the resized mascot source. WebP may clear RGB values
of fully transparent pixels. Those invisible values do not affect the rendering.
Both outputs decoded successfully. No browser harness or timing benchmark ran;
these are exact file-size and pixel-count comparisons, not latency measurements.

Jest, Facebook and Reddit import these assets. The self-contained game targets
do not import them. Keep the original closed-chest PNG for conversion and the
Android avatar fixture. Large source files such as `music.wav` and `chest-open.jpg`
are not shipped by these game builds and do not count toward download savings.

The current music is already mono Opus in WebM. A stream-copy remux saved only
293 bytes, so it was retained unchanged. Lower bitrates require a separate audio
quality decision. Its `preload="none"` also means music transfer begins on demand.

The three affected production builds passed. Their emitted image checksums match
the converted files, and the old chest PNG is absent from each artifact. The
[Jest release evidence](../../jest/evidence/jest-ffmpeg-media-2026-11-26.json)
records the exact uploaded version confirmed ready and active.
