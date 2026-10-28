// Pure math shared by the worker and local tests. No text hashes or fake embeddings.
export function unit(v) {
  const length = Math.hypot(...v);
  return length ? v.map(x => x / length) : v.map(() => 0);
}
export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  return a.reduce((sum, x, i) => sum + x * b[i], 0);
}
export function centroid(vectors) {
  if (!vectors.length) return null;
  return unit(vectors[0].map((_, i) => vectors.reduce((s, v) => s + v[i], 0) / vectors.length));
}
export function ranked(query, records, exclude) {
  return records.filter(r => r.key !== exclude && r.vector)
    .map(r => ({key: r.key, score: cosine(query, r.vector)}))
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
}
export function seededRandom(seed = 42) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
// Exact centered PCA via covariance power iteration. Used for < 4 residents,
// or if the UMAP dependency cannot load. Still reduces actual neural embeddings.
export function pca(vectors, dimensions=2) {
  if (!vectors.length) return [];
  const d = vectors[0].length;
  const mean = Array.from({length:d}, (_, j) => vectors.reduce((s,v) => s+v[j],0)/vectors.length);
  const rows = vectors.map(v => v.map((x,j) => x-mean[j]));
  const axes = [];
  const random = seededRandom();
  for (let axis=0; axis<dimensions; axis++) {
    let v = unit(Array.from({length:d}, () => random()-.5));
    for (let step=0;step<70;step++) {
      let next = Array(d).fill(0);
      for (const row of rows) { const w=cosine(row,v); row.forEach((x,j)=>next[j]+=x*w); }
      for (const prior of axes) { const w=cosine(next,prior); next=next.map((x,j)=>x-w*prior[j]); }
      v=unit(next);
    }
    axes.push(v);
  }
  return rows.map(row=>axes.map(axis=>cosine(row,axis)));
}
export function normalizePoints(points) {
  if (!points.length) return [];
  const dimensions=Array.from({length:points[0].length},(_,i)=>i);
  const min = dimensions.map(j=>Math.min(...points.map(p=>p[j])));
  const max = dimensions.map(j=>Math.max(...points.map(p=>p[j])));
  const scale = Math.max(...max.map((v,i)=>v-min[i]), 1e-8);
  return points.map(p=>p.map((x,j)=>(x-(max[j]+min[j])/2)/scale*.76+.5));
}
// Out-of-sample navigation: an explicit kernel-weighted kNN interpolation in
// the fitted map. Residents stay fixed while YOU moves. Ranking always uses
// original 384D vectors, never misleading distances from a flattened picture.
export function locate(query, records, positions) {
  const neighbors = ranked(query, records).filter(r=>positions[r.key]).slice(0,5);
  if (!neighbors.length) return [.5,.5];
  if (neighbors[0].score > .99999) return positions[neighbors[0].key];
  const weights=neighbors.map(r=>Math.exp((r.score-neighbors[0].score)*18));
  const total=weights.reduce((s,w)=>s+w,0);
  return positions[neighbors[0].key].map((_,j)=>neighbors.reduce((s,r,i)=>s+positions[r.key][j]*weights[i],0)/total);
}
export function parseGenerated(result) {
  const output=result?.output ?? result?.data?.output ?? result;
  const text=typeof output==='string'?output:Array.isArray(output)?output.join(''):'';
  const clean=text.replace(/```(?:json)?/g,'').trim();
  const start=clean.indexOf('['),end=clean.lastIndexOf(']');
  if (start<0 || end<start) throw new Error('The text model did not return a JSON list. Try again.');
  const rows=JSON.parse(clean.slice(start,end+1));
  if (!Array.isArray(rows) || rows.length<5 || rows.length>30) throw new Error('Expected 5–30 generated people.');
  return rows.map((r,i)=>{
    if(typeof r.name!=='string'||typeof r.memory!=='string'||!r.memory.trim()) throw new Error(`Invalid generated person ${i+1}.`);
    return {name:r.name.trim().slice(0,40)||`Person ${i+1}`,memory:r.memory.trim().slice(0,1200)};
  });
}

// Keep the query at the origin; preserve UMAP directions while using cosine
// similarity for radial proximity. This is a query-conditioned view, not a new UMAP fit.
export function conjure(query, records, positions, identity) {
  const anchors=records.filter(r=>r.key!==identity);
  const center=query?locate(query,anchors,positions):[.5,.5,.5];
  return Object.fromEntries(records.filter(r=>r.key===identity||positions[r.key]).map(r=>{
    if(r.key===identity)return [r.key,[0,0,0]];
    const delta=positions[r.key].map((v,i)=>v-(center[i]??.5));
    const length=Math.hypot(...delta);
    const radius=query?5+22*(1-Math.max(-1,Math.min(1,cosine(query,r.vector)))):Math.max(6,length*48);
    // An exact match needs a stable direction even when interpolation coincides.
    const direction=length>1e-6?delta.map(v=>v/length):unit(positions[r.key].map(v=>v+.1));
    return [r.key,direction.map(v=>v*radius)];
  }));
}
