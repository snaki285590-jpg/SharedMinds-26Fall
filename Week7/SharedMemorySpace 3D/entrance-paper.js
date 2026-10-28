import * as THREE from 'three';

// Decorative paper architecture, separate from users' saved memory rooms.
export function createEntrancePaper(host,addCutoutDepth){
 let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}catch{return {frame(){}};}
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setClearColor(0x171717);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.domElement.className='entrance-paper-canvas';host.replaceChildren(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-16,16,12,-12,.1,150);
 scene.add(new THREE.HemisphereLight(0xffffff,0x555555,2));
 const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(-8,16,14);scene.add(light);
 const model=new THREE.Group();scene.add(model);
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function paperTexture(kind){
  const canvas=document.createElement('canvas');canvas.width=384;canvas.height=512;const c=canvas.getContext('2d');
  c.strokeStyle='#383838';c.fillStyle='#eaeaea';c.lineWidth=4;c.lineJoin='round';c.lineCap='round';
  const path=(points,fill=true)=>{c.beginPath();for(let i=0;i<points.length;i++)c[i?'lineTo':'moveTo'](...points[i]);if(fill){c.closePath();c.fill();}c.stroke();};
  if(kind===0){ // Armchair, drawn as a freestanding illustrated cutout.
   path([[83,225],[103,118],[137,91],[282,103],[309,142],[313,294],[286,377],[110,370],[72,321]]);
   path([[65,230],[105,217],[121,301],[274,307],[283,219],[326,229],[332,372],[300,409],[89,404],[56,367]]);
   path([[120,302],[262,300],[291,339],[99,338]]);path([[88,403],[87,438],[109,438],[119,404]]);path([[282,408],[286,438],[308,438],[307,402]]);
   path([[121,137],[268,146],[282,264],[129,259]],false);
  }else if(kind===1){ // Plant and ceramic pot.
   path([[140,369],[265,369],[249,461],[157,461]]);path([[201,371],[203,133]],false);
   for(let i=0;i<6;i++){const y=149+i*33,side=i%2?1:-1;path([[203,y+42],[203+side*74,y-13],[203+side*87,y+17],[203,y+50]]);}
   path([[144,389],[258,389]],false);
  }else{ // Floor lamp.
   path([[102,456],[287,456],[273,471],[113,471]]);path([[192,455],[192,182]],false);
   path([[105,185],[139,83],[246,83],[283,185]]);path([[134,168],[255,168]],false);
   path([[235,190],[235,258]],false);c.beginPath();c.arc(235,262,5,0,Math.PI*2);c.stroke();
  }
  // Sparse pencil strokes make the light fills read as paper rather than plastic.
  c.save();c.globalCompositeOperation='source-atop';c.strokeStyle='#777';c.lineWidth=1;c.globalAlpha=.22;
  for(let i=0;i<30;i++){const x=60+(i*41)%265,y=100+(i*67)%350;c.beginPath();c.moveTo(x,y);c.lineTo(x+10,y-13);c.stroke();}c.restore();
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
 }
 const textures=[0,1,2].map(paperTexture);
 for(let row=0;row<3;row++)for(let col=0;col<3;col++){
  const room=new THREE.Group();room.position.set((col-1)*9,0,(row-1)*7);model.add(room);
  const slab=(w,h,d,x,y,z,color)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:1}));mesh.position.set(x,y,z);room.add(mesh);};
  slab(7,.18,5.5,0,-.09,0,0xbcbcbc);slab(7,4,.12,0,2,-2.75,0xe0e0e0);slab(.12,4,5.5,-3.5,2,0,0xcccccc);
  const lines=[];for(let x=-3.5;x<=3.5;x+=.7)lines.push(x,.01,-2.75,x,.01,2.75);for(let z=-2.75;z<=2.75;z+=.7)lines.push(-3.5,.01,z,3.5,.01,z);
  const grid=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(lines,3)),new THREE.LineBasicMaterial({color:0x777777,transparent:true,opacity:.2}));room.add(grid);
  for(let i=0;i<3;i++){
   const cutout=new THREE.Group(),texture=textures[(row+col+i)%3];cutout.position.set(-2+i*2,1.35,-.5+(i%2)*1.2);cutout.rotation.y=.14;room.add(cutout);
   const front=new THREE.Mesh(new THREE.PlaneGeometry(2,2.7),new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.08,side:THREE.DoubleSide}));cutout.add(front);addCutoutDepth(cutout,front,texture,2,2.7,null);
  }
 }
 let size='';
 function frame(){
  if(!host.closest('#loginView')?.getClientRects().length)return;
  const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
  if(size!==`${w}/${h}`){size=`${w}/${h}`;renderer.setSize(w,h,false);const halfH=11;camera.left=-halfH*w/h;camera.right=halfH*w/h;camera.top=halfH;camera.bottom=-halfH;camera.updateProjectionMatrix();}
  const t=reduce?0:performance.now()*.0001;camera.position.set(15+Math.sin(t)*1.5,18,26+Math.cos(t)*1.3);camera.lookAt(Math.sin(t)*.7,1,0);renderer.render(scene,camera);
 }
 return {frame};
}
