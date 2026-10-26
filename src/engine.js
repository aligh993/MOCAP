import {SerialGate} from "./core.js?v=3.1.0-release";
/** A bounded worker bridge; graph changes and inference never overlap. */
export class TrackingEngine {
  constructor(){this.worker=null;this.task=null;this.pending=new Map();this.sequence=0;this.busy=false;this.mode='';this.closed=false;this.failed=false;this.gate=new SerialGate();this.lastTimestamp=-1;}
  request(type,data={},transfer=[],timeout=60000){
    return new Promise((resolve,reject)=>{
      if(this.closed){reject(new Error('Engine closed.'));return;}
      const id=++this.sequence;
      const timer=setTimeout(()=>{const error=new Error(`Tracking ${type} timed out.`);this.pending.delete(id);reject(error);if(type==='frame'||type==='options')this.failWorker(error);},timeout);
      this.pending.set(id,{resolve,reject,timer});
      try{this.worker.postMessage({id,type,...data},transfer);}catch(error){clearTimeout(timer);this.pending.delete(id);reject(error);}
    });
  }
  failWorker(error){
    this.failed=true;this.worker?.terminate();this.worker=null;
    for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(error);}
    this.pending.clear();
  }
  async init(config,options){
    if(globalThis.Worker && globalThis.OffscreenCanvas && globalThis.createImageBitmap){
      let blobUrl;
      try{
        const source=globalThis.__MOCAP_WORKER_SOURCE__;
        const url=source?(blobUrl=URL.createObjectURL(new Blob([source],{type:'text/javascript'}))):new URL('./tracking-worker.js?v=3.1.0-release',import.meta.url);
        this.worker=new Worker(url);
        this.worker.onmessage=({data})=>{const pending=this.pending.get(data.id);if(!pending)return;clearTimeout(pending.timer);this.pending.delete(data.id);data.error?pending.reject(new Error(data.error)):pending.resolve(data);};
        this.worker.onerror=event=>this.failWorker(new Error(event.message||'Tracking worker failed.'));
        const ready=await this.request('init',{moduleUrl:config.moduleUrl,wasmRoot:config.mediaPipeWasmRoot,config,options});
        if(this.closed)throw new Error('Engine disposed.');
        this.failed=false;this.mode='Worker';this.delegate=ready.delegate;return;
      }catch(error){this.worker?.terminate();this.worker=null;if(this.closed)throw error;console.warn('[MOCAP] Worker unavailable; using main thread:',error);}
      finally{if(blobUrl)URL.revokeObjectURL(blobUrl);}
    }
    const module=await import(config.moduleUrl),api=module.default??module;
    const vision=await api.FilesetResolver.forVisionTasks(config.mediaPipeWasmRoot);
    const {VisionPipeline}=await import(config.pipelineUrl);
    const task=await new VisionPipeline(api,vision,config,options).init();
    if(this.closed){task.close();throw new Error('Engine disposed.');}
    this.task=task;this.delegate=task.delegate;this.mode='Main thread';this.failed=false;
  }
  async detect(source,timestamp,width){
    if(this.failed)throw new Error('Tracking worker failed. Restart capture to reload the engine.');
    if(this.busy||this.closed)return null;
    this.busy=true;const requestedAt=performance.now();
    try{return await this.gate.run(async()=>{
      if(this.closed)return null;
      if(this.failed)throw new Error('Tracking worker failed. Restart capture to reload the engine.');
      const enteredAt=performance.now(),sourceWidth=source.videoWidth||source.width,sourceHeight=source.videoHeight||source.height;
      const sampleTimestamp=Math.max(timestamp,this.lastTimestamp+.001);this.lastTimestamp=sampleTimestamp;
      let frame,snapshotMs=0;
      if(this.worker){
        const ratio=Math.min(1,width/sourceWidth),snapshotStart=performance.now();
        const bitmap=await createImageBitmap(source,{resizeWidth:Math.max(1,Math.round(sourceWidth*ratio)),resizeHeight:Math.max(1,Math.round(sourceHeight*ratio)),resizeQuality:width>=1280?'high':width>=960?'medium':'low'});
        snapshotMs=performance.now()-snapshotStart;
        if(this.closed){bitmap.close();return null;}
        try{frame=await this.request('frame',{bitmap,timestamp:sampleTimestamp},[bitmap],15000);}
        catch(error){bitmap.close();if(/timed out/i.test(error.message))this.failWorker(error);throw error;}
      }else{
        const started=performance.now();const result=await this.task.detect(source,sampleTimestamp);
        frame={result,inferenceMs:performance.now()-started,metrics:this.task.lastMetrics||{}};
      }
      return {...frame,timestampMs:sampleTimestamp,metrics:{...frame.metrics,latencyMs:performance.now()-requestedAt,queueMs:enteredAt-requestedAt,snapshotMs,sourceWidth,sourceHeight}};
    });}finally{this.busy=false;}
  }
  async setOptions(options){return this.gate.run(async()=>{if(this.closed)return;if(this.failed)throw new Error('Tracking worker failed.');if(this.worker)await this.request('options',{options});else await this.task?.setOptions(options);});}
  close(){this.closed=true;this.worker?.terminate();this.worker=null;this.task?.close();this.task=null;for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(new Error('Engine closed.'));}this.pending.clear();}
}
