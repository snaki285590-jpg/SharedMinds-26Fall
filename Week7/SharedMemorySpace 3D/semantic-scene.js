import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {archiveLayout,archiveRoomStyle} from './archive-layout.js';
import {createUmapScene} from './umap-scene.js';
import * as THREE from 'three';

// Lightweight corridor: five shallow architectural planes per resident. Interior
// scenes stay in main.js and are only switched on after the entrance flight.
export function createCorridorScene(host,labels,onSelect,makeCutoutTexture) {
  let renderer;
  try { renderer=new THREE.WebGLRenderer({antialias:true}); }
  catch { return null; } // DOM room buttons remain usable without WebGL.
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,2));
  renderer.setClearColor(0x000000);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.domElement.className='semantic-canvas';
  renderer.domElement.setAttribute('aria-label','3D Browse. Drag to orbit, scroll to zoom. Click to select a room, click again to enter.');
  host.prepend(renderer.domElement);
  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x000000,.012);
  scene.add(new THREE.HemisphereLight(0xe9edf3,0x181818,2));
  const wash=new THREE.DirectionalLight(0xffffff,2.4);wash.position.set(-6,10,8);scene.add(wash);
  const camera=new THREE.PerspectiveCamera(46,1,.1,500);
  const nodes=new Map(),ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const eye=new THREE.Vector3(24,18,30);camera.position.copy(eye);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.07;controls.minDistance=5;controls.maxDistance=250;controls.target.set(0,1.8,0);
  let selected='',overviewDistance=40,fitPending=true;
  let layoutSeed=crypto.getRandomValues(new Uint32Array(1))[0],latestRows=[];
  const architecture=new THREE.Group();scene.add(architecture);
  let gridColumns=-1;
  function updateGrid(columns){
    const key=columns+'/'+layoutSeed;if(key===gridColumns)return;gridColumns=key;
    for(const child of [...architecture.children]){architecture.remove(child);child.geometry?.dispose();child.material.map?.dispose();child.material.dispose();}
    const slots=archiveLayout(columns,layoutSeed),ys=slots.map(p=>p[1]);
    const width=24,base=(ys.length?Math.min(...ys):0)-3,top=(ys.length?Math.max(...ys):0)+7,height=top-base;
    const makeGrid=(position,rotation,opacity,vertical=false)=>{
      const grid=new THREE.GridHelper(width,width/2,0x9d9d9d,0x727272);
      grid.position.copy(position);grid.rotation.set(...rotation);if(vertical){if(rotation[2])grid.scale.x=height/width;else grid.scale.z=height/width;}
      grid.material.transparent=true;grid.material.opacity=opacity;grid.material.fog=false;architecture.add(grid);
    };
    makeGrid(new THREE.Vector3(0,base,0),[0,0,0],.32);
    makeGrid(new THREE.Vector3(0,base+height/2,-width/2),[Math.PI/2,0,0],.25,true);
    makeGrid(new THREE.Vector3(-width/2,base+height/2,0),[0,0,Math.PI/2],.25,true);
    // A monochrome architectural coordinate cage, with ticks in world units.
    const axisPoints=[[-width/2,base,-width/2],[width/2,base,-width/2],[-width/2,base,-width/2],[-width/2,top,-width/2],[-width/2,base,-width/2],[-width/2,base,width/2]];
    const axis=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(axisPoints.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color:0xc4c4c4,transparent:true,opacity:.6}));architecture.add(axis);
    function marker(text,x,y,z,size=1.1){
      const canvas=document.createElement('canvas');canvas.width=128;canvas.height=64;
      const c=canvas.getContext('2d');c.fillStyle='#bcbcbc';c.font='23px monospace';c.textAlign='center';c.fillText(text,64,41);
      const map=new THREE.CanvasTexture(canvas),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false}));
      sprite.position.set(x,y,z);sprite.scale.set(size*2,size,1);architecture.add(sprite);
    }
    marker('X',width/2+1,base,-width/2,1.5);
    marker('Y',-width/2,top+1,-width/2,1.5);
    marker('Z',-width/2,base,width/2+1,1.5);
    for(let tick=-width/2;tick<=width/2;tick+=8){marker(String(tick),tick,base-.7,-width/2);marker(String(tick),-width/2-.9,base,tick);}

  }
  function loadPreviews(node){
    if(node.loaded===node.signature)return;node.loaded=node.signature;
    for(const child of [...node.previews.children]){node.previews.remove(child);child.geometry.dispose();child.material.map?.dispose();child.material.dispose();}
    const signature=node.signature,version=(node.previewVersion||0)+1;node.previewVersion=version;
    node.images.forEach((asset,i)=>{
      (makeCutoutTexture?makeCutoutTexture(asset.imageUrl,{strict:true}):Promise.reject(new Error('Cutout unavailable'))).then(texture=>{
        if(nodes.get(node.group.userData.key)!==node||node.signature!==signature||node.previewVersion!==version){texture.dispose();return;}
        texture.colorSpace=THREE.SRGBColorSpace;
        const ratio=(texture.image.width||1)/(texture.image.height||1),height=1.6,width=Math.min(1.8,height*ratio);
        const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.06,side:THREE.DoubleSide,depthWrite:false}));
        mesh.position.set(-1.55+i*1.5,1.05,-.1+(i%2)*.55);mesh.userData.baseOpacity=1;node.previews.add(mesh);
      }).catch(()=>{});
    });
  }
  let hovered='';
  let flight=null,last=performance.now(),size='',down=null,dragged=false;
  function clear(node){scene.remove(node.group);node.group.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();});}
  function sync(rows) {
    latestRows=rows;
    const keys=new Set(rows.map(r=>r.key));
    for(const [key,node] of nodes)if(!keys.has(key)){clear(node);nodes.delete(key);}
    if(nodes.size===0)fitPending=true;
    updateGrid(rows.length);
    const coordinates=archiveLayout(rows.length,layoutSeed);
    for(const row of rows){
      let node=nodes.get(row.key);
      if(!node){
        const group=new THREE.Group();group.userData.key=row.key;
        const slab=(w,h,d,x,y,z,color)=>{
          const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.88,metalness:.08,transparent:true}));
          mesh.position.set(x,y,z);group.add(mesh);
        };
        // Exploded architectural archive: glass volumes with open fronts.
        const style=archiveRoomStyle(row.key);group.rotation.y=style.yaw;group.scale.fromArray(style.scale);
        slab(5.4,.13,3.8,0,-.065,0,0xb4b4b4);
        const glass=(w,h,d,x,y,z,opacity)=>{
          const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({color:0xd5d9dc,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide}));
          mesh.position.set(x,y,z);group.add(mesh);
        };
        glass(5.4,3.6,.04,0,1.8,-1.9,.12);
        glass(.04,3.6,3.8,-2.7,1.8,0,.09);
        glass(.04,3.6,3.8,2.7,1.8,0,.055);
        glass(5.4,.035,3.8,0,3.6,0,.045);
        // A quiet translucent door outline; the memories remain the focus.
        const doorLines=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(.85,2.05)),new THREE.LineBasicMaterial({color:0xaaaaaa,transparent:true,opacity:.3}));
        doorLines.position.set(-1.65,1.025,-1.82);group.add(doorLines);
        const handle=new THREE.Mesh(new THREE.BoxGeometry(.11,.025,.04),new THREE.MeshBasicMaterial({color:0xaaaaaa,transparent:true,opacity:.28}));
        handle.position.set(-1.38,1,-1.78);group.add(handle);
        const frameMaterial=row.synthetic?new THREE.LineDashedMaterial({color:0xdde2e6,dashSize:.13,gapSize:.09,transparent:true,opacity:.55}):new THREE.LineBasicMaterial({color:0xdde2e6,transparent:true,opacity:.48});
        const frame=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(5.4,3.6,3.8)),frameMaterial);
        frame.position.y=1.8;frame.computeLineDistances();group.add(frame);
        const doorway=new THREE.Mesh(new THREE.BoxGeometry(5.4,3.6,3.8),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
        doorway.position.set(0,1.8,0);doorway.userData.door=true;group.add(doorway);
        group.traverse(o=>{if(o.material)o.userData.baseOpacity=o.material.opacity;});
        const previews=new THREE.Group();group.add(previews);
        scene.add(group);node={group,previews,target:new THREE.Vector3(),fresh:true,images:[],signature:'',loaded:null};nodes.set(row.key,node);
      }
      node.target.fromArray(coordinates[rows.indexOf(row)]);
      node.images=(row.images||[]).filter(a=>typeof a.imageUrl==='string'&&/^(https?:\/\/|data:image\/)/i.test(a.imageUrl)).slice(0,3);
      node.signature=JSON.stringify(node.images.map(a=>a.imageUrl));
      if(node.fresh){node.group.position.copy(node.target);node.fresh=false;}
    }
    if(selected&&!nodes.has(selected)){selected='';enterButton.hidden=true;}
    const bounds=new THREE.Box3();for(const n of nodes.values()){bounds.expandByPoint(n.target.clone().add(new THREE.Vector3(-5,0,-4)));bounds.expandByPoint(n.target.clone().add(new THREE.Vector3(5,5,4)));}
    overviewDistance=bounds.isEmpty()?30:Math.max(22,bounds.getSize(new THREE.Vector3()).length()*1.05);
    controls.maxDistance=Math.max(100,overviewDistance*3);
    if(fitPending&&rows.length){fitPending=false;home();}
  }
  function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;const next=`${w}/${h}`;if(size===next)return;size=next;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(!selected)home();}
  function fly(to,target,key=null){flight={key,start:performance.now(),from:camera.position.clone(),to,lookFrom:controls.target.clone(),lookTo:target};controls.enabled=false;}
  function home(){selected='';enterButton.hidden=true;const distance=overviewDistance/Math.min(1,camera.aspect);fly(new THREE.Vector3(.62,.46,.78).normalize().multiplyScalar(distance),new THREE.Vector3(0,1.8,0));}
  function enter(key){
    const node=nodes.get(key);if(!node||flight)return;
    if(selected!==key){selected=key;enterButton.hidden=false;enterButton.textContent='Enter selected room ↗';const center=node.group.localToWorld(new THREE.Vector3(0,1.8,0));const direction=camera.position.clone().sub(controls.target).normalize();fly(center.clone().addScaledVector(direction,13*Math.max(...node.group.scale.toArray())),center);return;}
    const center=node.group.localToWorld(new THREE.Vector3(0,1.8,0));fly(center.clone().add(new THREE.Vector3(0,0,1)),center,key);
  }
  function returnFromRoom(key){selected=key;enterButton.hidden=!nodes.has(key);const node=nodes.get(key);if(!node){home();return;}const center=node.group.localToWorld(new THREE.Vector3(0,1.8,0));camera.position.copy(center).add(new THREE.Vector3(0,0,1));controls.target.copy(center);fly(center.clone().add(new THREE.Vector3(9,6,12)),center);}
  const canvas=renderer.domElement;
  canvas.tabIndex=0;
  const navigation=document.createElement('div');navigation.className='archive-selection';
  const enterButton=document.createElement('button');enterButton.textContent='Enter selected room ↗';enterButton.hidden=true;enterButton.onclick=()=>enter(selected);navigation.append(enterButton);host.append(navigation);
  const randomButton=document.createElement('button');randomButton.className='archive-random';randomButton.textContent='↻ Random';randomButton.setAttribute('aria-label','Randomize room positions');
  randomButton.onclick=()=>{if(flight?.key)return;layoutSeed=crypto.getRandomValues(new Uint32Array(1))[0];sync(latestRows);home();};host.append(randomButton);
  controls.addEventListener('start',()=>{if(flight&&!flight.key){flight=null;controls.enabled=true;}});
  function hitRoom(e){const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);return ray.intersectObjects([...nodes.values()].flatMap(n=>n.group.children.filter(o=>o.userData.door)),false)[0]?.object.parent.userData.key||'';}
  canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};dragged=false;});
  canvas.addEventListener('pointermove',e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)dragged=true;hovered=hitRoom(e);canvas.style.cursor=hovered?'pointer':'grab';});
  canvas.addEventListener('pointerup',e=>{if(!down)return;const moved=dragged||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6;down=null;if(moved||flight)return;const key=hitRoom(e);if(key)enter(key);});
  canvas.addEventListener('keydown',e=>{if(e.key==='Escape')home();if(e.key==='Enter'&&selected)enter(selected);});
  canvas.addEventListener('pointercancel',()=>{down=null;});
  function frame(){
    if(!host.getClientRects().length)return;resize();
    const now=performance.now(),dt=Math.min((now-last)/1000,.05);last=now;
    const ease=reduce?1:1-Math.exp(-dt*5);
    for(const node of nodes.values()){
      node.group.position.lerp(node.target,ease);
      if(node.target.distanceTo(camera.position)<Math.max(30,overviewDistance*1.4))loadPreviews(node);
      const opacity=selected&&selected!==node.group.userData.key ? .35 : 1;
      node.group.traverse(o=>{if(o.material)o.material.opacity=THREE.MathUtils.lerp(o.material.opacity,opacity*(o.userData.baseOpacity??1),ease);});
    }
    let completed=null;
    if(flight){const t=reduce?1:Math.min(1,(now-flight.start)/1050),s=t*t*(3-2*t);camera.position.lerpVectors(flight.from,flight.to,s);controls.target.lerpVectors(flight.lookFrom,flight.lookTo,s);if(t===1){completed=flight.key;flight=null;controls.enabled=true;}}
    controls.update();camera.updateMatrixWorld();
    for(const label of labels.children){const node=nodes.get(label.dataset.room);if(!node)continue;if(label.dataset.doorName)label.textContent=label.dataset.doorName;const world=node.group.localToWorld(new THREE.Vector3(0,4.05,0));const p=world.project(camera);label.hidden=p.z< -1||p.z>1||Math.abs(p.x)>.95||Math.abs(p.y)>.95;label.style.left=`${(p.x+1)*50}%`;label.style.top=`${(1-p.y)*50}%`;label.style.opacity=flight&&flight.key!==node.group.userData.key?'0':String(selected&&selected!==label.dataset.room ? .35 : 1);label.classList.toggle('door-hovered',hovered===label.dataset.room||selected===label.dataset.room);label.style.setProperty('--door-scale',Math.max(.65,Math.min(1,18/camera.position.distanceTo(node.group.position))));}
    renderer.render(scene,camera);
    if(completed)onSelect(completed);
  }
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();canvas.style.display='none';host.classList.add('corridor-fallback');});
  return {sync,resize,frame,focus:enter,enter,home,returnFromRoom,show(active){canvas.style.display=active?'block':'none';navigation.hidden=!active;randomButton.hidden=!active;}};
}

// Independent renderers share data and room navigation, never Firebase writes.
export function createSemanticScene(host,labels,onSelect,makeCutoutTexture) {
  let mode='browse',corridor=null,umap=null,umapCanvas=null,cached=[[],[],[]];
  function active(){return mode==='browse'?corridor:umap;}
  function initialize(){
    if(mode==='browse'&&!corridor)corridor=createCorridorScene(host,labels,onSelect,makeCutoutTexture);
    if(mode==='umap'&&!umap){umap=createUmapScene(host,labels,onSelect);umapCanvas=host.querySelector('canvas');}
    host.dataset.browseMode=mode;
    for(const canvas of host.querySelectorAll('canvas'))canvas.style.display='none';
    corridor?.show(mode==='browse');
    if(mode==='umap'&&umapCanvas)umapCanvas.style.display='block';
    host.classList.toggle('corridor-fallback',!active());
  }
  return {
    setMode(next){if(mode===next&&active())return;mode=next;for(const label of labels.children){label.hidden=false;label.style.opacity='1';}initialize();this.sync(...cached);},
    sync(rows,records,umapRows=[]){cached=[rows,records,umapRows];initialize();active()?.sync(mode==='browse'?rows:umapRows,records);},
    frame(){active()?.frame();},resize(){active()?.resize();},
    enter(key){if(mode==='browse'&&corridor)corridor.enter(key);else onSelect(key);},
    focus(key){active()?.focus(key);},home(){active()?.home();},returnFromRoom(key){if(mode==='browse')corridor?.returnFromRoom(key);}
  };
}
