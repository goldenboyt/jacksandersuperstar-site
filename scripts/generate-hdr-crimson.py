"""Flat HDR red for hover and press feedback; no decorative rim."""
import importlib.util
import sys
from pathlib import Path
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('hdr_encoder', Path(__file__).with_name('generate-prime-signal.py'))
encoder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(encoder)

# Grade the surface and lettering together. The red has less than half the
# previous channel intensity; small white labels retain enough contrast.
if '--ink-only' not in sys.argv:
    encoder.encode('hdr-action-crimson-v2', 64, lambda x,y: [360, 2, 6], width=128, video=True, peak=450, input_primaries='bt2020', max_average=100)
    (encoder.root / 'assets/hdr-action-crimson-v2.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="64" viewBox="0 0 128 64"><path fill="#ed1730" d="M0 0h128v64H0z"/></svg>')
# A native PQ image can fill live HTML text through background-clip. The label
# stays selectable and accessible, including labels that change after a tap.
encoder.encode('hdr-action-ink-v2', 8, lambda x,y: [750, 750, 750], width=8, peak=750, input_primaries='bt2020', max_average=750)
