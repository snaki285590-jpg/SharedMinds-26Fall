import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {createLobbyModes} from '../lobby-modes.js';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
function fixture(initial){
  const {document}=parseHTML(html);globalThis.document=document;
  let value=initial,created=0,houseSync=0,semanticSync=0,frames=0;
  const storage={getItem:()=>value,setItem:(_,v)=>value=v};
  const semantic={sync(){semanticSync++;},resize(){}};
  const modes=createLobbyModes({storage,semantic,createHouse(){created++;return {sync(){houseSync++;},resize(){},frame(){frames++;}};}});
  return {document,modes,state:()=>({value,created,houseSync,semanticSync,frames})};
}
const first=fixture('umap'),doc=first.document;
assert.equal(doc.querySelector('#lobbyModeSwitch').getAttribute('aria-checked'),'true');
assert(doc.querySelector('#houseLobby').classList.contains('hidden'));
first.modes.sync({skyler:{}},'skyler');
assert.equal(first.state().semanticSync,1);assert.equal(first.state().created,0);
doc.querySelector('#memoryText').value='A draft to keep while switching';
doc.querySelector('#lobbyModeSwitch').click();
assert.equal(doc.querySelector('#lobbyModeSwitch').getAttribute('aria-checked'),'false');
assert(doc.querySelector('#semanticLobby').classList.contains('hidden'));
assert(!doc.querySelector('#houseLobby').classList.contains('hidden'));
assert.equal(doc.querySelector('#lobbyHeading').textContent,'Shared Memory House');
assert.equal(first.state().created,1);assert.equal(first.state().value,'house');
first.modes.frame();assert.equal(first.state().frames,1);
first.modes.sync({skyler:{},mina:{}},'skyler');assert.equal(first.state().houseSync,2);
doc.querySelector('#lobbyModeSwitch').click();
assert.equal(doc.querySelector('#memoryText').value,'A draft to keep while switching');
assert.equal(first.state().semanticSync,2);
first.modes.frame();assert.equal(first.state().frames,1,'Hidden house must not render');
doc.querySelector('#lobbyModeSwitch').click();assert.equal(first.state().created,1,'Reuse one renderer');
const remembered=fixture('house');
assert.equal(remembered.document.querySelector('#lobbyModeSwitch').getAttribute('aria-checked'),'false');
assert.equal(remembered.state().created,0,'Delay WebGL until data is supplied');
remembered.modes.sync({},'skyler');assert.equal(remembered.state().created,1);
// Private/storage-restricted browsing must still allow switching.
createLobbyModes({semantic:{sync(){},resize(){}},createHouse(){throw new Error('Should remain lazy');},storage:{getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}}});
remembered.document.querySelector('#lobbyModeSwitch').click();
const browsing=fixture(null);
assert.equal(browsing.document.querySelector('#lobbyView').dataset.lobbyMode,'browse');
browsing.modes.sync({skyler:{}},'skyler');
for(const mode of ['house','umap','browse']){
  browsing.document.querySelector('[data-lobby-choice="'+mode+'"]').click();
  assert.equal(browsing.document.querySelector('#lobbyView').dataset.lobbyMode,mode);
  assert.equal(browsing.document.querySelector('#semanticLobby').classList.contains('hidden'),mode==='house');
}
console.log('PASS mode switch: view visibility, labels, draft retention, shared data refresh, persistence, lazy renderer reuse and hidden rendering pause');
