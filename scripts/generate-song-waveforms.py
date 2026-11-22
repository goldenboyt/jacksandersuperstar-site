#!/usr/bin/env python3
"""Measure preview audio for the site. Requires ffmpeg; --refresh rechecks URLs."""
import array
import concurrent.futures
import json
import math
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'song-waveforms.js'
BINS = 64
RATE = 8000
PREFIX = '// Relative stereo RMS measurements from the first 30 seconds of each linked preview.\nwindow.SuperstarWaveforms = '


def read_catalog():
    source = (ROOT / 'release-data.js').read_text(encoding='utf8')
    return json.loads(source.split(' = ', 1)[1].strip().removesuffix(';'))


def analyze(url, temporary):
    if url.startswith(('https://', 'http://')):
        # Audio stays in a temporary directory; only the measured numbers ship.
        request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(request, timeout=40) as response:
            body = response.read(8 * 1024 * 1024 + 1)
        if len(body) < 1000 or len(body) > 8 * 1024 * 1024:
            raise ValueError('Preview download is empty or exceeds 8 MB')
        source = Path(temporary) / (str(hash(url)) + '.m4a')
        source.write_bytes(body)
    else:
        source = ROOT / url.lstrip('/')
    decoded = subprocess.run(
        ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', str(source),
         '-t', '30', '-ar', str(RATE), '-ac', '2', '-f', 'f32le', '-'],
        check=True, capture_output=True,
    ).stdout
    values = array.array('f')
    values.frombytes(decoded)
    if sys.byteorder != 'little':
        values.byteswap()
    frames = len(values) // 2
    if frames < BINS:
        raise ValueError('Preview could not be decoded')
    rms = []
    for i in range(BINS):
        start = i * (frames // BINS) + min(i, frames % BINS)
        end = (i + 1) * (frames // BINS) + min(i + 1, frames % BINS)
        rms.append(math.sqrt(sum(value * value for value in values[start * 2:end * 2]) / ((end - start) * 2)))
    maximum = max(rms)
    if maximum == 0:
        raise ValueError('Preview is silent')
    return {'samples': [round(value / maximum * 1000) for value in rms], 'duration': round(frames / RATE, 3)}


def main():
    urls = list(dict.fromkeys(url for release in read_catalog()['releases'] for url in release.get('previews', [])))
    existing = {}
    if OUT.exists() and '--refresh' not in sys.argv:
        source = OUT.read_text(encoding='utf8')
        existing = json.loads(source.split(' = ', 1)[1].strip().removesuffix(';'))
    # Recompute local audio; previously measured exact remote URLs can be reused.
    pending = [url for url in urls if url not in existing or not url.startswith(('https://', 'http://'))]
    with tempfile.TemporaryDirectory(prefix='superstar-waveforms-') as directory:
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
            futures = {pool.submit(analyze, url, directory): url for url in pending}
            for future in concurrent.futures.as_completed(futures):
                url = futures[future]
                try:
                    existing[url] = future.result()
                except Exception as error:
                    raise RuntimeError(f'Could not measure {url}: {error}') from error
                print(f'Measured {url}', flush=True)
    OUT.write_text(PREFIX + json.dumps({url: existing[url] for url in urls}, separators=(',', ':')) + ';\n', encoding='utf8')
    print(f'{len(urls)} measured previews written to {OUT.name}')


if __name__ == '__main__':
    main()
