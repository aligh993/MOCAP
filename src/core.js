/** Pure, testable tracking utilities. No DOM or rendering dependencies. */
export const PRESETS = Object.freeze({
  performance: { width: 640, height: 480, fps: 20, pixelRatio: 1 },
  balanced: { width: 960, height: 540, fps: 30, pixelRatio: 1.5 },
  quality: { width: 1280, height: 720, fps: 30, pixelRatio: 2 },
  precision: { width: 1920, height: 1080, fps: 15, pixelRatio: 2 },
});
const alpha = (cutoff, dt) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
export class OneEuroVector {
  constructor() { this.value = null; this.raw = null; this.velocity = [0, 0, 0]; }
  filter(point, dt, smoothing = 0.55) {
    const p = [point.x, point.y, point.z];
    if (!p.every(Number.isFinite)) return this.value;
    dt = Math.max(0.001, Math.min(dt, 0.25));
    if (!this.value || smoothing <= 0) { this.raw = p; this.value = p.slice(); return this.value; }
    const da = alpha(1, dt);
    for (let i = 0; i < 3; i++) this.velocity[i] += da * ((p[i] - this.raw[i]) / dt - this.velocity[i]);
    const speed = Math.hypot(...this.velocity);
    const cutoff = (0.25 + (1 - smoothing) * 1.6) + speed * 1.8;
    const a = alpha(cutoff, dt);
    for (let i = 0; i < 3; i++) this.value[i] += a * (p[i] - this.value[i]);
    this.raw = p;
    return this.value;
  }
}
export const FACE_CHANNELS = Object.freeze(['_neutral','browDownLeft','browDownRight','browInnerUp','browOuterUpLeft','browOuterUpRight','cheekPuff','cheekSquintLeft','cheekSquintRight','eyeBlinkLeft','eyeBlinkRight','eyeLookDownLeft','eyeLookDownRight','eyeLookInLeft','eyeLookInRight','eyeLookOutLeft','eyeLookOutRight','eyeLookUpLeft','eyeLookUpRight','eyeSquintLeft','eyeSquintRight','eyeWideLeft','eyeWideRight','jawForward','jawLeft','jawOpen','jawRight','mouthClose','mouthDimpleLeft','mouthDimpleRight','mouthFrownLeft','mouthFrownRight','mouthFunnel','mouthLeft','mouthLowerDownLeft','mouthLowerDownRight','mouthPressLeft','mouthPressRight','mouthPucker','mouthRight','mouthRollLower','mouthRollUpper','mouthShrugLower','mouthShrugUpper','mouthSmileLeft','mouthSmileRight','mouthStretchLeft','mouthStretchRight','mouthUpperUpLeft','mouthUpperUpRight','noseSneerLeft','noseSneerRight']);
export class NeutralCalibration {
  constructor(){this.baseline={};this.count=0;this.target=0;this.sums={};}
  start(target=30){this.count=0;this.target=target;this.sums={};}
  add(categories){
    if(!this.target || !categories.length)return false;
    for(const c of categories)if(FACE_CHANNELS.includes(c.categoryName))this.sums[c.categoryName]=(this.sums[c.categoryName]||0)+c.score;
    this.count++;
    if(this.count>=this.target){this.baseline=Object.fromEntries(Object.entries(this.sums).map(([k,v])=>[k,v/this.count]));this.target=0;return true;}
    return false;
  }
  apply(name,score){const base=Math.min(.85,this.baseline[name]||0);return Math.max(0,Math.min(1,(score-base)/(1-base)));}
}
export const RESULT_KEYS = ['poseLandmarks','poseWorldLandmarks','leftHandLandmarks','leftHandWorldLandmarks','rightHandLandmarks','rightHandWorldLandmarks','faceLandmarks'];
export function sanitizeResult(result) {
  const clean = {};
  for (const key of RESULT_KEYS) {
    const expected = key==='faceLandmarks' ? [468,478] : [key.startsWith('pose') ? 33 : 21];
    const pts = result[key]?.[0] || [];
    clean[key] = expected.includes(pts.length) && pts.every(p => [p.x,p.y,p.z].every(n=>Number.isFinite(n) && Math.abs(n)<=1000))
      ? [pts.map(p => ({ x:Number(p.x.toFixed(6)), y:Number(p.y.toFixed(6)), z:Number(p.z.toFixed(6)), visibility: Number.isFinite(p.visibility) ? Math.max(0,Math.min(1,p.visibility)) : null }))] : [];
  }
  const categories=result.faceBlendshapes?.[0]?.categories || [];
  clean.faceBlendshapes=Array.isArray(categories) ? [{categories:categories.filter(c=>c && FACE_CHANNELS.includes(c.categoryName)&&Number.isFinite(c.score)).slice(0,52).map(c=>({categoryName:c.categoryName,score:Number(Math.max(0,Math.min(1,c.score)).toFixed(5))}))}] : [];
  const matrix=result.facialTransformationMatrixes?.[0];
  clean.facialTransformationMatrixes=matrix?.data?.length===16 && Array.from(matrix.data).every(Number.isFinite) ? [{rows:4,columns:4,data:Array.from(matrix.data)}] : [];
  return clean;
}
export class SessionRecorder {
  constructor(limit = 3600, maxBytes=32*1024*1024) { this.limit = limit; this.maxBytes=maxBytes; this.clear(); }
  clear() { this.frames = []; this.active = false; this.startedAt = null; this.bytes=0; this.stopReason=""; }
  start() { this.clear(); this.active = true; }
  push(result, timestamp, inferenceMs = 0) {
    if (!this.active) return false;
    if (this.startedAt === null) this.startedAt = timestamp;
    const t = Math.max(0, timestamp - this.startedAt);
    if (!Number.isFinite(t) || (this.frames.length && t <= this.frames.at(-1).t)) return false;
    const frame={ t, inferenceMs, result:sanitizeResult(result) };
    const bytes=JSON.stringify(frame).length+1;
    if(this.bytes+bytes>this.maxBytes){this.active=false;this.stopReason='size';return false;}
    this.bytes+=bytes;this.frames.push(frame);
    if (this.frames.length >= this.limit) {this.active = false;this.stopReason="frames";}
    return true;
  }
  export() { return { schema:'mocap-session', version:3, coordinateSystem:'MediaPipe unmirrored world meters; normalized image landmarks', frames:this.frames }; }
}
export function validateSession(data) {
  if (data?.schema !== 'mocap-session' || data.version !== 3 || !Array.isArray(data.frames) || !data.frames.length || data.frames.length > 3600) throw new Error('Expected a MOCAP v3 session with 1–3600 frames.');
  let previous = -1;
  const frames = data.frames.map(f => {
    if (!Number.isFinite(f.t) || f.t < 0 || f.t <= previous || f.t > 3600000) throw new Error('Session timestamps must increase and stay within one hour.');
    previous = f.t;
    const result = sanitizeResult(f.result || {});
    return { t:f.t, inferenceMs: Number.isFinite(f.inferenceMs) ? Math.max(0,f.inferenceMs) : 0, result };
  });
  if (!frames.some(f => RESULT_KEYS.some(key=>f.result[key].length))) throw new Error('Session contains no valid tracked landmarks.');
  return frames;
}
export function frameAt(frames, t) {
  let lo=0, hi=frames.length-1;
  while (lo<hi) { const mid=Math.ceil((lo+hi)/2); if(frames[mid].t<=t) lo=mid; else hi=mid-1; }
  return lo;
}
export function toCSV(frames) {
  const lines=['time_ms,landmark,x_m,y_m,z_m,visibility'];
  for (const frame of frames) (frame.result.poseWorldLandmarks[0] || []).forEach((p,i)=>lines.push([frame.t.toFixed(2),i,p.x,p.y,p.z,p.visibility].join(',')));
  return lines.join('\n');
}

export function toDetailedCSV(frames) {
  const lines=['time_ms,stream,index,name,x,y,z,visibility,value'];
  for(const frame of frames){
    for(const key of RESULT_KEYS)(frame.result[key]?.[0]||[]).forEach((p,i)=>lines.push([frame.t.toFixed(2),key,i,'',p.x,p.y,p.z,p.visibility,''].join(',')));
    for(const c of frame.result.faceBlendshapes?.[0]?.categories||[])lines.push([frame.t.toFixed(2),'faceBlendshapes','',c.categoryName,'','','','',c.score].join(','));
    (frame.result.facialTransformationMatrixes?.[0]?.data||[]).forEach((value,i)=>lines.push([frame.t.toFixed(2),'facialTransformationMatrix',i,'','','','','',value].join(',')));
  }
  return lines.join('\n');
}

/** Serialize graph changes with inference; a rejected operation does not poison the queue. */
export class SerialGate {
  constructor(){this.tail=Promise.resolve();}
  run(operation){const result=this.tail.then(operation);this.tail=result.catch(()=>{});return result;}
}

export class LandmarkFilterBank {
  constructor(resetAfterMs=280){this.resetAfterMs=resetAfterMs;this.entries=new Map();}
  update(key,point,timestampMs,smoothing,reliable=true){
    const previous=this.entries.get(key);
    if(!reliable || ![point?.x,point?.y,point?.z,timestampMs].every(Number.isFinite))return previous?.filter.value || null;
    let entry=previous;
    if(!entry || timestampMs<=entry.at || timestampMs-entry.at>this.resetAfterMs)entry={filter:new OneEuroVector(),at:timestampMs};
    const value=entry.filter.filter(point,Math.max(.001,(timestampMs-entry.at)/1000),smoothing);
    entry.at=timestampMs;this.entries.set(key,entry);return value;
  }
  clear(prefix=null){if(prefix===null)this.entries.clear();else for(const key of this.entries.keys())if(String(key).startsWith(prefix))this.entries.delete(key);}
}

/** Permission requests cannot be aborted by getUserMedia; discard and stop late streams. */
export class CameraRequest {
  constructor({acquire=constraints=>globalThis.navigator.mediaDevices.getUserMedia(constraints),timeoutMs=45000}={}){this.acquire=acquire;this.timeoutMs=timeoutMs;this.generation=0;this.pending=null;this.stream=null;}
  cancel(){this.generation++;this.pending?.();this.pending=null;this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;}
  open(constraints){
    this.cancel();const generation=this.generation;
    return new Promise((resolve,reject)=>{
      let settled=false;
      const finish=(handler,value)=>{if(settled)return;settled=true;clearTimeout(timer);if(this.pending===cancel)this.pending=null;handler(value);};
      const cancel=()=>{const error=new Error('Camera startup cancelled.');error.name='AbortError';finish(reject,error);};
      const timer=setTimeout(()=>{const error=new Error('Camera permission or startup timed out. Check camera access and try again.');error.name='CameraTimeoutError';finish(reject,error);},this.timeoutMs);
      this.pending=cancel;
      Promise.resolve().then(()=>this.acquire(constraints)).then(stream=>{
        if(settled||generation!==this.generation){stream.getTracks().forEach(track=>track.stop());return;}
        this.stream=stream;finish(resolve,stream);
      },error=>finish(reject,error));
    });
  }
}

const percentile=(values,q)=>{if(!values.length)return 0;const sorted=values.slice().sort((a,b)=>a-b);return sorted[Math.max(0,Math.ceil(q*sorted.length)-1)];};
export class TrackingStats {
  constructor(limit=120){this.limit=limit;this.clear();}
  clear(){this.samples=[];}
  push(sample){if(!Number.isFinite(sample.at))return;if(this.samples.length&&sample.at<=this.samples.at(-1).at)this.clear();this.samples.push(sample);if(this.samples.length>this.limit)this.samples.shift();}
  snapshot(){
    const samples=this.samples,n=samples.length,durationMs=n>1?samples.at(-1).at-samples[0].at:0;
    const summarize=values=>({medianMs:percentile(values,.5),p95Ms:percentile(values,.95),meanMs:values.length?values.reduce((a,b)=>a+b,0)/values.length:0});
    const numbers=key=>samples.map(s=>s[key]).filter(Number.isFinite);
    const names=new Set(samples.flatMap(s=>Object.keys(s.components||{}))),components={};
    for(const key of names)components[key]=summarize(samples.map(s=>s.components?.[key]).filter(Number.isFinite));
    return {samples:n,durationMs,fps:durationMs>0?(n-1)*1000/durationMs:0,inference:summarize(numbers('inferenceMs')),pipeline:summarize(numbers('latencyMs')),components,
      availability:{face:n?samples.filter(s=>s.face>0).length/n:0,bothHands:n?samples.filter(s=>s.hands===42).length/n:0,visibleFeet:n?samples.filter(s=>s.feetVisible).length/n:0},last:n?samples.at(-1):null};
  }
}
