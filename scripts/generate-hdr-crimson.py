"""Flat HDR red for hover and press feedback; no decorative rim."""
import importlib.util
import sys
from pathlib import Path
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('hdr_encoder', Path(__file__).with_name('generate-prime-signal.py'))
encoder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(encoder)

encoder.encode('hdr-action-crimson', 64, lambda x,y: [850, 5, 18], width=128, video=True, peak=1000, input_primaries='bt2020', max_average=260)
(encoder.root / 'assets/hdr-action-crimson.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="64" viewBox="0 0 128 64"><path fill="#ff1833" d="M0 0h128v64H0z"/></svg>')
