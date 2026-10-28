import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {fileURLToPath} from 'node:url';
import {pca,normalizePoints,centroid,unit} from '../semantic-math.js';
const root=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const {document,window}=parseHTML(await readFile(root+'/index.html','utf8'));
globalThis.document=document;
let fail=false, generationFailure=true;
// Test-only worker with controlled 384D vectors, NOT production inference.
const vector=t=>{const v=Array(384).fill(0);v[0]=/home|family|grandmother/.test(t)?1:0;v[1]=/music|subway|night/.test(t)?1:0;v[2]=/ocean|summer/.test(t)?1:0;v[3]=/city|alone/.test(t)?1:0;return unit(v);};
globalThis.Worker=class{
  terminate(){}
  postMessage(data){setTimeout(()=>{
    if(fail){this.onmessage({data:{id:data.id,error:'fixture download failure'}});return;}
    const result=data.action==='project'?{points:normalizePoints(pca(data.vectors)),method:'TEST FIXTURE'}:
      {records:data.records.map(r=>{const vs=r.texts.map(vector);return {key:r.key,vector:centroid(r.activeCount?vs.slice(0,r.activeCount):vs)};})};
    this.onmessage({data:{id:data.id,result}});
  },50);}
};
let identity={key:'skyler',name:'Skyler'},visited='',saved=[],syntheticWrites=[];
const users={skyler:{profile:{name:'Skyler'},memoryText:'family home'},mina:{profile:{name:'Mina'},memoryText:'grandmother family home'},noah:{profile:{name:'Noah'},memoryText:'music subway night'},empty:{profile:{name:'Empty'}},emma:{profile:{name:'Emma',synthetic:true,source:'AI-generated test user'},memoryText:'ocean summer'}};
const {createMemorySpace}=await import(new URL('../memory-space.js',import.meta.url));
const space=createMemorySpace({host:document.querySelector('#apartmentGrid'),getIdentity:()=>identity,openRoom:key=>visited=key,saveMemory:async(key,text)=>saved.push({key,text}),callProxy:async()=>{if(generationFailure)throw new Error('Class allowlist rejected');return {output:JSON.stringify(Array.from({length:20},(_,i)=>({name:'Fixture '+i,memory:'family home '+i})))};},saveSynthetic:async rows=>syntheticWrites.push(rows),status:document.querySelector('#lobbyStatus')});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
space.sync(users);
assert.equal(document.querySelectorAll('.unplaced button').length,5,'Rooms remain accessible during first model download');
await wait(350);
assert(document.querySelector('.nearby-person').textContent.includes('Mina'));
assert(document.querySelector('.memory-star.synthetic').textContent.includes('SYNTHETIC'));
const before=document.querySelector('.you').style.left;
const input=document.querySelector('#memoryText');input.value='music subway night';input.dispatchEvent(new window.Event('input'));
await wait(350);
assert(document.querySelector('.nearby-person').textContent.includes('Noah'));
assert.notEqual(document.querySelector('.you').style.left,before);
document.querySelector('.nearby-person').click();assert.equal(visited,'noah');
// Rapid draft updates must settle on the final draft, despite older async work.
input.value='family home';input.dispatchEvent(new window.Event('input'));
await wait(130);input.value='ocean summer';input.dispatchEvent(new window.Event('input'));
await wait(450);
assert(document.querySelector('.nearby-person').textContent.includes('Emma'));
await wait(600);assert.equal(saved.at(-1).text,'ocean summer');assert.equal(saved.at(-1).key,'skyler');
// A pending save must retain its author after switching identity.
input.value='music';input.dispatchEvent(new window.Event('input'));
identity={key:'mina',name:'Mina'};space.sync(users);await wait(1100);
assert.equal(saved.at(-1).key,'skyler');assert.equal(saved.at(-1).text,'music');
const god=document.querySelector('#godButton');god.click();await wait(50);
assert.equal(syntheticWrites.length,0);assert(document.querySelector('#godStatus').textContent.includes('No test users added'));
generationFailure=false;
const oldCreate=document.createElement.bind(document);
document.createElement=(tag)=>{const el=oldCreate(tag);if(tag==='canvas'){el.getContext=()=>({fillRect(){},strokeRect(){},fillText(){},measureText:t=>({width:t.length*12})});el.toDataURL=()=> 'data:image/png;base64,TEST_FIXTURE';}return el;};
god.click();await wait(50);assert.equal(syntheticWrites[0].length,20);
assert(syntheticWrites[0].every(r=>r.profile.synthetic&&r.profile.source==='AI-generated test user'&&r.profile.generatedBy==='mina'));
// Failure leaves rooms accessible and exposes a retry.
fail=true;input.value='a new memory';input.dispatchEvent(new window.Event('input'));await wait(350);
assert(!document.querySelector('#retryEmbedding').classList.contains('hidden'));
assert.equal(document.querySelectorAll('.unplaced button').length,5);
fail=false;document.querySelector('#retryEmbedding').click();await wait(350);
assert(document.querySelector('#retryEmbedding').classList.contains('hidden'));
console.log('PASS DOM integration: loading-room access, semantic movement, ranking, room handoff, rapid-input races, autosave, identity isolation, God failure/success, disclosures, model failure/retry.');
