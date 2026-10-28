// Worker-compatible bridge for file:// previews, where browsers block workers.
// This imports the exact same neural embedding + UMAP engine, never fake vectors.
export function createLocalSemanticClient(){
 let stopped=false,run;
 const client={onmessage:null,onerror:null,
  postMessage(data){
   if(stopped)return;
   run??=import('./embedding-runtime.js').then(({createSemanticEngine})=>createSemanticEngine(message=>{if(!stopped)client.onmessage?.({data:message});}));
   run.then(handle=>{if(!stopped)return handle(data);}).catch(error=>{if(!stopped)client.onmessage?.({data:{id:data.id,error:error.message}});});
  },
  terminate(){stopped=true;}
 };
 return client;
}
