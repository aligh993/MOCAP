#!/usr/bin/env python3
"""Validate bundled GLB structure, budgets, skin, images and explicit rig roles."""
from pathlib import Path
import struct,json,hashlib
ROOT=Path(__file__).resolve().parents[1]
b=(ROOT/'assets/models/studio-male.glb').read_bytes()
magic,version,total=struct.unpack_from('<III',b)
assert (magic,version,total)==(0x46546c67,2,len(b))
length,kind=struct.unpack_from('<II',b,12)
assert kind==0x4e4f534a and length%4==0
g=json.loads(b[20:20+length])
assert len(b)<2*1024*1024
assert g['skins'] and len(g['skins'][0]['joints'])==80
assert len(g['images'])==5
assert all(len(p.get('targets',[]))==51 for m in g['meshes'] for p in m['primitives'])
assert all(len(m['extras']['targetNames'])==51 for m in g['meshes'])
assert all('uri' not in item for item in g.get('buffers',[])+g['images'])
triangles=sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes'] for p in m['primitives'])
assert triangles==7428
roles=g['extras']['mocapHumanoid']
for side in ['left','right']:
 for role in ['UpperArm','LowerArm','Hand','UpperLeg','LowerLeg','Foot','Toes']:
  assert side+role in roles
for role in ['hips','spine','neck','head']: assert role in roles
meta=json.loads((ROOT/'assets/models/studio-male.json').read_text(encoding='utf-8'))
assert hashlib.sha256(b).hexdigest()==meta['sha256']
assert meta['skeletonJoints']==80
assert meta['facialMorphTargets']==51
report=json.loads((ROOT/'assets/models/facial-morph-report.json').read_text(encoding='utf-8'))
assert len(report['affectedVerticesPerChannel'])==51 and all(n>0 for n in report['affectedVerticesPerChannel'].values())
print(f'Asset validation passed: {len(b):,} bytes; {triangles:,} triangles; 80 skin joints; 5 embedded images; {len(roles)} semantic roles.')
