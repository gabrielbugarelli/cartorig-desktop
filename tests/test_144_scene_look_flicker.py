"""Retired 1.4.4 click-only test: delegate to the stronger 1.4.5 startup regression.

Avoids retaining a misleading test that expects dynamically generated previews.
"""
from runpy import run_path
from pathlib import Path
run_path(str(Path(__file__).with_name('test_145_scene_look_reload.py')),run_name='__main__')
