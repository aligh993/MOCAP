from pathlib import Path
import struct,json,hashlib
root=Path(__file__).resolve().parents[1]
import urllib.request
b=urllib.request.urlopen('https://models.codelove.in/models/male-adult-09.glb',timeout=60).read()
assert hashlib.sha256(b).hexdigest()=='c5620778597891b8569979c06e8918ecaecf16848973140b23e7a57c1e3f19bf', 'Upstream model changed; review provenance before rebuilding.'
n=struct.unpack_from('<I',b,12)[0]; g=json.loads(b[20:20+n]); tail=b[20+n:]
rename={'Bip01 Pelvis':'Hips','Bip01 Spine':'Spine','Bip01 Spine1':'Chest','Bip01 Spine2':'UpperChest','Bip01 Neck':'Neck','Bip01 Head':'Head'}
for s,side in [('L','Left'),('R','Right')]:
 for old,new in [('Clavicle','Shoulder'),('UpperArm','UpperArm'),('Forearm','LowerArm'),('Hand','Hand'),('Thigh','UpperLeg'),('Calf','LowerLeg'),('Foot','Foot'),('Toe0','Toes')]: rename[f'Bip01 {s} {old}']=side+new
 for i,f in enumerate(['Thumb','Index','Middle','Ring','Little']):
  for suffix,j in [('',1),('1',2),('2',3)]: rename[f'Bip01 {s} Finger{i}{suffix}']=f'{side}{f}{j}'
for node in g['nodes']:
 if node.get('name') in rename: node['name']=rename[node['name']]
# Standard role metadata enables reliable rig mapping without guessing bone names.
roles={v[0].lower()+v[1:]:i for i,node in enumerate(g['nodes']) if (v:=node.get('name','')) in rename.values()}
g.setdefault('extras',{})['mocapHumanoid']=roles
g['asset']['extras'].update({'name':'Studio Male','source':'Microsoft Rocketbox male m017, optimized GLB conversion by models.codelove.in','sourceUrl':'https://models.codelove.in/models/male-adult-09.glb','adaptation':'MOCAP v3 semantic bone names and explicit retarget map; original textured geometry preserved.'})
g['nodes'][82]['name']='StudioMale_TexturedMesh'
j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
out=struct.pack('<III',0x46546c67,2,20+len(j)+len(tail))+struct.pack('<II',len(j),0x4e4f534a)+j+tail
p=root/'assets/models/studio-male.glb';p.write_bytes(out)
meta={'name':'Studio Male','file':'studio-male.glb','bytes':len(out),'sha256':hashlib.sha256(out).hexdigest(),'triangles':7428,'skeletonJoints':80,'embeddedImages':len(g['images']),'license':'MIT','originalAuthor':'Microsoft / Rocketbox','source':'https://models.codelove.in/models/male-adult-09.glb','description':'Textured adult male in a dark short-sleeved T-shirt, denim jeans and sneakers. Real-time realistic asset, not a new photogrammetry scan.','modifications':['Standard semantic bone names','Explicit humanoid metadata','Descriptive mesh name'],'roles':roles}
(root/'assets/models/studio-male.json').write_text(json.dumps(meta,indent=2))
print('Created',len(out),'bytes',len(roles),'named roles')
