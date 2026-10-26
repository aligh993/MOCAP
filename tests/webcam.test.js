import test from 'node:test';
import assert from 'node:assert/strict';
import {CameraRequest,SerialGate,TrackingStats,LandmarkFilterBank} from '../src/core.js';
import {assignHands,handRegions,remapHand} from '../src/vision-pipeline.js';
import {TrackingEngine} from '../src/engine.js';
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)};};
const stream=()=>{const track={stopped:0,stop(){this.stopped++;}};return {track,getTracks:()=>[track]};};
test('camera cancellation rejects promptly and stops a late permission grant',async()=>{
 const d=deferred(),s=stream(),c=new CameraRequest({acquire:()=>d.promise});
 const result=c.open({});c.cancel();await assert.rejects(result,{name:'AbortError'});
 d.resolve(s);await new Promise(r=>setImmediate(r));assert.equal(s.track.stopped,1);assert.equal(c.stream,null);
});
test('camera timeout stops any stream granted after the deadline',async()=>{
 const d=deferred(),s=stream(),c=new CameraRequest({acquire:()=>d.promise,timeoutMs:8});
 await assert.rejects(c.open({}),{name:'CameraTimeoutError'});d.resolve(s);await new Promise(r=>setImmediate(r));assert.equal(s.track.stopped,1);
});
test('reopening a camera stops its previous stream; cancellation stops the active stream',async()=>{
 const a=stream(),b=stream();let n=0;const c=new CameraRequest({acquire:async()=>n++?b:a});
 assert.equal(await c.open({}),a);assert.equal(await c.open({}),b);assert.equal(a.track.stopped,1);c.cancel();assert.equal(b.track.stopped,1);
});
test('serial operations preserve ordering and recover from rejection',async()=>{
 const gate=new SerialGate(),d=deferred(),events=[];
 const a=gate.run(async()=>{events.push('frame');await d.promise;events.push('done');});
 const b=gate.run(()=>{events.push('options');throw new Error('bad options');});const rejected=assert.rejects(b,/bad options/);
 const c=gate.run(()=>events.push('next frame'));await Promise.resolve();assert.deepEqual(events,['frame']);d.resolve();await Promise.all([a,rejected,c]);assert.deepEqual(events,['frame','done','options','next frame']);
});
test('unreliable observations do not move a filtered joint; reacquisition resets stale history',()=>{
 const f=new LandmarkFilterBank(280),p=x=>({x,y:0,z:0});assert.equal(f.update('L0',p(0),0,.8)[0],0);
 assert.equal(f.update('L0',p(10),33,.8,false)[0],0);assert.equal(f.update('L0',p(10),400,.8)[0],10);
 f.update('R0',p(2),0,.8);f.clear('L');assert.equal(f.entries.size,1);assert.ok(f.entries.has('R0'));
});
test('diagnostic FPS uses elapsed time, p95 uses nearest rank and availability remains explicit',()=>{
 const s=new TrackingStats(20);for(let i=0;i<20;i++)s.push({at:i*250,inferenceMs:100+i,latencyMs:150+i,components:{body:80},hands:i%2?42:21,face:478,feetVisible:false});
 const v=s.snapshot();assert.equal(v.fps,4);assert.equal(v.inference.medianMs,109);assert.equal(v.inference.p95Ms,118);assert.equal(v.availability.bothHands,.5);assert.equal(v.availability.visibleFeet,0);assert.equal(v.components.body.medianMs,80);
});
const pose=()=>Array.from({length:33},()=>({x:.5,y:.5,visibility:0}));
test('unreliable wrist anchors do not override handedness and duplicate labels retain both detections',()=>{
 const p=pose();p[15]={x:.1,y:.5,visibility:.1};p[16]={x:.9,y:.5,visibility:.1};
 const hands=[[{x:.9,y:.5}],[{x:.1,y:.5}]];
 assert.deepEqual(assignHands(hands,p,[[{categoryName:'Left',score:1}],[{categoryName:'Right',score:1}]]),{left:0,right:1});
 const match=assignHands(hands,p,[[{categoryName:'Left',score:1}],[{categoryName:'Left',score:1}]]);assert.notEqual(match.left,match.right);assert.ok(match.left>=0&&match.right>=0);
});
test('pose-guided crops require reliable separated arms and remap coordinates without aspect distortion',()=>{
 const p=pose();p[15]={x:.2,y:.5,visibility:1};p[13]={x:.2,y:.7,visibility:1};p[16]={x:.8,y:.5,visibility:1};p[14]={x:.8,y:.7,visibility:1};
 const regions=handRegions(p,1280,720);assert.equal(regions.length,2);const region=regions[1];
 const q=remapHand([{x:(352+160)/672,y:.5,z:.1}],region,1280,720)[0];assert.ok(Math.abs(q.x-(region.x+region.size/2)/1280)<1e-10);assert.ok(Math.abs(q.y-(region.y+region.size/2)/720)<1e-10);
 p[16]={...p[15]};p[14]={...p[13]};assert.deepEqual(handRegions(p,1280,720),[]);p[15].visibility=.1;assert.deepEqual(handRegions(p,1280,720),[]);
});
test('engine options wait for active inference and the bridge rejects all pending work on worker failure',async()=>{
 const e=new TrackingEngine(),d=deferred(),events=[];e.task={async detect(){events.push('detect');await d.promise;return {};},async setOptions(){events.push('options');},close(){}};
 const frame=e.detect({width:10,height:10},10,640);const options=e.setOptions({});await Promise.resolve();assert.deepEqual(events,['detect']);d.resolve();await Promise.all([frame,options]);assert.deepEqual(events,['detect','options']);e.close();
 const w=new TrackingEngine();let terminated=false;w.worker={postMessage(){},terminate(){terminated=true;}};const pending=w.request('options');w.failWorker(new Error('GPU lost'));await assert.rejects(pending,/GPU lost/);assert.equal(w.pending.size,0);assert.ok(terminated);
});
import {VisionPipeline} from '../src/vision-pipeline.js';
test('hand detail mode changes task mode and inference API in a serialized option update',async()=>{
 const calls=[];const task={async setOptions(o){calls.push(o);},detect(){calls.push('image');return {landmarks:[],worldLandmarks:[],handedness:[]};},detectForVideo(){calls.push('video');return {landmarks:[],worldLandmarks:[],handedness:[]};}};
 const pipeline=new VisionPipeline({},null,{guidedHands:false},{});pipeline.tasks={hands:task,pose:{async setOptions(){},detectForVideo(){return {landmarks:[],worldLandmarks:[]};}},face:{async setOptions(){},detectForVideo(){return {faceLandmarks:[],faceBlendshapes:[],facialTransformationMatrixes:[]};}}};
 pipeline.detect({width:1280,height:720},100);assert.equal(calls.at(-1),'video');
 await pipeline.setOptions({guidedHands:true,minHandLandmarksConfidence:.6});assert.equal(calls.at(-1).runningMode,'IMAGE');pipeline.detect({width:1280,height:720},200);assert.equal(calls.at(-1),'image');assert.equal(pipeline.lastMetrics.handInput,'full frame');
 await pipeline.setOptions({guidedHands:false,minHandLandmarksConfidence:.6});assert.equal(calls.at(-1).runningMode,'VIDEO');
});
test('unchanged tracking options do not rebuild body or face graphs',async()=>{
 let calls=0;const options={minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,minFaceDetectionConfidence:.5,minFacePresenceConfidence:.5,minHandLandmarksConfidence:.5};
 const p=new VisionPipeline({},null,{guidedHands:false},options);p.tasks={pose:{async setOptions(){calls++;}},face:{async setOptions(){calls++;}},hands:{async setOptions(){calls++;}}};
 await p.setOptions({...options,guidedHands:false});assert.equal(calls,0);await p.setOptions({...options,guidedHands:true});assert.equal(calls,1);
});
