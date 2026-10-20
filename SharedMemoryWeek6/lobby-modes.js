// Mode changes only affect presentation. No database writes, navigation, or draft
// resets; the old House renderer and the semantic map share the same residents.
export function createLobbyModes({semantic,createHouse,storage=globalThis.localStorage}) {
  const $=selector=>document.querySelector(selector);
  const toggle=$('#lobbyModeSwitch');
  let mode='umap',house=null,users={},identity='',hasData=false;
  try { if(storage?.getItem('memoryHouseLobbyMode')==='house')mode='house'; } catch { /* Storage is optional. */ }
  function activeView() {
    if(!hasData)return;
    if(mode==='house') {
      house ??= createHouse();
      house.sync(users,identity);
    } else semantic.sync(users);
  }
  function apply() {
    const umap=mode==='umap';
    toggle.setAttribute('aria-checked',String(umap));
    $('#lobbyView').dataset.lobbyMode=mode;
    $('#semanticLobby').classList.toggle('hidden',!umap);
    $('#houseLobby').classList.toggle('hidden',umap);
    $('#lobbyStatus').classList.toggle('hidden',!umap);
    $('#houseStatus').classList.toggle('hidden',umap);
    $('#houseModeLabel').classList.toggle('active',!umap);
    $('#umapModeLabel').classList.toggle('active',umap);
    $('#lobbyHeading').textContent=umap?'Memory Constellation':'Shared Memory House';
    $('#lobbyDescription').textContent=umap
      ? 'Memories decide who becomes a neighbor. Write a thought, drift toward someone, and enter their memory room.'
      : 'Everyone gets a room. Explore the original apartment house and enter a neighbor’s memory room.';
    $('#lobbySectionTitle').textContent=umap?'01 / A geography of memory':'01 / The inhabited archive';
    $('#lobbyLegend').textContent=umap?'Solid / people · Dashed / synthetic test users · Ring / you':'— marks your room · Synthetic test users are labeled';
    $('#lobbyFooterNote').textContent=umap?'Semantic neighbors, not physical distance · Shared Minds / ITP':'Select an apartment to enter · Shared Minds / ITP';
    activeView();
  }
  toggle.addEventListener('click',()=>{
    mode=mode==='umap'?'house':'umap';
    try {storage?.setItem('memoryHouseLobbyMode',mode);} catch { /* In-memory switching still works. */ }
    apply();
  });
  apply();
  return {
    sync(nextUsers,key){users=nextUsers;identity=key;hasData=true;activeView();},
    resize(){if(mode==='house')house?.resize();else semantic.resize();},
    frame(){if(mode==='house')house?.frame();}
  };
}
