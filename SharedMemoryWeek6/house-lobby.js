import * as THREE from "three";

// Original Week 5 architectural cutaway renderer, isolated from the semantic map.
// Both modes open the SAME Firebase / Three.js memory rooms.
export function createHouseLobby({apartmentGrid,lobbyStatus,openRoom,normalizeAssets,
  normalizeRoomDimensions,disposeObject,makeCutoutTexture,addCutoutDepth}) {
let allUsers = {}, currentUserKey = '';
// The lobby is a real orthographic Three.js architectural model.
const lobbyCanvas = document.createElement('canvas');
lobbyCanvas.id = 'lobbyCanvas';
lobbyCanvas.setAttribute('aria-label', 'Isometric memory rooms. Use the name buttons to enter a room.');
apartmentGrid.before(lobbyCanvas);
const lobbyRenderer = new THREE.WebGLRenderer({canvas:lobbyCanvas, antialias:true});
lobbyRenderer.setPixelRatio(Math.min(devicePixelRatio,2));
lobbyRenderer.outputColorSpace = THREE.SRGBColorSpace;
const lobbyScene = new THREE.Scene();
lobbyScene.background = new THREE.Color(0x080808);
const lobbyCamera = new THREE.OrthographicCamera(-15,15,12,-12,.1,200);
lobbyCamera.position.set(18,24,28);
lobbyCamera.lookAt(0,0,0);
const lobbyModel = new THREE.Group();
lobbyScene.add(lobbyModel);
const lobbyRaycaster = new THREE.Raycaster();
const lobbyPointer = new THREE.Vector2();
let lobbyVersion = 0;
let lobbyRooms = [];
let hoveredRoom = null;

function highlightLobbyRoom(key) {
  hoveredRoom = key;
  for (const room of lobbyRooms) {
    const active = room.key === key;
    room.group.position.y = active ? .12 : 0;
    for (const mesh of room.surfaces) mesh.material.color.setHex(active ? 0xffffff : mesh.userData.baseColor);
    room.label.classList.toggle('is-hovered',active);
  }
  lobbyCanvas.style.cursor = key ? 'pointer' : 'default';
}
function hitLobbyRoom(event) {
  const rect = lobbyCanvas.getBoundingClientRect();
  lobbyPointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
  lobbyRaycaster.setFromCamera(lobbyPointer,lobbyCamera);
  const hit = lobbyRaycaster.intersectObjects(lobbyModel.children,true)[0];
  let node = hit?.object;
  while(node && !node.userData.roomKey) node=node.parent;
  return node?.userData.roomKey || null;
}
lobbyCanvas.addEventListener('pointermove',event=>highlightLobbyRoom(hitLobbyRoom(event)));
lobbyCanvas.addEventListener('pointerleave',()=>highlightLobbyRoom(null));
let lobbyPress = null;
lobbyCanvas.addEventListener('pointerdown',event=>{lobbyPress={x:event.clientX,y:event.clientY,key:hitLobbyRoom(event)};});
lobbyCanvas.addEventListener('pointerup',event=>{
  const key=hitLobbyRoom(event);
  if(lobbyPress && key && key===lobbyPress.key && Math.hypot(event.clientX-lobbyPress.x,event.clientY-lobbyPress.y)<8) openRoom(key);
  lobbyPress=null;
});

function renderLobby() {
  const version = ++lobbyVersion;
  const focusedKey = document.activeElement?.dataset.room;
  for(const group of [...lobbyModel.children]) {lobbyModel.remove(group);disposeObject(group);}
  lobbyRooms=[];
  apartmentGrid.replaceChildren();
  const entries=Object.entries(allUsers).sort((a,b)=>a[0]===currentUserKey?-1:b[0]===currentUserKey?1:(a[1]?.profile?.name||a[0]).localeCompare(b[1]?.profile?.name||b[0]));
  lobbyStatus.textContent=`${entries.length} room${entries.length===1?'':'s'} / select to enter`;
  const cols = entries.length <= 2 ? Math.max(1,entries.length) : 3;
  const rows = Math.ceil(entries.length/cols);
  const host=lobbyCanvas.parentElement;
  host.style.height=`${Math.max(520,rows*250)}px`;
  for(const [index,[key,user]] of entries.entries()) {
    const name=(user?.profile?.name||key)+((user?.profile?.synthetic||user?.profile?.demo)?' / SYNTHETIC':'');
    const assets=normalizeAssets(user?.assets);
    const group=new THREE.Group();
    group.userData.roomKey=key;
    const dims=normalizeRoomDimensions(user?.dimensions);
    const fit=Math.min(5/dims.x,4/dims.z,3.2/dims.y);
    const width=user?.dimensions?dims.x*fit:[4.8,3.8,4.4][index%3];
    const depth=user?.dimensions?dims.z*fit:[3.4,4,3.2][index%3];
    const height=user?.dimensions?dims.y*fit:2.6;
    group.position.set((index%cols-(cols-1)/2)*6.8,0,(Math.floor(index/cols)-(rows-1)/2)*6);
    lobbyModel.add(group);
    const surfaces=[];
    function slab(w,h,d,x,y,z,color) {
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({color}));
      mesh.position.set(x,y,z);mesh.userData.baseColor=color;
      group.add(mesh);surfaces.push(mesh);
      const lines=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),new THREE.LineBasicMaterial({color:0x222222,transparent:true,opacity:.8}));
      mesh.add(lines);
    }
    // Open front and roof: the floor and two perpendicular walls give genuine depth.
    slab(width,.08,depth,0,0,0,0xdddddd);
    slab(width,height,.08,0,height/2,-depth/2,0xf4f4f4);
    slab(.08,height,depth,-width/2,height/2,0,0xb7b7b7);
    // A subtle wire outline describes the missing faces of the rectangular volume.
    const outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(width,height,depth)),new THREE.LineBasicMaterial({color:key===currentUserKey?0xdddddd:0x777777,transparent:true,opacity:.55}));
    outline.position.y=height/2;group.add(outline);
    const label=document.createElement('button');label.className='spatial-room-label';label.dataset.room=key;
    label.setAttribute('aria-label',`Enter ${name}'s room${key===currentUserKey?', your room':''}. ${assets.length} memory objects.`);
    label.textContent=`${key===currentUserKey?'— ':''}${String(index+1).padStart(2,'0')} / ${name}`;
    label.addEventListener('click',()=>openRoom(key));
    label.addEventListener('pointerenter',()=>highlightLobbyRoom(key));label.addEventListener('pointerleave',()=>highlightLobbyRoom(null));
    label.addEventListener('focus',()=>highlightLobbyRoom(key));label.addEventListener('blur',()=>highlightLobbyRoom(null));
    apartmentGrid.appendChild(label);
    lobbyRooms.push({key,group,label,surfaces,anchor:new THREE.Vector3(0,0,depth/2+.6)});
    // Empty rooms remain completely empty. Only the user's real saved memories appear.
    assets.filter(a=>a.imageUrl).slice(0,3).forEach(async(asset,i)=>{
      try {
        const texture=await makeCutoutTexture(asset.imageUrl);
        if(version!==lobbyVersion) {texture.dispose();return;}
        texture.colorSpace=THREE.SRGBColorSpace;
        const image=texture.image;const aspect=image.width/image.height||1;
        const mesh=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(1.4,aspect*1.2),1.2),new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.08,side:THREE.DoubleSide}));
        mesh.position.set(-width*.23+i*width*.23,.66,0);
        group.add(mesh);
        addCutoutDepth(group, mesh, texture, Math.min(1.4,aspect*1.2), 1.2, null);
      } catch(error) {console.warn('Lobby memory preview unavailable',asset.id);}
    });
  }
  if(!entries.length) apartmentGrid.innerHTML='<div class="empty-lobby">The house is waiting for its first memory.</div>';
  resizeLobby();
  if(focusedKey) [...apartmentGrid.children].find(el=>el.dataset.room===focusedKey)?.focus({preventScroll:true});
}
function resizeLobby() {
  const host=lobbyCanvas.parentElement;
  const width=host.clientWidth,height=host.clientHeight;
  if(!width || !height) return;
  lobbyRenderer.setSize(width,height,false);
  // Fit the complete architectural model in camera space, including room names.
  lobbyCamera.updateMatrixWorld();
  const bounds=new THREE.Box3().setFromObject(lobbyModel);
  let maxX=7,maxY=5;
  if(!bounds.isEmpty()) {
    for(const x of [bounds.min.x,bounds.max.x]) for(const y of [0,bounds.max.y]) for(const z of [bounds.min.z-1,bounds.max.z+1]) {
      const point=new THREE.Vector3(x,y,z).applyMatrix4(lobbyCamera.matrixWorldInverse);
      maxX=Math.max(maxX,Math.abs(point.x));maxY=Math.max(maxY,Math.abs(point.y));
    }
  }
  const aspect=width/height;const halfH=Math.max(maxY,maxX/aspect)*1.18;
  lobbyCamera.left=-halfH*aspect;lobbyCamera.right=halfH*aspect;lobbyCamera.top=halfH;lobbyCamera.bottom=-halfH;
  lobbyCamera.updateProjectionMatrix();
}
function renderLobbyFrame() {
  for(const room of lobbyRooms) {
    const point=room.group.localToWorld(room.anchor.clone()).project(lobbyCamera);
    room.label.style.left=`${(point.x+1)*.5*100}%`;
    room.label.style.top=`${(1-point.y)*.5*100}%`;
  }
  lobbyRenderer.render(lobbyScene,lobbyCamera);
}

return {
  sync(users,key) { allUsers=users; currentUserKey=key; renderLobby(); },
  resize:resizeLobby,
  frame:renderLobbyFrame
};
}
