// Three presentation modes, one Firebase data source and one memory editor.
export function createLobbyModes({semantic,createHouse,storage=globalThis.localStorage}) {
  const $=s=>document.querySelector(s);
  let mode='browse',house=null,users={},identity='',hasData=false;
  try{const saved=storage?.getItem('memoryHouseLobbyMode');if(['house','umap','browse'].includes(saved))mode=saved;}catch{}
  function activeView(){if(!hasData)return;if(mode==='house'){house??=createHouse();house.sync(users,identity);}else{semantic.setMode?.(mode);semantic.sync(users);}}
  function apply(){
    const houseMode=mode==='house';
    $('#lobbyView').dataset.lobbyMode=mode;
    $('#semanticLobby').classList.toggle('hidden',houseMode);
    $('#houseLobby').classList.toggle('hidden',!houseMode);
    $('#lobbyStatus').classList.toggle('hidden',houseMode);
    $('#houseStatus').classList.toggle('hidden',!houseMode);
    $('#lobbyModeSwitch').setAttribute('aria-checked',String(!houseMode));
    for(const button of document.querySelectorAll('[data-lobby-choice]'))button.setAttribute('aria-pressed',String(button.dataset.lobbyChoice===mode));
    $('#lobbyHeading').textContent={house:'Shared Memory House',umap:'Memory Constellation / 3D',browse:'Memory Rooms Exhibition'}[mode];
    $('#lobbyDescription').textContent=mode==='browse'?'One shared XYZ space. Orbit the archive, select a room, then enter another mind.':mode==='umap'?'Write a thought to conjure the semantic space. Drag to orbit and explore.':'Everyone gets a room. Enter a neighbor’s memory room.';
    $('#lobbySectionTitle').textContent=mode==='browse'?'01 / The floating archive':mode==='umap'?'01 / A geography of memory':'01 / The inhabited archive';
    $('#lobbyLegend').textContent='Shared memories · Synthetic test users are explicitly labeled';
    $('#lobbyFooterNote').textContent=mode==='browse'?'Drag to orbit · Scroll to zoom · Select, then enter':'Shared Minds / ITP';
    activeView();
  }
  function choose(next){mode=next;try{storage?.setItem('memoryHouseLobbyMode',mode);}catch{}apply();}
  for(const button of document.querySelectorAll('[data-lobby-choice]'))button.addEventListener('click',()=>choose(button.dataset.lobbyChoice));
  $('#lobbyModeSwitch').addEventListener('click',()=>choose(mode==='house'?'umap':'house'));
  apply();
  return {sync(next,key){users=next;identity=key;hasData=true;activeView();},resize(){if(mode==='house')house?.resize();else semantic.resize();},frame(){if(mode==='house')house?.frame();else semantic.frame?.();}};
}
