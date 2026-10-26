#!/usr/bin/env python3
"""Embed source modules, worker source and character; Vendored runtime and model files remain adjacent."""
from pathlib import Path
import base64,json,re
ROOT=Path(__file__).resolve().parents[1]
def main():
 html=(ROOT/'mocap-dashboard.html').read_text(encoding='utf-8')
 css=(ROOT/'assets/styles.css').read_text(encoding='utf-8')
 core=(ROOT/'src/core.js').read_text(encoding='utf-8').replace('export ','')
 engine=(ROOT/'src/engine.js').read_text(encoding='utf-8').replace('export ','')
 engine=re.sub(r'^import .* from "\./core\.js(?:\?v=[^" ]+)?";\n','',engine,flags=re.M)
 app=(ROOT/'src/app.js').read_text(encoding='utf-8')
 app=re.sub(r'^import .* from "\./(?:core|engine)\.js(?:\?v=[^" ]+)?";\n','',app,flags=re.M)
 worker=(ROOT/'src/tracking-worker.js').read_text(encoding='utf-8')
 pipeline=base64.b64encode((ROOT/'src/vision-pipeline.js').read_bytes()).decode()
 model=base64.b64encode((ROOT/'assets/models/studio-male.glb').read_bytes()).decode()
 globals_='globalThis.__MOCAP_PIPELINE_URL__="data:text/javascript;base64,'+pipeline+'";\n'+'globalThis.__MOCAP_ASSET_BASE__=new URL("../",document.baseURI).href;\n'+'globalThis.__MOCAP_WORKER_SOURCE__='+json.dumps(worker)+';\nglobalThis.__MOCAP_MODEL_URL__="data:model/gltf-binary;base64,'+model+'";\n'
 html=html.replace('./vendor/','../vendor/')
 html=html.replace('  <link rel="stylesheet" href="./assets/styles.css">','  <style>\n'+css+'\n  </style>')
 html=html.replace('  <script src="./src/bootstrap.js?v=3.1.0-release"></script>','  <script>\n'+(ROOT/'src/bootstrap.js').read_text(encoding='utf-8')+'\n  </script>')
 html=html.replace('  <script type="module" src="./src/app.js?v=3.1.0-release"></script>','  <script type="module">\n'+globals_+core+'\n'+engine+'\n'+app+'\n  </script>')
 out=ROOT/'dist/mocap-dashboard.single.html';out.parent.mkdir(exist_ok=True);out.write_text(html,encoding='utf-8');print(f'Built {out.name}: {out.stat().st_size:,} bytes')
if __name__=='__main__':main()
