import fs from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

// Optional asset-authoring tool. Run prepare_character.py first; install Three.js 0.186.1 only to rebuild this asset.
const root=process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.join(root,'assets/models/studio-male.glb');
const original=fs.readFileSync(target), jsonLength=original.readUInt32LE(12);
const g=JSON.parse(original.subarray(20,20+jsonLength).toString());
if(g.meshes.some(m=>m.primitives.some(p=>p.targets?.length)))throw new Error('Rebuild the base character with prepare_character.py before generating morphs.');
const channels=['browDownLeft','browDownRight','browInnerUp','browOuterUpLeft','browOuterUpRight','cheekPuff','cheekSquintLeft','cheekSquintRight','eyeBlinkLeft','eyeBlinkRight','eyeLookDownLeft','eyeLookDownRight','eyeLookInLeft','eyeLookInRight','eyeLookOutLeft','eyeLookOutRight','eyeLookUpLeft','eyeLookUpRight','eyeSquintLeft','eyeSquintRight','eyeWideLeft','eyeWideRight','jawForward','jawLeft','jawOpen','jawRight','mouthClose','mouthDimpleLeft','mouthDimpleRight','mouthFrownLeft','mouthFrownRight','mouthFunnel','mouthLeft','mouthLowerDownLeft','mouthLowerDownRight','mouthPressLeft','mouthPressRight','mouthPucker','mouthRight','mouthRollLower','mouthRollUpper','mouthShrugLower','mouthShrugUpper','mouthSmileLeft','mouthSmileRight','mouthStretchLeft','mouthStretchRight','mouthUpperUpLeft','mouthUpperUpRight','noseSneerLeft','noseSneerRight'];
const sourceBin=original.subarray(28+jsonLength);
const parseG=structuredClone(g);
parseG.images=[];parseG.textures=[];
for(const material of parseG.materials){delete material.normalTexture;delete material.emissiveTexture;delete material.occlusionTexture;delete material.pbrMetallicRoughness?.baseColorTexture;delete material.pbrMetallicRoughness?.metallicRoughnessTexture;}
function glb(json,bin){let j=Buffer.from(JSON.stringify(json));j=Buffer.concat([j,Buffer.alloc((4-j.length%4)%4,32)]);const h=Buffer.alloc(20);h.writeUInt32LE(0x46546c67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(28+j.length+bin.length,8);h.writeUInt32LE(j.length,12);h.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004e4942,4);return Buffer.concat([h,j,bh,bin]);}
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const parsedBytes=glb(parseG,sourceBin);
const gltf=await loader.parseAsync(parsedBytes.buffer.slice(parsedBytes.byteOffset,parsedBytes.byteOffset+parsedBytes.length),'');
const scene=gltf.scene;scene.updateMatrixWorld(true);
const bones=new Map(),snapshots=[];scene.traverse(o=>{if(o.isBone){bones.set(o.name.replace(/^Bip01[ _]?/i,'').replace(/[^a-z0-9]/gi,'').toLowerCase(),o);snapshots.push({bone:o,position:o.position.clone(),quaternion:o.quaternion.clone()});}});
const meshes=[];scene.traverse(o=>{if(o.isSkinnedMesh){const association=gltf.parser.associations.get(o);meshes.push({mesh:o,association,rest:[]});}});
const scale=new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3()).y/1.82;
const lx=Math.sign((bones.get('leye')?.getWorldPosition(new THREE.Vector3()).x||1)-(bones.get('reye')?.getWorldPosition(new THREE.Vector3()).x||-1)) || 1;
function move(name,x=0,y=0,z=0){const b=bones.get(name.toLowerCase());if(!b)return;const p=b.getWorldPosition(new THREE.Vector3());p.add(new THREE.Vector3(x*lx,y,z).multiplyScalar(scale));b.position.copy(b.parent.worldToLocal(p));b.updateMatrixWorld(true);}
function rotate(name,axis,angle){const b=bones.get(name.toLowerCase());if(!b)return;const q=new THREE.Quaternion().setFromAxisAngle(axis,angle).multiply(b.getWorldQuaternion(new THREE.Quaternion()));b.quaternion.copy(b.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));b.updateMatrixWorld(true);}
function lips(x=0,y=0,z=0){for(const n of ['mupperlip','mbottomlip','lupperlip','rupperlip','lmouthbottom','rmouthbottom','lmouthcorner','rmouthcorner'])move(n,x,y,z);}
function expression(name){
 const side=name.endsWith('Left')?'l':name.endsWith('Right')?'r':null,sign=side==='l'?1:-1;
 if(name.startsWith('eyeBlink')){move(side+'eyeblinktop',0,-.014,.001);move(side+'eyeblinkbottom',0,.006,.001);}
 if(name.startsWith('eyeWide')){move(side+'eyeblinktop',0,.008,0);move(side+'eyeblinkbottom',0,-.003,0);}
 if(name.startsWith('eyeSquint')){move(side+'eyeblinktop',0,-.006,0);move(side+'eyeblinkbottom',0,.008,.002);move(side+'cheek',0,.004,0);}
 if(name.startsWith('eyeLook')){const vertical=name.includes('Up')?-.4:name.includes('Down')?.4:0;const horizontal=name.includes('In')?-.4*sign:.4*sign;rotate(side+'eye',new THREE.Vector3(vertical?1:0,vertical?0:1,0),vertical||horizontal);}
 if(name.startsWith('browDown')){move(side+'innereyebrow',0,-.01,.002);move(side+'outereyebrow',0,-.006,0);}
 if(name==='browInnerUp'){move('linnereyebrow',0,.012,0);move('rinnereyebrow',0,.012,0);move('mmiddleeyebrow',0,.012,0);}
 if(name.startsWith('browOuterUp'))move(side+'outereyebrow',0,.014,0);
 if(name==='cheekPuff'){move('lcheek',.006,0,.013);move('rcheek',-.006,0,.013);}
 if(name.startsWith('cheekSquint'))move(side+'cheek',0,.01,.004);
 if(name==='jawOpen'){move('mjaw',0,-.025,.006);rotate('mjaw',new THREE.Vector3(1,0,0),.3);}
 if(name==='jawForward')move('mjaw',0,0,.018);
 if(name==='jawLeft')move('mjaw',.018,0,0);
 if(name==='jawRight')move('mjaw',-.018,0,0);
 if(name==='mouthClose'){move('mbottomlip',0,.012,.002);move('mupperlip',0,-.005,0);}
 if(name.startsWith('mouthSmile')){move(side+'mouthcorner',sign*.018,.012,-.001);move(side+'cheek',sign*.003,.006,0);}
 if(name.startsWith('mouthFrown'))move(side+'mouthcorner',sign*.003,-.013,0);
 if(name.startsWith('mouthDimple'))move(side+'mouthcorner',sign*.012,0,-.007);
 if(name.startsWith('mouthStretch'))move(side+'mouthcorner',sign*.025,0,0);
 if(name==='mouthLeft')lips(.016,0,0);
 if(name==='mouthRight')lips(-.016,0,0);
 if(name.startsWith('mouthLowerDown')){move(side+'mouthbottom',0,-.014,.002);move('mbottomlip',0,-.005,0);}
 if(name.startsWith('mouthUpperUp')){move(side+'upperlip',0,.012,.002);move('mupperlip',0,.004,0);}
 if(name.startsWith('mouthPress')){move(side+'upperlip',0,-.005,-.004);move(side+'mouthbottom',0,.005,-.004);}
 if(name==='mouthPucker'){lips(0,0,.018);move('lmouthcorner',-.012,0,0);move('rmouthcorner',.012,0,0);}
 if(name==='mouthFunnel'){lips(0,0,.014);move('mupperlip',0,.009,0);move('mbottomlip',0,-.009,0);move('lmouthcorner',-.009,0,0);move('rmouthcorner',.009,0,0);}
 if(name==='mouthRollUpper')for(const n of ['mupperlip','lupperlip','rupperlip'])move(n,0,-.003,-.009);
 if(name==='mouthRollLower')for(const n of ['mbottomlip','lmouthbottom','rmouthbottom'])move(n,0,.003,-.009);
 if(name==='mouthShrugUpper')for(const n of ['mupperlip','lupperlip','rupperlip'])move(n,0,.009,.004);
 if(name==='mouthShrugLower')for(const n of ['mbottomlip','lmouthbottom','rmouthbottom'])move(n,0,.009,.004);
 if(name.startsWith('noseSneer')){move(side+'caninus',0,.012,.003);move(side+'upperlip',0,.006,0);move('mnose',0,.003,.002);}
}
for(const record of meshes){const a=record.mesh.geometry.attributes.position;for(let i=0;i<a.count;i++)record.rest.push(record.mesh.applyBoneTransform(i,new THREE.Vector3().fromBufferAttribute(a,i)));}
let chunks=[sourceBin],offset=sourceBin.length;
function append(buffer){const padding=(4-offset%4)%4;if(padding){chunks.push(Buffer.alloc(padding));offset+=padding;}const start=offset;chunks.push(buffer);offset+=buffer.length;const view=g.bufferViews.length;g.bufferViews.push({buffer:0,byteOffset:start,byteLength:buffer.length});return view;}
const report={};
for(const mesh of g.meshes){mesh.weights=channels.map(()=>0);mesh.extras={...mesh.extras,targetNames:channels};for(const p of mesh.primitives)p.targets=[];}
for(const channel of channels){
 for(const s of snapshots){s.bone.position.copy(s.position);s.bone.quaternion.copy(s.quaternion);}scene.updateMatrixWorld(true);expression(channel);scene.updateMatrixWorld(true);let changed=0;
 for(const record of meshes){
  const attribute=record.mesh.geometry.attributes.position,count=attribute.count,indices=[],values=[];const min=[0,0,0],max=[0,0,0];
  for(let i=0;i<count;i++){
   const delta=record.mesh.applyBoneTransform(i,new THREE.Vector3().fromBufferAttribute(attribute,i)).sub(record.rest[i]);
   if(delta.lengthSq()<1e-12)continue;indices.push(i);changed++;values.push(delta.x,delta.y,delta.z);for(let c=0;c<3;c++){const value=delta.getComponent(c);min[c]=Math.min(min[c],value);max[c]=Math.max(max[c],value);}
  }
  const accessor={componentType:5126,type:'VEC3',count,min,max};
  if(indices.length){accessor.sparse={count:indices.length,indices:{bufferView:append(Buffer.from(new Uint16Array(indices).buffer)),componentType:5123},values:{bufferView:append(Buffer.from(new Float32Array(values).buffer))}};}
  const index=g.accessors.length;g.accessors.push(accessor);g.meshes[record.association.meshes].primitives[record.association.primitives].targets.push({POSITION:index});
 }
 report[channel]=changed;
}
if(Object.values(report).some(n=>n===0))throw new Error('A facial control produced no vertex deformation: '+JSON.stringify(report));
const padding=(4-offset%4)%4;if(padding)chunks.push(Buffer.alloc(padding));const bin=Buffer.concat(chunks);g.buffers[0].byteLength=bin.length;
g.asset.extras.facialRig='51 authored expression morph targets derived from the existing face skin/bone weights; 52 MediaPipe coefficient channels include neutral. Approximate real-time expression shapes, not a measured FACS scan.';
g.asset.extras.fingerSegments=30;
const result=glb(g,bin);fs.writeFileSync(target,result);
fs.writeFileSync(path.join(root,'assets/models/facial-morph-report.json'),JSON.stringify({channels:channels.length,affectedVerticesPerChannel:report,bytes:result.length},null,2));
const metaPath=path.join(root,'assets/models/studio-male.json');const meta=JSON.parse(fs.readFileSync(metaPath,'utf8'));Object.assign(meta,{bytes:result.length,sha256:createHash('sha256').update(result).digest('hex'),facialMorphTargets:51,faceCoefficientChannels:52,fingerSegments:30});fs.writeFileSync(metaPath,JSON.stringify(meta,null,2));
console.log(JSON.stringify({bytes:result.length,channels:channels.length,report},null,2));
