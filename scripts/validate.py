#!/usr/bin/env python3
"""Static project validation for the browser-only MOCAP dashboard."""

from __future__ import annotations

import re
import shutil
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "mocap-dashboard.html"
APP_PATH = ROOT / "src" / "app.js"
BOOTSTRAP_PATH = ROOT / "src" / "bootstrap.js"
STYLE_PATH = ROOT / "assets" / "styles.css"
README_PATH = ROOT / "README.md"

class DashboardParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: set[str] = set()
        self.toggle_keys: list[str] = []
        self.local_assets: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = dict(attrs)
        element_id = data.get("id")
        if element_id:
            self.ids.add(element_id)
        toggle_key = data.get("data-toggle")
        if toggle_key:
            self.toggle_keys.append(toggle_key)
        for attr in ("src", "href"):
            value = data.get(attr)
            if value and value.startswith("./"):
                self.local_assets.append(value)

def fail(message: str) -> None:
    print(f"[FAIL] {message}")
    raise SystemExit(1)

def ok(message: str) -> None:
    print(f"[ OK ] {message}")

def main() -> int:
    required = [HTML_PATH, APP_PATH, BOOTSTRAP_PATH, STYLE_PATH, README_PATH, ROOT / "LICENSE"]
    missing = [path.relative_to(ROOT) for path in required if not path.is_file()]
    if missing:
        fail(f"Missing required files: {', '.join(map(str, missing))}")
    ok("Required project files exist")

    html = HTML_PATH.read_text(encoding="utf-8")
    app = APP_PATH.read_text(encoding="utf-8")
    parser = DashboardParser()
    parser.feed(html)

    local_missing = []
    for asset in parser.local_assets:
        target = (ROOT / asset[2:].split("?", 1)[0]).resolve()
        if not target.is_file():
            local_missing.append(asset)
    if local_missing:
        fail(f"Missing local HTML assets: {', '.join(local_missing)}")
    ok("Local HTML assets resolve")

    dom_refs = set(re.findall(r'''\$\(["']([^"']+)["']\)''', app))
    unresolved_ids = sorted(dom_refs - parser.ids)
    if unresolved_ids:
        fail(f"JavaScript references missing DOM IDs: {', '.join(unresolved_ids)}")
    ok(f"All {len(dom_refs)} JavaScript DOM ID references resolve")

    state_match = re.search(r"const state = \{(.*?)\n\};", app, re.DOTALL)
    if not state_match:
        fail("Could not locate the state object")
    state_keys = set(re.findall(r"^\s*([A-Za-z_$][\w$]*):", state_match.group(1), re.MULTILINE))
    missing_toggle_keys = sorted(set(parser.toggle_keys) - state_keys)
    if missing_toggle_keys:
        fail(f"Toggle keys missing from state: {', '.join(missing_toggle_keys)}")
    ok(f"All {len(parser.toggle_keys)} UI toggles map to state")

    forbidden = {
        "removed synthetic mode": "btn-demo",
        "removed synthetic generator": "syntheticResult",
        "legacy MediaPipe camera helper": "camera_utils",
        "legacy MediaPipe Holistic package": "@mediapipe/holistic",
        "legacy global Holistic connector constant": "Holistic.POSE_CONNECTIONS",
        "duplicate MediaPipe Camera helper": "new Camera(",
    }
    found_forbidden = [label for label, token in forbidden.items() if token in app or token in html]
    if found_forbidden:
        fail(f"Legacy code paths still present: {', '.join(found_forbidden)}")
    ok("Legacy camera/Holistic code paths are absent")

    import json, hashlib
    manifest = json.loads((ROOT / "vendor/manifest.json").read_text(encoding="utf-8"))
    if manifest["three"]["version"] != "0.186.1" or manifest["mediapipe"]["version"] != "1.0.1":
        fail("Unexpected dependency versions")
    for relative, expected in manifest["files"].items():
        path = ROOT / relative
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            fail(f"Dependency integrity mismatch: {relative}")
    ok(f"All {len(manifest['files'])} pinned dependency/model hashes verified")

    node = shutil.which("node")
    if node:
        for script in sorted((ROOT / "src").glob("*.js")):
            result = subprocess.run([node, "--check", str(script)], capture_output=True, text=True)
            if result.returncode != 0:
                sys.stderr.write(result.stderr)
                fail(f"Node syntax check failed: {script.relative_to(ROOT)}")
        ok("JavaScript syntax passes node --check")
    else:
        print("[SKIP] Node.js not found; skipped JavaScript parser check")

    if "readAsText(file)" not in app or "readAsArrayBuffer(file)" not in app:
        fail("Expected text/binary custom-model upload paths are not both present")
    ok("GLTF text and GLB/VRM binary upload paths are present")

    print("\nValidation passed.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
