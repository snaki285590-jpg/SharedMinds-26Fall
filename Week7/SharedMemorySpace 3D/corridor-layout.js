import {ranked} from './semantic-math.js';

// Rank is the longitudinal axis; UMAP provides a bounded cluster offset.
// Missing embeddings never remove a Firebase resident from the corridor.
export function corridorLayout(query,records,positions,keys,identity) {
  const order=query?ranked(query,records,identity).map(r=>r.key).filter(k=>keys.includes(k)):[];
  for(const key of [...keys].sort())if(!order.includes(key))order.push(key);
  return order.map((key,i)=>{
    const xy=positions[key]||[.5,.5];
    const offset=j=>Number.isFinite(xy[j])?Math.max(0,Math.min(1,xy[j]))-.5:0;
    return {key,position:[(i%2?-1:1)*(3.1+offset(0)*2),0,-Math.floor(i/2)*8-3-offset(1)]};
  });
}
