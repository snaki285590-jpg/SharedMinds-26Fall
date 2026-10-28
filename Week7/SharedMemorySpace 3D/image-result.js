// Never search arbitrary response metadata: input images and polling URLs are
// valid URLs too, but they are not generated images.
export function extractImageUrl(result){
 const valid=value=>typeof value==='string'&&/^(https?:\/\/|data:image\/)/i.test(value)?value:null;
 function output(value){
  if(valid(value))return value;
  if(Array.isArray(value)){for(const item of value){const url=output(item);if(url)return url;}}
  else if(value&&typeof value==='object'){
   for(const key of ['output','image','images','image_url','url']){const url=output(value[key]);if(url)return url;}
  }
  return null;
 }
 if(typeof result==='string'||Array.isArray(result))return output(result);
 if(result?.error||result?.status==='failed'||result?.status==='canceled')return null;
 return output(result?.output)||output(result?.data?.output)||output(result?.data?.image)||output(result?.image)||output(result?.images)||output(result?.image_url);
}
