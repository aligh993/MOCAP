import test from 'node:test';
import assert from 'node:assert/strict';
import {FACE_CHANNELS,NeutralCalibration,sanitizeResult,SessionRecorder,validateSession,toDetailedCSV} from '../src/core.js';
import {assignHands} from '../src/vision-pipeline.js';
const point={x:.5,y:.5,z:0,visibility:1};
const result={poseLandmarks:[Array.from({length:33},()=>({...point}))],faceLandmarks:[Array.from({length:478},()=>({...point}))],faceBlendshapes:[{categories:FACE_CHANNELS.map(categoryName=>({categoryName,score:.4}))}],facialTransformationMatrixes:[{data:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}]};
test('all 553 landmark streams, 52 coefficient names and head matrix survive sanitizing and replay',()=>{
 const raw={...result,leftHandLandmarks:[Array.from({length:21},()=>({...point}))],rightHandLandmarks:[Array.from({length:21},()=>({...point}))]};
 const clean=sanitizeResult(raw);assert.equal(FACE_CHANNELS.length,52);assert.equal(new Set(FACE_CHANNELS).size,52);assert.equal(clean.faceLandmarks[0].length+clean.poseLandmarks[0].length+clean.leftHandLandmarks[0].length+clean.rightHandLandmarks[0].length,553);
 assert.equal(clean.faceBlendshapes[0].categories.length,52);assert.equal(clean.facialTransformationMatrixes[0].data.length,16);
 const r=new SessionRecorder();r.start();r.push(raw,1);const replay=validateSession(r.export())[0].result;assert.equal(replay.faceBlendshapes[0].categories.length,52);assert.equal(replay.faceLandmarks[0].length,478);assert.ok(toDetailedCSV(r.frames).includes('faceBlendshapes,,jawOpen'));
});
test('neutral calibration averages a fixed sample window and adjusts coefficients within range',()=>{
 const c=new NeutralCalibration();c.start(3);const sample=[{categoryName:'jawOpen',score:.2}];assert.equal(c.add(sample),false);assert.equal(c.add(sample),false);assert.equal(c.add(sample),true);assert.ok(Math.abs(c.apply('jawOpen',.6)-.5)<1e-9);assert.equal(c.apply('jawOpen',0),0);assert.equal(c.apply('jawOpen',2),1);
});
test('dense face recording stops before its configured byte budget',()=>{
 const one=new SessionRecorder();one.start();one.push(result,0);const budget=one.bytes+10;
 const r=new SessionRecorder(3600,budget);r.start();r.push(result,0);assert.equal(r.push(result,33),false);assert.equal(r.active,false);assert.equal(r.stopReason,'size');assert.equal(r.frames.length,1);assert.ok(r.bytes<=budget);
});
test('hand identity follows pose wrist proximity even when detector order is reversed',()=>{
 const pose=Array.from({length:33},()=>({...point}));pose[15]={x:.2,y:.4};pose[16]={x:.8,y:.4};
 assert.deepEqual(assignHands([[{x:.79,y:.4}],[{x:.21,y:.4}]],pose),{left:1,right:0});
 assert.deepEqual(assignHands([[{x:.8,y:.41}]],pose),{left:-1,right:0});
 assert.deepEqual(assignHands([[{x:0,y:0}]],pose),{left:-1,right:-1});
});
test('unknown or invalid expression and matrix payloads are removed',()=>{
 const r=sanitizeResult({faceBlendshapes:[{categories:[{categoryName:'jawOpen',score:2},{categoryName:'bad',score:1},{categoryName:'mouthClose',score:NaN}]}],facialTransformationMatrixes:[{data:[Infinity]}]});assert.equal(r.faceBlendshapes[0].categories.length,1);assert.equal(r.faceBlendshapes[0].categories[0].score,1);assert.equal(r.facialTransformationMatrixes.length,0);
});

test('face-only sessions remain exportable and replayable',()=>{
 const r=new SessionRecorder();r.start();r.push({...result,poseLandmarks:[]},1);const frames=validateSession(r.export());assert.equal(frames.length,1);assert.equal(frames[0].result.faceLandmarks[0].length,478);
});
