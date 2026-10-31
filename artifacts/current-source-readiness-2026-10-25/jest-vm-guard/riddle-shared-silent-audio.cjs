const sampleRate = 8000;
const dataLength = sampleRate * 60 * 2;
const wav = Buffer.alloc(44 + dataLength);
wav.write('RIFF', 0);
wav.writeUInt32LE(36 + dataLength, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(dataLength, 40);

async function installSilentAudio(target) {
  await target.route('**/audio/**', route => {
    const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range || '');
    const start = range ? Number(range[1]) : 0;
    const end = range && range[2] ? Math.min(Number(range[2]), wav.length - 1) : wav.length - 1;
    if (start > end || start >= wav.length) return route.fulfill({ status: 416, headers: { 'Content-Range': `bytes */${wav.length}` } });
    return route.fulfill({
      status: range ? 206 : 200,
      contentType: 'audio/wav',
      headers: { 'Accept-Ranges': 'bytes', ...(range ? { 'Content-Range': `bytes ${start}-${end}/${wav.length}` } : {}) },
      body: wav.subarray(start, end + 1),
    });
  });
}

module.exports = {installSilentAudio};
