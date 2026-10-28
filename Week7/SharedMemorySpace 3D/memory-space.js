import {createLocalSemanticClient} from './semantic-client.js';
import {aiTestRoomKeys} from './synthetic-users.js';
import {corridorLayout} from './corridor-layout.js';
import {createSemanticScene} from './semantic-scene.js';
import {ranked, locate, conjure, parseGenerated} from './semantic-math.js';
import {TEXT_MODEL, SYNTHETIC_COUNT} from './config.js';

const $ = selector => document.querySelector(selector);
const synthetic = u => Boolean(u?.profile?.synthetic || u?.profile?.demo);
const source = u => u?.profile?.source || 'hand-authored demo';
const assets = u => Object.values(u?.assets || {}).filter(Boolean);
const name = (u,key) => u?.profile?.name || key;
// Keep each input below this model's token budget, including Chinese text.
// A written memory drives the room vector; archived object vectors provide
// a centroid when no current memory is written. All chunks are embedded.
const chunks = text => String(text || '').trim().match(/[\s\S]{1,100}/gu) || [];
export function createMemorySpace({host, makeCutoutTexture, openRoom, getIdentity, saveMemory, callProxy, saveSynthetic, deleteSynthetic, getAiTestRooms, saveResponse, status}) {
  let users={}, identity='', records=[], positions={}, method='', signature='', fittedSignature='';
  let worker, serial=0, pending=new Map(), busy=false, requested=false, revision=0;
  let rebuildTimer, dirty=false, saveRevision=0, computing=false;
  const saveTimers=new Map();
  const input=$('#memoryText'), message=$('#memoryStatus'), retry=$('#retryEmbedding');
  const nearby=$('#nearbyPeople');
  const map=document.createElement('div');map.className='constellation';
  const stars=document.createElement('div');stars.className='constellation-stars';stars.setAttribute('aria-hidden','true');
  const lines=document.createElementNS('http://www.w3.org/2000/svg','svg');
  lines.setAttribute('viewBox','0 0 1000 1000');lines.setAttribute('preserveAspectRatio','none');lines.classList.add('constellation-lines');
  const points=document.createElement('div');points.className='constellation-points';
  const caption=document.createElement('div');caption.className='map-caption';
  const unplaced=document.createElement('div');unplaced.className='unplaced';
  const hint=document.createElement('p');hint.className='map-instruction';hint.textContent='Scroll to drift · drag to slide · select a doorway to enter.';
  map.append(stars,lines,points,caption,hint);host.replaceChildren(map,unplaced);

  let selected='',activeMode='browse';
  const detail=document.createElement('aside');detail.className='semantic-detail';detail.hidden=true;
  map.append(detail);
  const scene=createSemanticScene(map,points,key=>activeMode==='browse'?openRoom(key):select(key),makeCutoutTexture);
  const centerButton=document.createElement('button');centerButton.className='semantic-center';centerButton.textContent='Return to my thought';
  centerButton.onclick=()=>{selected='';detail.hidden=true;scene?.home();};map.append(centerButton);
  function select(key,fly=true) {
    const user=users[key];if(!user)return;
    selected=key;detail.hidden=false;detail.replaceChildren();
    const close=document.createElement('button');close.textContent='Close ×';close.onclick=()=>{detail.hidden=true;selected='';};
    const title=document.createElement('h3');title.textContent=name(user,key);
    const badge=document.createElement('p');badge.textContent=synthetic(user)?'SYNTHETIC / '+source(user):'REAL / shared memory participant';
    const text=document.createElement('p');text.textContent=key===identity?input.value:(user.memoryText||assets(user).map(a=>a.prompt).join(' · ')||'No memory text yet.');
    const score=document.createElement('p');score.className='detail-similarity';const me=records.find(r=>r.key===identity);
    const match=me&&!computing?ranked(me.vector,records).find(r=>r.key===key):null;
    score.textContent=match?`Semantic similarity · cosine ${match.score.toFixed(3)}`:'Semantic similarity pending';
    const enter=document.createElement('button');enter.textContent='Enter Memory Room ↗';enter.onclick=()=>openRoom(key);
    const response=document.createElement('textarea');response.placeholder='This reminds me of…';response.setAttribute('aria-label','This reminds me of');response.maxLength=2000;
    const send=document.createElement('button');send.textContent='Share connection';
    const feedback=document.createElement('p');
    send.onclick=async()=>{if(!response.value.trim())return;send.disabled=true;try{await saveResponse(key,response.value.trim());response.value='';feedback.textContent='Connection saved in this memory room.';}catch(e){feedback.textContent=e.message;}finally{send.disabled=false;}};
    detail.append(close,title,badge,text,score,enter,response,send,feedback);
    const replies=Object.values(user.connections||{}).flatMap(group=>Object.values(group||{})).filter(r=>r?.text).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,8);
    for(const reply of replies){const item=document.createElement('p');item.textContent=`${reply.fromName||'Visitor'} · ${reply.text}`;detail.append(item);}
    if(fly)scene?.focus(key);
  }
  function startWorker() {
    if(globalThis.location?.protocol==='file:')worker=createLocalSemanticClient();
    else{try{worker=new Worker(new URL('./embedding-worker.js',import.meta.url),{type:'module'});}catch{worker=createLocalSemanticClient();}}
    worker.onmessage=({data})=>{
      const request=pending.get(data.id);if(!request)return;
      if(data.progress){if(request.revision===revision)message.textContent=data.progress;return;}
      clearTimeout(request.timer);pending.delete(data.id);
      data.error?request.reject(new Error(data.error)):request.resolve(data.result);
    };
    worker.onerror=()=>stopWorker('Semantic worker could not start. Use Five Server over http://localhost and retry.');
  }
  function stopWorker(reason) {
    worker?.terminate();worker=null;
    for(const request of pending.values()){clearTimeout(request.timer);request.reject(new Error(reason));}pending.clear();
  }
  function request(action,payload) {
    if(!worker)startWorker();
    const id=++serial;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>stopWorker('Model download or inference timed out. Check your connection, then retry.'),600000);
      pending.set(id,{resolve,reject,timer,revision});worker.postMessage({id,action,...payload});
    });
  }
  function texts(key,u) {
    const memory=key===identity?input.value:u?.memoryText;
    return {texts:[memory,...assets(u).map(a=>a.prompt)].flatMap(chunks),activeCount:chunks(memory).length};
  }
  function data() {
    return Object.keys(users).sort().map(key=>({key,...texts(key,users[key])})).filter(r=>r.texts.length);
  }
  function schedule(force=false) {
    const next=JSON.stringify(data());
    if(next===signature&&!force){draw();return;}
    signature=next;revision++;requested=true;computing=true;
    draw();
    // Old embeddings must not drive a new draft's neighbors during inference.
    nearby.textContent='Finding people near this memory…';
    clearTimeout(rebuildTimer);rebuildTimer=setTimeout(build,120);
  }
  async function build() {
    if(busy||!requested)return;
    requested=false;busy=true;
    const generation=revision, snapshot=signature;
    try {
      retry.classList.add('hidden');
      const current=JSON.parse(snapshot);
      const result=current.length?await request('build',{records:current}):{records:[]};
      if(generation!==revision)return;
      const anchors=result.records.filter(r=>r.key!==identity);
      const fitKey=JSON.stringify(anchors);
      let nextPositions=positions,nextMethod=method;
      if(fitKey!==fittedSignature){
        const fitted=await request('project',{vectors:anchors.map(r=>r.vector)});
        nextPositions=Object.fromEntries(anchors.map((r,i)=>[r.key,fitted.points[i]]));
        nextMethod=fitted.method;
      }
      if(generation!==revision)return;
      records=result.records;positions=nextPositions;method=nextMethod;fittedSignature=fitKey;computing=false;
      message.textContent=dirty?'Your draft has a position. Saving…':'Your memory has a position. Edit it to conjure the space around you.';
      draw();
    }catch(error){
      if(generation===revision){
        records=[];positions={};fittedSignature='';computing=false;draw();
        message.textContent=`Semantic model unavailable: ${error.message}. Check your connection, then retry. Saved rooms remain available below.`;
        nearby.textContent='Semantic neighbors unavailable until the model loads.';
        retry.classList.remove('hidden');
      }
    }finally{busy=false;if(requested)build();}
  }
  function labeled(key) {
    const u=users[key];return `${name(u,key)}${synthetic(u)?' / SYNTHETIC':''}`;
  }
  function roomButton(key) {
    const button=document.createElement('button');
    button.textContent=labeled(key);button.addEventListener('click',()=>scene?scene.enter(key):openRoom(key));return button;
  }
  function draw() {
    const focused=document.activeElement?.dataset.room;
    const old=new Map([...points.children].map(el=>[el.dataset.room,el]));
    const me=records.find(r=>r.key===identity);
    const nearest=me&&!computing?ranked(me.vector,records,identity).slice(0,4):[];
    const ownPosition=me?locate(me.vector,records.filter(r=>r.key!==identity),positions):null;
    const visible=new Set();
    for(const record of records){
      const key=record.key, u=users[key];if(!u)continue;
      const xy=key===identity?ownPosition:positions[key];if(!xy)continue;
      visible.add(key);
      let button=old.get(key);
      if(!button){
        button=roomButton(key);button.dataset.room=key;points.append(button);
      }
      button.className=`memory-star ${synthetic(u)?'synthetic ':''}${key===identity?'you ':''}${nearest.some(r=>r.key===key)?'related':''}`;
      const label=key===identity?'YOU NOW':labeled(key);
      button.textContent=label;
      button.title=`${labeled(key)}\n${u.memoryText||assets(u).map(a=>a.prompt).join(' · ')||'Empty memory room'}\n${synthetic(u)?source(u):'Shared memory room'}\nClick to meet this memory`;
      button.setAttribute('aria-label',`Meet ${labeled(key)} in 3D space`);
      button.style.left=`${xy[0]*100}%`;button.style.top=`${xy[1]*100}%`;
    }
    for(const [key,button] of old)if(!visible.has(key))button.remove();
    // All Firebase residents have a doorway, including empty/unembedded rooms.
    // Cosine determines depth; UMAP's horizontal coordinate preserves clusters.
    const rows=corridorLayout(!computing?me?.vector:null,records,positions,Object.keys(users),identity).map(({key,position})=>{
      if(!visible.has(key)){const button=roomButton(key);button.dataset.room=key;button.className='memory-star';points.append(button);visible.add(key);}
      const label=[...points.children].find(el=>el.dataset.room===key);
      const hints=assets(users[key]).slice(0,3).map(a=>a.prompt?.slice(0,34)).filter(Boolean);
      label.dataset.doorName=labeled(key);
      label.textContent=labeled(key)+(hints.length?'\n'+hints.join(' · '):'');
      label.classList.toggle('synthetic',synthetic(users[key]));
      return {key,synthetic:synthetic(users[key]),objectCount:Math.min(3,assets(users[key]).length),images:assets(users[key]).filter(a=>a.imageUrl).slice(0,3).map(a=>({imageUrl:a.imageUrl})),position};
    });
    const cloud=conjure(me?.vector,records,positions,identity);
    scene?.sync(rows,records,records.filter(r=>cloud[r.key]).map(r=>({key:r.key,position:cloud[r.key],synthetic:synthetic(users[r.key]),you:r.key===identity}))); 
    if(selected&&!users[selected]){selected='';detail.hidden=true;}
    if(selected){const score=detail.querySelector('.detail-similarity');const match=nearest.find(r=>r.key===selected)||(!computing&&me?ranked(me.vector,records).find(r=>r.key===selected):null);if(score)score.textContent=match?`Semantic similarity · cosine ${match.score.toFixed(3)}`:'Semantic similarity pending';}
    lines.replaceChildren();
    if(ownPosition)for(const r of nearest){
      const xy=positions[r.key];if(!xy)continue;
      const line=document.createElementNS(lines.namespaceURI,'line');
      for(const [attribute,value] of Object.entries({x1:ownPosition[0]*1000,y1:ownPosition[1]*1000,x2:xy[0]*1000,y2:xy[1]*1000}))line.setAttribute(attribute,value);
      lines.append(line);
    }
    caption.textContent=records.length?`${method} · cosine proximity / ${rows.length} doorways`:'Semantic model loading · all rooms remain open';
    hint.hidden=false;
    nearby.replaceChildren();
    if(computing)nearby.textContent='Finding people near this memory…';
    else if(!me)nearby.textContent='Write a memory to find related people.';
    else if(!nearest.length)nearby.textContent='Your thought is here. Add people to discover a neighbor.';
    for(const [index,r] of nearest.entries()){
      const user=users[r.key],button=roomButton(r.key);
      button.className='nearby-person memory-neighbor-card';button.replaceChildren();
      const preview=document.createElement('span');preview.className='neighbor-preview';
      // Architectural fallback is a symbol, never a fabricated AI object image.
      const doorway=document.createElement('span');doorway.className='neighbor-doorway';doorway.setAttribute('aria-hidden','true');preview.append(doorway);
      const images=assets(user).filter(a=>typeof a.imageUrl==='string'&&/^(https?:\/\/|data:image\/)/i.test(a.imageUrl)).slice(0,3);
      for(const [i,asset] of images.entries()){
        const image=document.createElement('img');image.src=asset.imageUrl;image.alt='';image.loading='lazy';image.decoding='async';
        image.style.setProperty('--object-index',i);
        image.addEventListener('load',()=>{doorway.hidden=true;});
        image.addEventListener('error',()=>{image.remove();if(!preview.querySelector('img'))doorway.hidden=false;});
        preview.append(image);
      }
      const rank=document.createElement('span');rank.className='neighbor-rank';rank.textContent=String(index+1).padStart(2,'0');preview.append(rank);
      const content=document.createElement('span');content.className='neighbor-content';
      const heading=document.createElement('span');heading.className='neighbor-heading';
      const title=document.createElement('strong');title.textContent=name(user,r.key);heading.append(title);
      if(synthetic(user)){const badge=document.createElement('span');badge.className='neighbor-origin';badge.textContent='SYNTHETIC';heading.append(badge);}
      const text=document.createElement('span');text.className='neighbor-excerpt';
      text.textContent=(user?.memoryText||assets(user).map(a=>a.prompt).join(' · ')).slice(0,180);
      const footer=document.createElement('span');footer.className='neighbor-footer';
      const affinity=document.createElementNS(lines.namespaceURI,'svg');affinity.classList.add('neighbor-affinity');affinity.setAttribute('viewBox','0 0 100 20');
      affinity.setAttribute('role','img');affinity.setAttribute('aria-label',`Semantic affinity, cosine similarity ${r.score.toFixed(3)}. Shorter link means more related.`);
      const end=15+(1-Math.max(-1,Math.min(1,r.score)))/2*65;
      for(const [tag,attributes] of [['line',{x1:5,y1:10,x2:end,y2:10}],['circle',{cx:5,cy:10,r:3}],['circle',{cx:end,cy:10,r:3}]]){
        const node=document.createElementNS(lines.namespaceURI,tag);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);affinity.append(node);
      }
      const visit=document.createElement('span');visit.textContent='Meet this memory ↗';footer.append(affinity,visit);
      content.append(heading,text,footer);button.append(preview,content);
      button.title=`${labeled(r.key)} · Cosine ${r.score.toFixed(3)} · ${synthetic(user)?source(user):'Shared memory room'}`;
      const highlight=active=>{const node=[...points.children].find(el=>el.dataset.room===r.key);node?.classList.toggle('preview-hover',active);};
      for(const event of ['pointerenter','focus'])button.addEventListener(event,()=>highlight(true));
      for(const event of ['pointerleave','blur'])button.addEventListener(event,()=>highlight(false));
      nearby.append(button);
    }
    unplaced.replaceChildren();
    const waiting=Object.keys(users).filter(key=>activeMode==='umap'?!records.some(r=>r.key===key&&cloud[key]):!visible.has(key));
    if(waiting.length){
      const label=document.createElement('p');label.textContent='Saved rooms / semantic positions unavailable — select a name to enter';unplaced.append(label);
      for(const key of waiting){const button=document.createElement('button');button.textContent=labeled(key);button.onclick=()=>openRoom(key);unplaced.append(button);}
    }
    status.textContent=`${Object.keys(users).length} rooms · ${Object.values(users).filter(synthetic).length} synthetic`;
    if(focused) [...points.children].find(el=>el.dataset.room===focused)?.focus({preventScroll:true});
  }
  function sync(nextUsers) {
    users=nextUsers;
    const nextKey=getIdentity().key;
    const identityChanged=identity!==nextKey;
    if(identityChanged){
      identity=nextKey;saveRevision++;dirty=false;
      input.value=users[identity]?.memoryText||'';
      fittedSignature='';
    }else if(!dirty){
      input.value=users[identity]?.memoryText||'';
    }
    schedule(identityChanged);
  }
  input.addEventListener('input',()=>{
    dirty=true;const version=++saveRevision,key=identity,text=input.value;
    clearTimeout(saveTimers.get(key));message.textContent='Listening to your memory…';schedule();
    saveTimers.set(key,setTimeout(async()=>{
      try{
        await saveMemory(key,text);
        if(version!==saveRevision||identity!==key)return;
        dirty=false;
        if(!busy)message.textContent='Memory saved. Your words decide who is nearby.';
      }catch(error){if(version===saveRevision){message.textContent=`Memory not saved: ${error.message}. Edit again to retry.`;}}
    },900));
  });
  retry.addEventListener('click',()=>schedule(true));
  // Leaving the draft immediately is safe: the pending save captures the author
  // and text. Saves keep their original author even after changing identity.
  const deletionDialog=document.createElement('dialog');deletionDialog.className='delete-ai-dialog';
  const deletionTitle=document.createElement('h3');deletionTitle.textContent='Delete AI test rooms';
  const deletionMessage=document.createElement('p');deletionMessage.setAttribute('role','status');deletionMessage.setAttribute('aria-live','polite');
  const deletionNote=document.createElement('p');deletionNote.textContent='Real users and hand-authored demos are kept. Deleted test memories and connections cannot be restored.';
  const deletionActions=document.createElement('div');deletionActions.className='row';
  const cancelDelete=document.createElement('button');cancelDelete.textContent='Cancel';cancelDelete.onclick=()=>deletionDialog.close();
  const confirmDelete=document.createElement('button');confirmDelete.className='danger';confirmDelete.textContent='Delete test rooms';
  deletionActions.append(cancelDelete,confirmDelete);deletionDialog.append(deletionTitle,deletionMessage,deletionNote,deletionActions);document.body.append(deletionDialog);
  let deletionKeys=[],deleting=false;
  deletionDialog.addEventListener('cancel',e=>{if(deleting)e.preventDefault();});
  function showDeletion(){
    if(deleting)return;
    deletionKeys=getAiTestRooms?getAiTestRooms():aiTestRoomKeys(users,getIdentity().key);
    deletionMessage.textContent=deletionKeys.length?`Found ${deletionKeys.length} AI-generated test rooms. Delete these rooms from Firebase?`:'No AI-generated test rooms found in the current data.';
    confirmDelete.disabled=!deletionKeys.length;cancelDelete.textContent='Cancel';
    if(!deletionDialog.open)deletionDialog.showModal();
  }
  $('#deleteAiRoomsMenu').addEventListener('click',showDeletion);
  $('#deleteAiRooms').addEventListener('click',showDeletion);
  confirmDelete.addEventListener('click',async()=>{
    if(deleting||!deletionKeys.length)return;
    deleting=true;confirmDelete.disabled=true;cancelDelete.disabled=true;
    $('#deleteAiRooms').disabled=true;$('#godButton').disabled=true;
    deletionMessage.textContent=`Deleting ${deletionKeys.length} test rooms… Waiting for Firebase confirmation.`;
    const waitNotice=setTimeout(()=>{if(deleting)deletionMessage.textContent='Still waiting for Firebase. Check your connection; the deletion has not been confirmed yet.';},10000);
    try{
      const count=await deleteSynthetic(deletionKeys);
      deletionMessage.textContent=`Deleted ${count} AI test rooms. Real users and hand-authored demos were kept.`;
      $('#godStatus').textContent=deletionMessage.textContent;deletionKeys=[];cancelDelete.textContent='Done';
    }catch(error){
      deletionMessage.textContent=`Deletion failed: ${error.message}. Check your Firebase connection and database write permissions.`;
      confirmDelete.disabled=false;
    }finally{
      clearTimeout(waitNotice);deleting=false;cancelDelete.disabled=false;$('#deleteAiRooms').disabled=false;$('#godButton').disabled=false;
    }
  });
  $('#godButton').addEventListener('click',async()=>{
    const button=$('#godButton'),feedback=$('#godStatus');if(button.disabled)return;
    button.disabled=true;feedback.textContent='Imagining 20 clearly synthetic lives…';
    const creator=getIdentity().key;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),180000);
    try{
      const response=await callProxy(TEXT_MODEL,{
        prompt:`Generate ${SYNTHETIC_COUNT} fictional test users for a memory-based social artwork. Return ONLY a JSON array of objects with name and memory (a first-person memory of 1-2 sentences). Names must be fictional. Include diverse, nuanced experiences across leaving home, migration, family food, childhood objects, late-night cities, music, grief, friendships, nature, belonging. Create several overlapping themes without repeating memories. Batch variation: ${crypto.randomUUID()}. No markdown.`,
        max_new_tokens:2400,temperature:.95
      },controller.signal);
      const rows=parseGenerated(response);
      const generatedAt=Date.now();
      // Commit atomically only AFTER valid model output; errors never silently
      // substitute hand-written templates or claim successful AI generation.
      await saveSynthetic(rows.map((r,i)=>({
        profile:{name:r.name,synthetic:true,source:'AI-generated test user',model:TEXT_MODEL,generatedBy:creator,createdAt:generatedAt},
        memoryText:r.memory,
        assets:{memory_card:{id:'memory_card',prompt:r.memory,imageUrl:memoryCard(r.memory),position:[0,1.5,0],rotation:[0,0,0],scale:[1,1,1],order:0,timestamp:generatedAt+i,synthetic:true,source:'Typeset text card; image is not AI-generated'}}
      })));
      feedback.textContent=`Added ${rows.length} AI-generated test users. Their dashed rooms are shared in Firebase.`;
    }catch(error){feedback.textContent=`No test users added. ${error.name==='AbortError'?'The AI request timed out.':error.message} If this model is blocked, choose your class-approved text model in config.js. Hand-authored demos remain a separate option.`;}
    finally{clearTimeout(timeout);button.disabled=false;}
  });
  return {sync,setMode(mode){activeMode=mode;detail.hidden=true;scene?.setMode(mode);draw();hint.textContent=mode==='browse'?'Drag to orbit · scroll to zoom · select, then enter':'Drag to orbit · scroll to observe';},returnFromRoom(key){scene?.returnFromRoom(key);},resize(){scene?.resize();},frame(){scene?.frame();},nearest(key){const r=records.find(r=>r.key===key);return r?ranked(r.vector,records,key):[];}};
}
function memoryCard(text) {
  // A readable object for synthetic users inside the ORIGINAL 3D room. This
  // typeset card is explicitly not an AI-generated image / reconstructed object.
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=640;
  const c=canvas.getContext('2d');c.fillStyle='#e4e4df';c.fillRect(25,25,590,590);
  c.strokeStyle='#555';c.strokeRect(35,35,570,570);
  c.fillStyle='#333';c.font='16px monospace';c.fillText('SYNTHETIC / AI-GENERATED MEMORY',60,80);
  c.font='25px Georgia';
  let line='',y=150;
  for(const word of text.split(/\s+/)){
    if(c.measureText(line+word).width>510){c.fillText(line,60,y);line='';y+=36;if(y>540)break;}
    line+=word+' ';
  }
  if(y<=540)c.fillText(line,60,y);
  return canvas.toDataURL('image/png');
}
