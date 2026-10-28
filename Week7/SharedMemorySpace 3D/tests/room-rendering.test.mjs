import assert from 'node:assert/strict';
import {createRoomRendering} from '../room-rendering.js';
let hidden=true,width=0,height=0,observed,draws=0,ratio=1,restoreCalls=0,loseContext=false,throwRender=false;
const canvas=new EventTarget(),retry=new EventTarget();
const notice={textContent:'',parentElement:{classList:{add(){},remove(){}}}};
const view={classList:{contains:()=>hidden}};
const wrap={get clientWidth(){return width},get clientHeight(){return height}};
const gl={MAX_RENDERBUFFER_SIZE:1,getParameter:()=>4096,isContextLost:()=>loseContext};
let viewport;
const renderer={getContext:()=>gl,getPixelRatio:()=>ratio,setPixelRatio:r=>ratio=r,setSize(){},setViewport(...v){viewport=v},
 render(){if(throwRender)throw new Error('fixture GPU error');draws++},forceContextRestore(){restoreCalls++}};
const camera={aspect:1,updateProjectionMatrix(){}};
const orbit={update(){}};
const controller=createRoomRendering({renderer,scene:{},camera,orbit,canvas,wrap,view,notice,retry,resetCamera(){},
 observe:class{constructor(fn){observed=fn}observe(el){assert.equal(el,wrap)}}});
controller.frame();assert.equal(draws,0);
hidden=false;controller.enter();assert.equal(draws,0,'Do not allocate a zero-size drawing buffer');
width=900;height=600;observed();assert.equal(draws,1);assert.equal(camera.aspect,1.5);assert.deepEqual(viewport,[0,0,900,600]);
width=9000;height=5000;observed();assert(ratio*width<=4096,'Respect GPU framebuffer limit');
hidden=true;controller.frame();const count=draws;assert.equal(draws,count);
hidden=false;width=1000;height=700;controller.enter();assert.equal(draws,count+1,'Draw immediately on re-entry');
throwRender=true;const log=console.error;console.error=()=>{};controller.frame();console.error=log;
assert(notice.textContent.includes('fixture GPU error'));
throwRender=false;controller.frame();assert.equal(draws,count+1,'Pause after a failed draw instead of looping errors');
retry.dispatchEvent(new Event('click'));assert.equal(draws,count+2);
loseContext=true;const lost=new Event('webglcontextlost',{cancelable:true});canvas.dispatchEvent(lost);assert(lost.defaultPrevented);
retry.dispatchEvent(new Event('click'));assert.equal(restoreCalls,1);
loseContext=false;canvas.dispatchEvent(new Event('webglcontextrestored'));assert.equal(draws,count+3);
console.log('PASS room rendering: hidden/zero layout, observer resize, GPU size cap, re-entry first frame, errors/retry, context loss/restoration');
