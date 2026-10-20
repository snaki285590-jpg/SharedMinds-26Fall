import {centroid, pca, seededRandom, normalizePoints} from './semantic-math.js';
// Pinned browser-only, quantized multilingual sentence transformer, 384D.
// English and Chinese use the SAME model and space. WASM CPU / one thread
// avoids WebGPU requirements and SharedArrayBuffer / cross-origin isolation.
const MODEL='Xenova/paraphrase-multilingual-MiniLM-L12-v2';
let extractorPromise, umapPromise, databasePromise;
const memoryCache=new Map();
function database() {
  return databasePromise ??= new Promise(resolve=>{
    if (!self.indexedDB) return resolve(null);
    const request=indexedDB.open('memory-constellation-embeddings-v1',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('vectors');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>resolve(null);
  });
}
async function cached(text) {
  const key=MODEL+'::'+text;
  if(memoryCache.has(key)) return memoryCache.get(key);
  const db=await database();
  if(!db) return null;
  return new Promise(resolve=>{
    try {const r=db.transaction('vectors').objectStore('vectors').get(key);
      r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>resolve(null);
    } catch {resolve(null);}
  });
}
async function remember(text, vector) {
  const key=MODEL+'::'+text;
  memoryCache.set(key,vector);
  const db=await database();
  try {db?.transaction('vectors','readwrite').objectStore('vectors').put(vector,key);} catch {/* Cache is optional. */}
}
async function extractor(id) {
  if(!extractorPromise) extractorPromise=(async()=>{
    const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
    env.allowLocalModels=false;
    env.backends.onnx.wasm.numThreads=1;
    return pipeline('feature-extraction',MODEL,{quantized:true,progress_callback:p=>{
      if(p.status==='progress') self.postMessage({id,progress:`Downloading semantic model… ${Math.round(p.progress||0)}% (${p.file})`});
    }});
  })().catch(error=>{extractorPromise=null;throw error;});
  return extractorPromise;
}
async function embed(text,id) {
  const hit=await cached(text);
  if(hit) return hit;
  const model=await extractor(id);
  const output=await model(text,{pooling:'mean',normalize:true});
  const vector=Array.from(output.data);
  if(vector.length!==384||!vector.every(Number.isFinite)) throw new Error('Invalid neural embedding.');
  await remember(text,vector);
  return vector;
}
async function handle({id,action,records}) {
  if(action!=='build') throw new Error('Unknown worker action');
  const embedded=[];
  for(const [i,r] of records.entries()) {
    self.postMessage({id,progress:`Reading memories… ${i+1}/${records.length}`});
    const vectors=[];
    // Every memory/object is embedded individually. A written memory is the
    // active expression; otherwise archived object vectors define the room.
    for(const text of r.texts) vectors.push(await embed(text,id));
    embedded.push({key:r.key,vector:centroid(r.activeCount?vectors.slice(0,r.activeCount):vectors)});
  }
  return {records:embedded};
}
async function project({vectors}) {
  let points,method='PCA · small collection';
  if(vectors.length>=4) {
    try {
      umapPromise ??= import('./vendor/umap-js-1.4.0.mjs');
      const {UMAP}=await umapPromise;
      const umap=new UMAP({nComponents:2,nNeighbors:Math.min(10,vectors.length-1),nEpochs:250,minDist:.22,random:seededRandom(42)});
      points=await umap.fitAsync(vectors);
      method='UMAP';
      if(!points.flat().every(Number.isFinite)) throw new Error('Non-finite UMAP projection');
    } catch(error) {
      umapPromise=null;
      points=pca(vectors);method='PCA · UMAP unavailable';
    }
  } else points=pca(vectors);
  return {points:normalizePoints(points),method};
}
// Serialize inference so rapid edits cannot overlap WASM sessions.
let queue=Promise.resolve();
self.onmessage=({data})=>{
  queue=queue.then(async()=>{
    try {const result=data.action==='project'?await project(data):await handle(data);self.postMessage({id:data.id,result});}
    catch(error){self.postMessage({id:data.id,error:error.message});}
  });
};
