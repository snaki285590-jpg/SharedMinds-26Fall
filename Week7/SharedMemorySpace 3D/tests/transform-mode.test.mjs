import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {createLobbyModes} from '../lobby-modes.js';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const main=await readFile(new URL('../main.js',import.meta.url),'utf8');
const start=main.indexOf('document\n  .querySelectorAll',main.indexOf('OWNER TRANSFORM CONTROLS'));
const end=main.indexOf('async function persistSelectedTransform',start);
const binding=main.slice(start,end);
function setup(source,legacy=false){
 const {document}=parseHTML(html);globalThis.document=document;
 let mode='translate';
 const transform={setMode(value){mode=value}};
 const toggle=createLobbyModes({semantic:{sync(){},resize(){}},createHouse(){return {sync(){},resize(){},frame(){}}},storage:{getItem:()=>null,setItem(){}}});
 if(legacy)document.querySelector('#lobbyView').dataset.mode='umap';
 new Function('document','transform',source)(document,transform);
 const visit=document.createElement('button');visit.textContent='Enter fixture room';document.querySelector('#semanticLobby').append(visit);
 const gizmos={translate:{children:[]},rotate:{children:[]},scale:{children:[]}};
 return {document,visit,toggle,mode:()=>mode,render:()=>gizmos[mode].children};
}
// Reproduce the exact bug: broad selectors also bind the homepage section.
const old=binding.replaceAll('button.tool-btn[data-mode]','[data-mode]').replace('        if (!["translate", "rotate", "scale"].includes(mode)) return;\n','');
const broken=setup(old,true);broken.visit.click();assert.equal(broken.mode(),'umap');assert.throws(broken.render,TypeError);
// Fixed code remains safe even if a legacy data-mode attribute is still present.
const fixed=setup(binding,true);fixed.visit.click();assert.equal(fixed.mode(),'translate');assert.doesNotThrow(fixed.render);
fixed.document.querySelector('#lobbyModeSwitch').click();assert.equal(fixed.mode(),'translate');assert.doesNotThrow(fixed.render);
for(const mode of ['rotate','scale','translate']){
 fixed.document.querySelector(`button.tool-btn[data-mode="${mode}"]`).click();assert.equal(fixed.mode(),mode);assert.doesNotThrow(fixed.render);
}
const invalid=fixed.document.querySelector('button.tool-btn[data-mode="translate"]');invalid.dataset.mode='house';invalid.click();assert.equal(fixed.mode(),'translate');
const clean=setup(binding);assert.equal(clean.document.querySelector('#lobbyView').dataset.mode,undefined);
assert.equal(clean.document.querySelector('#lobbyView').dataset.lobbyMode,'umap');
console.log('PASS reproduced homepage bubbling → invalid TransformControls mode → children error; fixed event scope, namespace, valid tools and invalid-mode guard');
