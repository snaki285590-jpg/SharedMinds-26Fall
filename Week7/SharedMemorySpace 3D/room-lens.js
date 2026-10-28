import * as THREE from 'three';

import {lensSettings,lensPointer} from './lens-math.js';
export function createRoomLens(renderer,camera,host){
 const initial=(45-32)/50;
 let requested=initial,current=initial,last=performance.now(),dolly=1;
 const control=document.createElement('div');control.className='room-lens-control';
 const label=document.createElement('label');label.htmlFor='roomLens';label.textContent='LENS';
 const left=document.createElement('span');left.textContent='＋';left.title='Close view';
 const input=document.createElement('input');input.type='range';input.id='roomLens';input.min='0';input.max='100';input.step='1';input.value=String(initial*100);input.setAttribute('aria-label','Room zoom and peephole lens');
 const right=document.createElement('span');right.textContent='◉';right.title='Peephole';
 const output=document.createElement('output');output.textContent='45°';
 control.append(label,left,input,right,output);host.append(control);
 input.addEventListener('input',()=>{requested=Number(input.value)/100;});
 for(const type of ['pointerdown','wheel'])control.addEventListener(type,e=>e.stopPropagation());
 const target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true});
 target.samples=Math.min(4,renderer.getContext().getParameter(renderer.getContext().MAX_SAMPLES)||0);
 target.texture.generateMipmaps=false;
 const uniforms={texel:{value:new THREE.Vector2(1,1)},image:{value:target.texture},strength:{value:0},halfFov:{value:Math.PI/8},aspect:{value:1}};
 const material=new THREE.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,
 vertexShader:'varying vec2 uvOut;void main(){uvOut=uv;gl_Position=vec4(position.xy,0.,1.);}',
 fragmentShader:`uniform sampler2D image;uniform vec2 texel;uniform float strength;uniform float halfFov;uniform float aspect;varying vec2 uvOut;
 void main(){vec2 p=uvOut-.5;p.x*=aspect;float r=length(p);float blend=clamp(strength/2.6,0.,1.);float mixAmount=blend*blend*(3.-2.*blend);
 float normal=(1.+strength*r*r)/(1.+strength*.18);
 float fish=r<.00001?1.25/(.96*tan(halfFov)):tan(min(r/.48,1.08)*1.25)/(2.*r*tan(halfFov));
 vec2 source=p*mix(normal,fish,mixAmount);source.x/=aspect;source+=.5;
 float aperture=1.-smoothstep(.465,.485,r);

 if(source.x<0.||source.x>1.||source.y<0.||source.y>1.){gl_FragColor=vec4(0.,0.,0.,1.);return;}
 vec4 color=texture2D(image,source);
 vec3 adjacent=texture2D(image,source+vec2(texel.x,0.)).rgb+texture2D(image,source-vec2(texel.x,0.)).rgb+texture2D(image,source+vec2(0.,texel.y)).rgb+texture2D(image,source-vec2(0.,texel.y)).rgb;
 color.rgb=clamp(color.rgb*1.48-adjacent*.12,0.,1.);float rim=mix(1.,aperture*(1.-.3*smoothstep(.2,.48,r)),mixAmount);gl_FragColor=vec4(color.rgb*rim,1.);
 #include <colorspace_fragment>
 }`});
 const pass=new THREE.Scene();const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);pass.add(quad);const passCamera=new THREE.Camera();
 const buffer=new THREE.Vector2();let lost=false;
 renderer.domElement.addEventListener('webglcontextlost',()=>{lost=true;});
 renderer.domElement.addEventListener('webglcontextrestored',()=>{lost=false;target.dispose();});
 function update(){const now=performance.now(),dt=Math.min(.05,(now-last)/1000);last=now;current+=(requested-current)*(1-Math.exp(-dt*12));if(Math.abs(requested-current)<.0001)current=requested;
 const settings=lensSettings(current);camera.fov=settings.fov;camera.updateProjectionMatrix();const blend=settings.strength/2.6,nextDolly=1-.7*blend;
 if(Math.abs(nextDolly-dolly)>.000001){const center=camera.userData.lensTarget; if(center)camera.position.sub(center).multiplyScalar(nextDolly/dolly).add(center);dolly=nextDolly;}
 uniforms.halfFov.value=settings.fov*Math.PI/360;uniforms.strength.value=settings.strength;uniforms.aspect.value=camera.aspect;
 output.textContent=settings.strength>.02?'Peephole':Math.round(settings.fov)+'°';input.setAttribute('aria-valuetext',settings.strength>.02?'Peephole lens':Math.round(settings.fov)+' degree field of view');input.style.setProperty('--lens-fill',requested*100+'%');return settings.strength;}
 return {
 update,
 reset(){dolly=1;requested=current=initial;input.value=String(initial*100);update();},
 get distorted(){return uniforms.strength.value>.02;},
 mapPointer(pointer){const p=lensPointer(pointer.x,pointer.y,camera.aspect,uniforms.strength.value);pointer.set(...p);},
 render(scene){if(lost)return;if(uniforms.strength.value<.001){renderer.render(scene,camera);return;}
 renderer.getDrawingBufferSize(buffer);
 const gl=renderer.getContext(),limit=Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE),gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
 const scale=Math.min(1.5,limit/buffer.x,limit/buffer.y,Math.sqrt(6000000/(buffer.x*buffer.y)));
 const width=Math.max(1,Math.floor(buffer.x*scale)),height=Math.max(1,Math.floor(buffer.y*scale));
 if(target.width!==width||target.height!==height)target.setSize(width,height);
 uniforms.texel.value.set(1/width,1/height);
 const previous=renderer.getRenderTarget();try{renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);renderer.setRenderTarget(previous);renderer.render(pass,passCamera);}finally{renderer.setRenderTarget(previous);}}
 };
}
