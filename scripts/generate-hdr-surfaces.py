"""Generate static, native HDR10 action surfaces; no text or icons are baked in."""
import importlib.util
import math
import sys
sys.dont_write_bytecode = True
from pathlib import Path

spec = importlib.util.spec_from_file_location('hdr_encoder', Path(__file__).with_name('generate-prime-signal.py'))
encoder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(encoder)


def linear(value):
    value /= 255
    return value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4


def make(name, width, height, rgb):
    base = [linear(value) * 203 for value in rgb]
    sigma = 4.5 if name == 'hdr-action-square' else 3.0
    top_y = 4 if height <= 192 else 5
    def surface(x, y):
        top = math.exp(-((y - top_y) / sigma) ** 2) * (.12 + .88 * math.exp(-((x - width * .66) / (width * .31)) ** 2))
        side = .22 * math.exp(-((x - width + 4) / sigma) ** 2 - ((y - height * .16) / (height * .34)) ** 2)
        edge = min(1, top + side)
        return [channel + (1000 - channel) * edge for channel in base]
    encoder.encode(name, height, surface, width=width, video=True, peak=1000, input_primaries='bt709')
    color = '#%02x%02x%02x' % rgb
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}"><defs><linearGradient id="light" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="{width}" y2="0"><stop stop-color="{color}"/><stop offset=".66" stop-color="#eee"/><stop offset="1" stop-color="{color}"/></linearGradient></defs><path fill="{color}" d="M0 0h{width}v{height}H0z"/><path d="M12 {top_y}H{width-12}" fill="none" stroke="url(#light)" stroke-width="{sigma*1.15}"/></svg>'''
    (encoder.root / 'assets' / f'{name}.svg').write_text(svg)


make('hdr-action-wide', 384, 128, (17, 17, 17))
make('hdr-action-square', 192, 192, (17, 17, 17))
make('hdr-action-red', 384, 128, (229, 30, 37))
make('hdr-action-frame', 384, 384, (17, 17, 17))
