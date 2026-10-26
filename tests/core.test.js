import test from 'node:test';
import assert from 'node:assert/strict';
import {OneEuroVector,SessionRecorder,validateSession,frameAt,toCSV,sanitizeResult,PRESETS} from '../src/core.js';
const pose=Array.from({length:33},(_,i)=>({x:i/100,y:0,z:0,visibility:1}));
const result={poseLandmarks:[pose],poseWorldLandmarks:[pose]};
test('adaptive filter reduces static jitter and responds to deliberate movement',()=>{
 const f=new OneEuroVector();let raw=0,filtered=0;
 for(let i=0;i<180;i++){const x=Math.sin(i*2)*0.02;const y=f.filter({x,y:0,z:0},1/30,.55)[0];if(i>30){raw+=x*x;filtered+=y*y;}}
 assert.ok(filtered<raw*.35,`jitter ratio ${filtered/raw}`);
 for(let i=0;i<10;i++)f.filter({x:1,y:0,z:0},1/30,.55);
 assert.ok(f.value[0]>.9);
});
test('filter bypass, invalid inputs and irregular frame intervals remain finite',()=>{
 const f=new OneEuroVector();assert.deepEqual(f.filter({x:1,y:2,z:3},0,0),[1,2,3]);
 assert.deepEqual(f.filter({x:NaN,y:0,z:0},0),[1,2,3]);
 assert.ok(f.filter({x:2,y:3,z:4},5).every(Number.isFinite));
});
test('recorder caps memory, stores copies, rejects duplicate timestamps and roundtrips',()=>{
 const r=new SessionRecorder(2);r.start();r.push(result,100);assert.equal(r.push(result,100),false);r.push(result,133);
 assert.equal(r.active,false);assert.equal(r.push(result,166),false);assert.equal(r.frames.length,2);
 assert.notEqual(r.frames[0].result.poseLandmarks[0],pose);assert.equal(validateSession(r.export()).length,2);
 assert.equal(toCSV(r.frames).split('\n').length,67);
});
test('untrusted sessions reject invalid schemas, reversed time and malformed poses',()=>{
 assert.throws(()=>validateSession({frames:[]}));
 const r=new SessionRecorder();r.start();r.push(result,0);r.push(result,33);const payload=r.export();payload.frames[1].t=0;assert.throws(()=>validateSession(payload));
 assert.deepEqual(sanitizeResult({poseLandmarks:[[{x:Infinity}]]}).poseLandmarks,[]);
 assert.throws(()=>validateSession({schema:'mocap-session',version:3,frames:[{t:0,result:{}}]}));
});
test('binary timeline search selects stable previous samples including boundaries',()=>{
 const f=[{t:0},{t:40},{t:95}];assert.equal(frameAt(f,-10),0);assert.equal(frameAt(f,40),1);assert.equal(frameAt(f,94),1);assert.equal(frameAt(f,100),2);
});
test('presets enforce explicit inference and GPU budgets',()=>{
 assert.ok(PRESETS.performance.fps<PRESETS.balanced.fps);assert.ok(PRESETS.performance.width<PRESETS.quality.width);assert.ok(PRESETS.performance.pixelRatio<PRESETS.quality.pixelRatio);
});
