export function lensSettings(value){
 const v=Math.max(0,Math.min(1,value));
 const t=Math.max(0,(v-.5)/.5);
 return {fov:32+50*v+63*t*t*(3-2*t),strength:t*t*(3-2*t)*2.6};
}
export function lensPointer(x,y,aspect,strength){
 const px=x*.5*aspect,py=y*.5;
 const r=Math.hypot(px,py),blend=Math.max(0,Math.min(1,strength/2.6));
 const normal=(1+strength*r*r)/(1+strength*.18);
 const fov=32+50*(.5+.5*inverseSmooth(blend))+63*blend;
 const fish=r<1e-6?1.25/(.96*Math.tan(fov*Math.PI/360)):Math.tan(Math.min(r/.48,1.08)*1.25)/(2*r*Math.tan(fov*Math.PI/360));
 const mix=blend*blend*(3-2*blend),factor=normal*(1-mix)+fish*mix;
 return [x*factor,y*factor];
}
function inverseSmooth(value){let lo=0,hi=1;for(let i=0;i<24;i++){const m=(lo+hi)/2;if(m*m*(3-2*m)<value)lo=m;else hi=m;}return (lo+hi)/2;}
