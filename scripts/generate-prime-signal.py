"""Build static HDR UI assets. Requires ffmpeg with libaom, libx265 and zscale."""
from pathlib import Path
import math
import struct
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
width = 96


def pq(nits):
    """ST 2084, absolute luminance in cd/m² to 16-bit code values."""
    m1, m2 = 2610 / 16384, 2523 / 32
    c1, c2, c3 = 3424 / 4096, 2413 / 128, 2392 / 128
    linear = (nits / 10000) ** m1
    return round(((c1 + c2 * linear) / (1 + c3 * linear)) ** m2 * 65535)


def signal(x, y):
    core = math.exp(-(((x / 95 - .68) / .22) ** 2 + ((y / 31 - .5) / .38) ** 2))
    return [base + (1000 - base) * core for base in (250, 5, 10)]


def distance(x, y, start, end):
    dx, dy = end[0] - start[0], end[1] - start[1]
    t = min(1, max(0, ((x - start[0]) * dx + (y - start[1]) * dy) / (dx * dx + dy * dy)))
    return math.hypot(x - start[0] - t * dx, y - start[1] - t * dy)


def arrow(x, y):
    segments = [((24, 72), (72, 24)), ((24, 24), (72, 24)), ((72, 24), (72, 72))]
    coverage = min(1, max(0, 2 - min(distance(x, y, *segment) for segment in segments)))
    # The charcoal stays at SDR brightness. Only the white icon reaches 1000 nits.
    return [1.14 + (1000 - 1.14) * coverage] * 3


def action_light(x, y):
    # A short neutral reflection along the upper edge, with a soft falloff.
    # The rest matches the #111 button; neither arrows nor labels are baked in.
    top = math.exp(-((y - 2.5) / 1.5) ** 2 - ((x - 137) / 48) ** 2)
    side = .18 * math.exp(-((x - 188.5) / 1.3) ** 2 - ((y - 22) / 24) ** 2)
    return [1.14 + (750 - 1.14) * min(1, top + side)] * 3


def encode(name, height, color, width=96, video=False, peak=1000, input_primaries='bt2020', max_average=100):
    pixels = bytearray()
    for y in range(height):
        for x in range(width):
            pixels.extend(struct.pack('<HHH', *(pq(value) for value in color(x, y))))
    with tempfile.TemporaryDirectory() as folder:
        source = Path(folder) / 'frame.rgb'
        source.write_bytes(pixels)
        base = [
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'rawvideo', '-pixel_format', 'rgb48le', '-video_size', f'{width}x{height}', '-framerate', '2',
        '-i', str(source),
        '-color_primaries', 'bt2020', '-color_trc', 'smpte2084',
        '-colorspace', 'bt2020nc', '-color_range', 'tv'
        ]
        color_filter = (f'zscale=matrixin=gbr:transferin=smpte2084:primariesin={input_primaries}:rangein=full:'
                        'matrix=bt2020nc:transfer=smpte2084:primaries=bt2020:range=limited,format=yuv420p10le')
        subprocess.run(base + [
        '-vf', color_filter, '-frames:v', '1',
        '-c:v', 'libaom-av1', '-still-picture', '1', '-cpu-used', '6', '-crf', '12', '-b:v', '0',
        str(root / 'assets' / f'{name}.avif')
        ], check=True)
        if name == 'prime-send-hdr' or video:
            # Two identical frames: no moving decoration or audio. hvc1 + Main10
            # and HDR10 static metadata use Apple's native HDR video pipeline.
            subprocess.run(base + [
                '-vf', color_filter + ',loop=loop=1:size=1:start=0',
                '-frames:v', '2', '-an', '-c:v', 'libx265', '-preset', 'slow',
                '-x265-params', 'lossless=1:log-level=error:pools=none:frame-threads=1:wpp=0:hdr10=1:'
                    'repeat-headers=0:keyint=2:min-keyint=2:scenecut=0:'
                    f'master-display=G(8500,39850)B(6550,2300)R(35400,14600)WP(15635,16450)L({peak * 10000},1):'
                    f'max-cll={peak},{max_average}',
                '-tag:v', 'hvc1', '-movflags', '+faststart+write_colr',
                str(root / 'assets' / f'{name}.mp4')
            ], check=True)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--highlight-only', action='store_true')
    args = parser.parse_args()
    if not args.highlight_only:
        encode('prime-signal-hdr-v2', 32, signal)
        encode('prime-send-hdr', 192, lambda x, y: arrow(x / 2, y / 2), width=192)
    encode('prime-action-light', 192, action_light, width=192, video=True, peak=750)
