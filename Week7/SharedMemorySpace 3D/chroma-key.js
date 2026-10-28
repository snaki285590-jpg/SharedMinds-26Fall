// Generated memory assets reserve green for the background. Preserve alpha and
// soften only the boundary; strong green becomes fully transparent.
export function removeGreenBackground(data){
  for(let i=0;i<data.length;i+=4){
    const r=data[i],g=data[i+1],b=data[i+2],dominance=g-Math.max(r,b);
    if(g>100&&dominance>25){
      const t=Math.max(0,Math.min(1,(dominance-25)/30));
      data[i+3]=Math.round(data[i+3]*(1-t*t*(3-2*t)));
    }
    const gray=Math.round(r*.2126+g*.7152+b*.0722);
    data[i]=data[i+1]=data[i+2]=gray;
  }
  return data;
}
