import {OneEuroVector} from '../src/core.js';
const dt=1/30,smoothing=.55,a=1-Math.exp(-(dt*1000)/(1+219*smoothing));
const f=new OneEuroVector();let old=0,oldError=0,newError=0,count=0;
for(let i=0;i<300;i++){
 const x=Math.sin(i*2)*.02;old+=a*(x-old);const next=f.filter({x,y:0,z:0},dt,smoothing)[0];
 if(i>60){oldError+=old*old;newError+=next*next;count++;}
}
let oldStep=0,newStep=0;old=0;const step=new OneEuroVector();step.filter({x:0,y:0,z:0},dt,smoothing);
for(let i=1;i<=90;i++){old+=a*(1-old);const value=step.filter({x:1,y:0,z:0},dt,smoothing)[0];if(!oldStep&&old>=.9)oldStep=i*dt*1000;if(!newStep&&value>=.9)newStep=i*dt*1000;}
console.log(JSON.stringify({scenario:'Deterministic synthetic 30 Hz signal; smoothing=0.55; 0.02 m sinusoidal jitter; independent 1 m step. This is a filter comparison, not a webcam accuracy benchmark.',v2:{jitterRmsMeters:Math.sqrt(oldError/count),step90PercentMs:oldStep},v3:{jitterRmsMeters:Math.sqrt(newError/count),step90PercentMs:newStep}},null,2));
