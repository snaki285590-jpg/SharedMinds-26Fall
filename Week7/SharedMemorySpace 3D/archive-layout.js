// Shared XYZ positions; depth and perspective determine apparent room size.
// Semantic rank fills the central slots first; no saved room dimensions change.
export function archiveLayout(count, initialSeed=13791){
  if(!count)return [];
  const points=[];
  let seed=initialSeed>>>0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const halfHeight=Math.max(5,count*1.4);
  for(let i=0;i<count;i++){
    let chosen;
    for(let attempt=0;attempt<600;attempt++){
      const candidate=[(random()-.5)*10.5,(random()-.5)*halfHeight*2,(random()-.5)*9];
      if(points.every(p=>Math.abs(p[0]-candidate[0])>6||Math.abs(p[1]-candidate[1])>4.6||Math.abs(p[2]-candidate[2])>4.7)){
        chosen=candidate;break;
      }
    }
    if(!chosen)chosen=[(random()-.5)*10,Math.max(0,...points.map(p=>p[1]))+5.1,(random()-.5)*8];
    points.push(chosen);
  }
  // Put the most semantically relevant rooms near the composition's center.
  points.sort((a,b)=>Math.abs(a[1])-Math.abs(b[1]));
  const centerY=(Math.min(...points.map(p=>p[1]))+Math.max(...points.map(p=>p[1])))/2;
  return points.map(([x,y,z])=>[x,y-centerY,z]);
}
// Equal physical room sizes. Apparent size comes only from camera perspective.
export function archiveRoomStyle(){
  return {scale:[1,1,1],yaw:0};
}
