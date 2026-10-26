import test from 'node:test';
import assert from 'node:assert/strict';
import {TrackingEngine} from '../src/engine.js';
test('bridge rejects timeouts and cleans pending requests',async()=>{
 const e=new TrackingEngine();e.worker={postMessage(){},terminate(){}};
 await assert.rejects(e.request('frame',{},[],10),/timed out/);assert.equal(e.pending.size,0);e.close();
});
test('disposing the engine rejects outstanding operations',async()=>{
 const e=new TrackingEngine();let terminated=false;e.worker={postMessage(){},terminate(){terminated=true;}};
 const pending=e.request('options');e.close();await assert.rejects(pending,/closed/);assert.ok(terminated);assert.equal(e.pending.size,0);
});
test('main-thread inference gate prevents overlapping work and closes resources',async()=>{
 const e=new TrackingEngine();let calls=0,closed=false;e.task={detect(){calls++;return {poseLandmarks:[]};},close(){closed=true;}};
 e.busy=true;assert.equal(await e.detect({},1,640),null);assert.equal(calls,0);e.busy=false;
 const result=await e.detect({},2,640);assert.equal(calls,1);assert.ok(result.inferenceMs>=0);e.close();assert.ok(closed);assert.equal(await e.detect({},3,640),null);
});

test('a timed-out frame terminates its worker instead of queuing stale frames',async()=>{
 const previous=globalThis.createImageBitmap;let terminated=false;
 globalThis.createImageBitmap=async()=>({close(){}});
 try {
  const e=new TrackingEngine();e.worker={terminate(){terminated=true;}};e.request=async()=>{throw new Error('Tracking frame timed out.');};
  await assert.rejects(e.detect({width:10,height:10},0,640),/timed out/);assert.ok(terminated);assert.ok(e.failed);assert.equal(e.worker,null);await assert.rejects(e.detect({},1,640),/worker failed/);
 }finally{globalThis.createImageBitmap=previous;}
});
