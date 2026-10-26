/** Body/face/hand inference uses one captured image and one timestamp. */
const reliable=p=>p && Number.isFinite(p.x) && Number.isFinite(p.y) && (!Number.isFinite(p.visibility) || p.visibility>=.5);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function assignHands(landmarks,pose,handedness=[],{aspect=1,previous={}}={}) {
  const result={left:-1,right:-1},count=Math.min(2,landmarks.length);
  if(!count)return result;
  const distance=(a,b)=>a&&b?Math.hypot((a.x-b.x)*aspect,a.y-b.y):Infinity;
  const anchors={left:reliable(pose?.[15])?pose[15]:null,right:reliable(pose?.[16])?pose[16]:null};
  const cost=(i,side)=>{
    const wrist=landmarks[i]?.[0];if(!wrist)return Infinity;
    const category=handedness[i]?.[0],label=category?.categoryName?.toLowerCase(),score=clamp(category?.score??.5,0,1);
    const mismatch=label&&(label==='left'||label==='right')&&label!==side?score:0;
    const spatial=anchors[side]?distance(wrist,anchors[side]):0;
    const temporal=previous[side]?distance(wrist,previous[side])*.08:0;
    const labelCost=mismatch*(anchors[side] ? .04 : .25);
    // Tiny deterministic tie breaker is used only when anchors/labels/history are ambiguous.
    return spatial+temporal+labelCost+(side==='left'?1-wrist.x:wrist.x)*.00001;
  };
  if(count===2){const direct=cost(0,'left')+cost(1,'right'),swapped=cost(1,'left')+cost(0,'right');result.left=direct<=swapped?0:1;result.right=1-result.left;}
  else result[cost(0,'left')<=cost(0,'right')?'left':'right']=0;
  for(const side of ['left','right'])if(result[side]>=0 && anchors[side] && distance(landmarks[result[side]][0],anchors[side])>.28)result[side]=-1;
  return result;
}

/** Pixel-square crops preserve hand proportions; overlapping hands use the full image. */
export function handRegions(pose,width,height) {
  const regions=[];
  for(const [side,wristIndex,elbowIndex] of [['left',15,13],['right',16,14]]) {
    const wrist=pose?.[wristIndex],elbow=pose?.[elbowIndex];
    if(!reliable(wrist)||!reliable(elbow))continue;
    const dx=(wrist.x-elbow.x)*width,dy=(wrist.y-elbow.y)*height;
    const size=clamp(Math.hypot(dx,dy)*2,height*.2,Math.min(width,height)*.65);
    const cx=wrist.x*width+dx*.3,cy=wrist.y*height+dy*.3;
    regions.push({side,x:cx-size/2,y:cy-size/2,size,slot:side==='left'?0:1});
  }
  if(regions.length!==2)return [];
  const [a,b]=regions;
  const overlap=Math.max(0,Math.min(a.x+a.size,b.x+b.size)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.size,b.y+b.size)-Math.max(a.y,b.y));
  return overlap/Math.min(a.size*a.size,b.size*b.size)>.15?[]:regions;
}
export function remapHand(points,region,width,height,tileSize=320,gap=32) {
  const packedWidth=2*tileSize+gap,destinationX=region.slot*(tileSize+gap);
  return points.map(p=>({...p,x:(region.x+(p.x*packedWidth-destinationX)/tileSize*region.size)/width,y:(region.y+p.y*region.size)/height,z:p.z*packedWidth/tileSize*region.size/width}));
}
export class VisionPipeline {
  constructor(api,vision,config,options,workerMode=false){Object.assign(this,{api,vision,config,options,workerMode});this.tasks={};this.delegates=[];this.previousHands={};this.lastHandsAt=0;this.lastMetrics={};}
  async create(Task,model,options){
    const make=delegate=>Task.createFromOptions(this.vision,{...options,...(this.workerMode?{canvas:new OffscreenCanvas(2,2)}:{}),baseOptions:{modelAssetPath:model,delegate}});
    try{const task=await make('GPU');this.delegates.push('GPU');return task;}
    catch(error){console.warn('[MOCAP] GPU task unavailable; trying CPU:',error.message);const task=await make('CPU');this.delegates.push('CPU');return task;}
  }
  async init(){
    const c=this.config,o=this.options;
    try{
      if(c.profile==='precision'){
        this.tasks.pose=await this.create(this.api.PoseLandmarker,c.poseModelUrl,{runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:o.minPoseDetectionConfidence,minPosePresenceConfidence:o.minPosePresenceConfidence,minTrackingConfidence:.65,outputSegmentationMasks:false});
        this.tasks.face=await this.create(this.api.FaceLandmarker,c.faceModelUrl,{runningMode:'VIDEO',numFaces:1,minFaceDetectionConfidence:o.minFaceDetectionConfidence,minFacePresenceConfidence:o.minFacePresenceConfidence,minTrackingConfidence:.65,outputFaceBlendshapes:true,outputFacialTransformationMatrixes:true});
        this.tasks.hands=await this.create(this.api.HandLandmarker,c.handModelUrl,{runningMode:c.guidedHands?'IMAGE':'VIDEO',numHands:2,minHandDetectionConfidence:o.minHandLandmarksConfidence,minHandPresenceConfidence:o.minHandLandmarksConfidence});
      }else this.tasks.holistic=await this.create(this.api.HolisticLandmarker,c.holisticModelUrl,{...o,outputFaceBlendshapes:true});
      this.delegate=[...new Set(this.delegates)].join('/');return this;
    }catch(error){this.close();throw error;}
  }
  prepareHands(image,pose){
    const width=image.videoWidth||image.width,height=image.videoHeight||image.height;
    const regions=!this.config.guidedHands?[]:handRegions(pose,width,height);
    if(!regions.length)return {image,regions,width,height};
    if(!this.cropCanvas){this.cropCanvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(672,320):Object.assign(document.createElement('canvas'),{width:672,height:320});this.cropContext=this.cropCanvas.getContext('2d',{alpha:false});}
    this.cropContext.fillStyle='#000';this.cropContext.fillRect(0,0,672,320);
    for(const region of regions){const sx=Math.max(0,region.x),sy=Math.max(0,region.y),ex=Math.min(width,region.x+region.size),ey=Math.min(height,region.y+region.size);if(ex<=sx||ey<=sy)continue;const scale=320/region.size;this.cropContext.drawImage(image,sx,sy,ex-sx,ey-sy,region.slot*352+(sx-region.x)*scale,(sy-region.y)*scale,(ex-sx)*scale,(ey-sy)*scale);}
    return {image:this.cropCanvas,regions,width,height};
  }
  detect(image,timestamp){
    const timed=(name,fn)=>{const start=performance.now();const result=fn();components[name]=performance.now()-start;return result;};
    const components={};
    if(this.tasks.holistic){const result=timed('holistic',()=>this.tasks.holistic.detectForVideo(image,timestamp));this.lastMetrics={components,handInput:'integrated holistic'};return result;}
    const p=timed('body',()=>this.tasks.pose.detectForVideo(image,timestamp));
    const f=timed('face',()=>this.tasks.face.detectForVideo(image,timestamp));
    const prepared=timed('handPreparation',()=>this.prepareHands(image,p.landmarks[0]));
    const h=timed('hands',()=>this.config.guidedHands?this.tasks.hands.detect(prepared.image):this.tasks.hands.detectForVideo(prepared.image,timestamp));
    const facePoint=f.faceLandmarks[0]?.[1],nose=p.landmarks[0]?.[0];
    if(facePoint&&reliable(nose)&&Math.hypot((facePoint.x-nose.x)*prepared.width/prepared.height,facePoint.y-nose.y)>.28){f.faceLandmarks=[];f.faceBlendshapes=[];f.facialTransformationMatrixes=[];}
    const result={poseLandmarks:p.landmarks,poseWorldLandmarks:p.worldLandmarks,faceLandmarks:f.faceLandmarks,faceBlendshapes:f.faceBlendshapes,facialTransformationMatrixes:f.facialTransformationMatrixes};
    if(timestamp-this.lastHandsAt>700)this.previousHands={};
    let match;
    if(prepared.regions.length){
      match={left:-1,right:-1};
      for(let i=0;i<h.landmarks.length;i++){
        const pixelX=h.landmarks[i][0].x*672;
        const region=prepared.regions.find(r=>pixelX>=r.slot*352&&pixelX<=r.slot*352+320);
        if(!region)continue;
        const current=match[region.side];
        if(current<0 || (h.handedness[i]?.[0]?.score||0)>(h.handedness[current]?.[0]?.score||0))match[region.side]=i;
      }
    }else match=assignHands(h.landmarks,p.landmarks[0],h.handedness,{aspect:prepared.width/prepared.height,previous:this.previousHands});
    for(const side of ['left','right']){
      const i=match[side],region=prepared.regions.find(r=>r.side===side);
      const landmarks=i>=0?(region?remapHand(h.landmarks[i],region,prepared.width,prepared.height):h.landmarks[i]):null;
      result[side+'HandLandmarks']=landmarks?[landmarks]:[];
      result[side+'HandWorldLandmarks']=landmarks?[h.worldLandmarks[i]]:[];
      if(landmarks)this.previousHands[side]={...landmarks[0]};
    }
    if(result.leftHandLandmarks.length||result.rightHandLandmarks.length)this.lastHandsAt=timestamp;
    this.lastMetrics={components,handInput:prepared.regions.length?'pose-guided crops':'full frame'};
    return result;
  }
  async setOptions(o){
    const modeChanged=typeof o.guidedHands==='boolean'&&o.guidedHands!==this.config.guidedHands;
    const changed=keys=>keys.some(key=>o[key]!==undefined&&o[key]!==this.options[key]);
    const poseChanged=changed(['minPoseDetectionConfidence','minPosePresenceConfidence']);
    const faceChanged=changed(['minFaceDetectionConfidence','minFacePresenceConfidence']);
    const handsChanged=changed(['minHandLandmarksConfidence']);
    if(this.tasks.holistic){
      if(poseChanged||faceChanged||handsChanged){const {guidedHands,...thresholds}=o;await this.tasks.holistic.setOptions({...thresholds,outputFaceBlendshapes:true});}
    }else{
      if(poseChanged)await this.tasks.pose.setOptions({minPoseDetectionConfidence:o.minPoseDetectionConfidence,minPosePresenceConfidence:o.minPosePresenceConfidence});
      if(faceChanged)await this.tasks.face.setOptions({minFaceDetectionConfidence:o.minFaceDetectionConfidence,minFacePresenceConfidence:o.minFacePresenceConfidence});
      if(modeChanged||handsChanged)await this.tasks.hands.setOptions({...(modeChanged?{runningMode:o.guidedHands?'IMAGE':'VIDEO'}:{}),minHandDetectionConfidence:o.minHandLandmarksConfidence,minHandPresenceConfidence:o.minHandLandmarksConfidence});
    }
    if(typeof o.guidedHands==='boolean')this.config.guidedHands=o.guidedHands;
    this.options={...this.options,...o};
  }
  close(){for(const task of Object.values(this.tasks))task.close();this.tasks={};this.cropCanvas=null;this.cropContext=null;}
}
