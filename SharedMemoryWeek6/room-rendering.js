// Keep the WebGL drawing buffer in sync with a room that starts display:none.
// Canvas CSS is absolute-positioned so its high-DPI intrinsic size cannot grow
// the grid row and overflow the GPU's maximum framebuffer dimensions.
export function createRoomRendering({renderer,scene,camera,orbit,canvas,wrap,view,notice,retry,resetCamera,
  observe=globalThis.ResizeObserver}) {
  let failed=false,contextLost=false,lastWidth=0,lastHeight=0;
  function visible(){return !view.classList.contains('hidden');}
  function report(message){notice.textContent=message;notice.parentElement.classList.remove('hidden');}
  function clear(){notice.parentElement.classList.add('hidden');}
  function resize(){
    if(!visible())return false;
    const width=Math.floor(wrap.clientWidth),height=Math.floor(wrap.clientHeight);
    if(width<=0||height<=0)return false;
    // Fit within actual device capabilities, including very large Retina screens.
    const gl=renderer.getContext();
    const limit=gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)||4096;
    const ratio=Math.min(globalThis.devicePixelRatio||1,2,limit/width,limit/height);
    if(width!==lastWidth||height!==lastHeight||renderer.getPixelRatio()!==ratio){
      renderer.setPixelRatio(ratio);
      renderer.setSize(width,height,false);
      // setSize normally updates the viewport; make this explicit on re-entry.
      renderer.setViewport(0,0,width,height);
      lastWidth=width;lastHeight=height;
    }
    camera.aspect=width/height;camera.updateProjectionMatrix();
    return true;
  }
  function frame(){
    if(!visible()||contextLost||failed)return;
    try {
      if(!resize())return;
      if(renderer.getContext().isContextLost()){
        contextLost=true;report('The 3D graphics context was lost. Restore the view or reload this page.');return;
      }
      orbit.update();renderer.render(scene,camera);clear();
    }catch(error){
      failed=true;
      console.error('Memory room rendering failed:',error);
      report(`Could not draw this 3D room: ${error.message || error}. Try restoring the view.`);
    }
  }
  function lost(event){
    event.preventDefault();contextLost=true;
    report('The browser interrupted 3D graphics. Your saved memories are safe. Try Restore 3D View.');
  }
  function restored(){contextLost=false;failed=false;lastWidth=lastHeight=0;frame();}
  function recover(){
    if(contextLost||renderer.getContext().isContextLost()){
      report('Waiting for the browser to restore 3D graphics. If this persists, reload the page.');
      renderer.forceContextRestore();return;
    }
    failed=false;lastWidth=lastHeight=0;resetCamera();frame();
  }
  canvas.addEventListener('webglcontextlost',lost,false);
  canvas.addEventListener('webglcontextrestored',restored,false);
  retry.addEventListener('click',recover);
  const observer=observe?new observe(()=>frame()):null;observer?.observe(wrap);
  return {frame,resize,enter(){failed=false;lastWidth=lastHeight=0;frame();},recover};
}
