#!/usr/bin/env python3
"""Generate a self-contained HTML distribution file from the source project."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "mocap-dashboard.html"
CSS = ROOT / "assets" / "styles.css"
BOOTSTRAP = ROOT / "src" / "bootstrap.js"
APP = ROOT / "src" / "app.js"
OUTPUT = ROOT / "dist" / "mocap-dashboard.single.html"


def main() -> int:
    html = SOURCE.read_text(encoding="utf-8")
    css = CSS.read_text(encoding="utf-8")
    bootstrap = BOOTSTRAP.read_text(encoding="utf-8")
    app = APP.read_text(encoding="utf-8")

    html = html.replace(
        '  <link rel="stylesheet" href="./assets/styles.css">',
        f"  <style>\n{css}\n  </style>",
    )
    html = html.replace(
        '  <script src="./src/bootstrap.js"></script>',
        f"  <script>\n{bootstrap}\n  </script>",
    )
    html = html.replace(
        '  <script type="module" src="./src/app.js"></script>',
        f"  <script type=\"module\">\n{app}\n  </script>",
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(html, encoding="utf-8")
    print(f"Built {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
