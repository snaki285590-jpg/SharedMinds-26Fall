import assert from 'node:assert/strict';
import {UMAP} from '../vendor/umap-js-1.4.0.mjs';
import {seededRandom,unit,normalizePoints} from '../semantic-math.js';
for(const size of [4,5,20]){
  const random=seededRandom(12);
  const vectors=Array.from({length:size},()=>unit(Array.from({length:384},()=>random()-.5)));
  const fit=()=>new UMAP({nComponents:3,nNeighbors:Math.min(10,size-1),nEpochs:250,minDist:.22,random:seededRandom(42)}).fitAsync(vectors);
  const points=await fit();
  assert.equal(points.length,size);assert(points.every(p=>p.length===3));assert(points.flat().every(Number.isFinite));
  assert.deepEqual(points,await fit(),'Fixed input and seed should produce identical coordinates');
  assert(normalizePoints(points).flat().every(v=>v>=0&&v<=1));
  console.log(`PASS bundled UMAP: ${size} x 384D → 3D, finite and reproducible`);
}
