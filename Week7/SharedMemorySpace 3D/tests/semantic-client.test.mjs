import assert from 'node:assert/strict';
import {createLocalSemanticClient} from '../semantic-client.js';
const client=createLocalSemanticClient();
const result=await new Promise((resolve,reject)=>{
 client.onmessage=({data})=>data.error?reject(new Error(data.error)):resolve(data.result);
 client.postMessage({id:1,action:'project',vectors:[[1,0,0],[0,1,0],[0,0,1]]});
});
assert.equal(result.points.length,3);assert.ok(result.points.flat().every(Number.isFinite));
client.terminate();
console.log('PASS local semantic bridge: actual shared projection engine, finite results, worker-compatible response');
