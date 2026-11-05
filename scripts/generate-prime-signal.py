"""Build the tiny native HDR accent. Requires ffmpeg with libaom and zscale."""
from pathlib import Path
import math
import struct
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
width, height = 96, 12


def pq(nits):
    """ST 2084, absolute luminance in cd/m² to 16-bit code values."""
    m1, m2 = 2610 / 16384, 2523 / 32
    c1, c2, c3 = 3424 / 4096, 2413 / 128, 2392 / 128
    linear = (nits / 10000) ** m1
    return round(((c1 + c2 * linear) / (1 + c3 * linear)) ** m2 * 65535)


pixels = bytearray()
for y in range(height):
    for x in range(width):
        # A warm white core peaks at 400 nits, under twice HDR reference white.
        core = math.exp(-(((x / (width - 1) - .72) / .12) ** 2
                          + ((y / (height - 1) - .5) / .32) ** 2))
        rgb = [base + (400 - base) * core for base in (300, 7, 12)]
        pixels.extend(struct.pack('<HHH', *(pq(value) for value in rgb)))

with tempfile.TemporaryDirectory() as folder:
    source = Path(folder) / 'signal.rgb'
    source.write_bytes(pixels)
    subprocess.run([
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'rawvideo', '-pixel_format', 'rgb48le', '-video_size', f'{width}x{height}',
        '-i', str(source), '-frames:v', '1',
        '-vf', 'zscale=matrixin=gbr:transferin=smpte2084:primariesin=bt2020:rangein=full:'
               'matrix=bt2020nc:transfer=smpte2084:primaries=bt2020:range=full,format=yuv444p10le',
        '-c:v', 'libaom-av1', '-still-picture', '1', '-cpu-used', '6', '-crf', '12', '-b:v', '0',
        '-color_primaries', 'bt2020', '-color_trc', 'smpte2084',
        '-colorspace', 'bt2020nc', '-color_range', 'pc',
        str(root / 'assets' / 'prime-signal-hdr.avif')
    ], check=True)
