/* Serial task operations prevent inference against a partially updated graph. */
let task;
let operations=Promise.resolve();
self.onmessage=({data})=>{operations=operations.then(()=>handle(data)).catch(error=>self.postMessage({id:data.id,error:error.message||String(error)}));};
async function handle(data){
  const {id,type}=data;
  try{
    if(type==='init'){
      importScripts(data.moduleUrl.replace(/\.mjs$/,'.js'));
      const api=self.Vision,vision=await api.FilesetResolver.forVisionTasks(data.wasmRoot);
      const {VisionPipeline}=await import(data.config.pipelineUrl);
      task=await new VisionPipeline(api,vision,data.config,data.options,true).init();
      self.postMessage({id,delegate:task.delegate});
    }else if(type==='frame'){
      try{
        const started=performance.now(),result=task.detect(data.bitmap,data.timestamp),clean={};
        for(const key of ['poseLandmarks','poseWorldLandmarks','leftHandLandmarks','leftHandWorldLandmarks','rightHandLandmarks','rightHandWorldLandmarks','faceLandmarks','faceBlendshapes','facialTransformationMatrixes'])clean[key]=result[key]||[];
        self.postMessage({id,result:clean,inferenceMs:performance.now()-started,metrics:task.lastMetrics});
      }finally{data.bitmap.close();}
    }else if(type==='options'){await task.setOptions(data.options);self.postMessage({id});}
  }catch(error){self.postMessage({id,error:error.message||String(error)});}
}
