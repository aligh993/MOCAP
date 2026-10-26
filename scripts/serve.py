#!/usr/bin/env python3
"""Serve the dashboard locally with explicit WASM/module MIME types."""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import webbrowser
ROOT = Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".wasm":"application/wasm", ".mjs":"text/javascript", ".task":"application/octet-stream", ".glb":"model/gltf-binary"}
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port",type=int,default=8000)
    parser.add_argument("--no-browser",action="store_true")
    args=parser.parse_args()
    try: server=ThreadingHTTPServer(("127.0.0.1",args.port),Handler)
    except OSError as e: parser.exit(1,f"Cannot bind localhost:{args.port}: {e}. Try --port 8001.\n")
    url=f"http://localhost:{server.server_port}/"
    print(f"MOCAP Studio v3: {url}\nPress Ctrl+C to stop.")
    if not args.no_browser: threading.Timer(.5,lambda:webbrowser.open(url)).start()
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()
if __name__=="__main__": main()
