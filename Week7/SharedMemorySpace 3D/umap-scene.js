import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {ranked} from './semantic-math.js';

export function createUmapScene(host,labels,onSelect) {
  let renderer;
  try {renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}
  catch {const message=document.createElement('p');message.textContent='3D unavailable. Use the named rooms below to read memories and enter rooms.';host.append(message);return null;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.setClearColor(0x030303);renderer.domElement.className='semantic-canvas';host.prepend(renderer.domElement);
  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x030303,.009);
  const camera=new THREE.PerspectiveCamera(48,1,.1,400);camera.position.set(0,14,57);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=4;controls.maxDistance=110;controls.enablePan=false;
  const nodes=new Map(),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const geometry=new THREE.BoxGeometry(1.6,2,1.6),edges=new THREE.EdgesGeometry(geometry);
  let pairs=[],flight=null,last=performance.now(),size='';
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lineGeometry=new THREE.BufferGeometry();
  const links=new THREE.LineSegments(lineGeometry,new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.13}));scene.add(links);
  function sync(rows,records) {
    const keys=new Set(rows.map(r=>r.key));
    for(const [key,node] of nodes)if(!keys.has(key)){scene.remove(node.group);node.group.traverse(o=>{o.material?.dispose();});nodes.delete(key);}
    for(const row of rows){
      let node=nodes.get(row.key);
      if(!node){
        const group=new THREE.Group();
        const solid=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:row.you?.24:row.synthetic?.07:.15,depthWrite:false}));
        const outlineMaterial=row.synthetic?new THREE.LineDashedMaterial({color:0xdddddd,dashSize:.15,gapSize:.12}):new THREE.LineBasicMaterial({color:0xffffff});
        const outline=new THREE.LineSegments(edges,outlineMaterial);outline.computeLineDistances();group.add(solid,outline);
        // Soft nested shells produce a restrained white halo without postprocessing.
        for(const scale of [1.08,1.2,1.4]){const halo=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.018,depthWrite:false}));halo.scale.setScalar(scale);group.add(halo);}
        group.userData.key=row.key;scene.add(group);node={group,target:new THREE.Vector3()};nodes.set(row.key,node);
      }
      node.target.fromArray(row.position);node.group.scale.setScalar(row.you?.65:1);
    }
    const unique=new Set();pairs=[];
    for(const row of rows){const record=records.find(r=>r.key===row.key);if(!record)continue;
      for(const neighbor of ranked(record.vector,records,row.key).filter(r=>keys.has(r.key)).slice(0,2)){
        const pair=[row.key,neighbor.key].sort(),id=JSON.stringify(pair);if(unique.has(id))continue;unique.add(id);pairs.push(pair);
      }
    }
    lineGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(pairs.length*6),3));
  }
  function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;const next=`${w}/${h}`;if(size===next)return;size=next;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  function fly(target,position){flight={start:performance.now(),from:camera.position.clone(),look:controls.target.clone(),target,position};controls.enabled=false;}
  function home(){fly(new THREE.Vector3(),new THREE.Vector3(0,14,57));}
  function focus(key){const node=nodes.get(key);if(node)fly(node.target.clone(),node.target.clone().add(new THREE.Vector3(0,4,12)));}
  controls.addEventListener('start',()=>{flight=null;});
  let down;
  renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];if(flight){flight=null;controls.enabled=true;}});
  renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;
    const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects([...nodes.values()].map(n=>n.group),true)[0];if(hit){let o=hit.object;while(o&&!o.userData.key)o=o.parent;if(o)onSelect(o.userData.key);}
  });
  function frame(){
    if(!host.getClientRects().length)return;
    resize();const now=performance.now(),dt=Math.min((now-last)/1000,.1);last=now;
    for(const node of nodes.values())node.group.position.lerp(node.target,reduce?1:1-Math.exp(-dt*4));
    if(flight){let t=reduce?1:Math.min(1,(now-flight.start)/1100);t=t*t*(3-2*t);camera.position.lerpVectors(flight.from,flight.position,t);controls.target.lerpVectors(flight.look,flight.target,t);if(t===1){flight=null;controls.enabled=true;}}
    controls.update();
    const array=lineGeometry.attributes.position.array;
    pairs.forEach(([a,b],i)=>{nodes.get(a).group.position.toArray(array,i*6);nodes.get(b).group.position.toArray(array,i*6+3);});lineGeometry.attributes.position.needsUpdate=true;lineGeometry.computeBoundingSphere();
    camera.updateMatrixWorld();
    for(const label of labels.children){const node=nodes.get(label.dataset.room);if(!node){label.hidden=true;continue;}const p=node.group.position.clone().add(new THREE.Vector3(0,1.6,0)).project(camera);
      label.hidden=p.z< -1||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1;label.style.left=`${(p.x+1)*50}%`;label.style.top=`${(1-p.y)*50}%`;
    }
    renderer.render(scene,camera);
  }
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();const notice=document.createElement('p');notice.className='map-caption';notice.textContent='3D context lost. Reload to restore; named memory buttons remain available.';host.append(notice);});
  return {sync,resize,frame,focus,home};
}
