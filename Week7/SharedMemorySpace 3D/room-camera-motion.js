// Fit the open room from directly in front, including the nearest wall edges.
export function frontRoomView({x,y,z},aspect,fov=45){
  const tangent=Math.tan(fov*Math.PI/360);
  const distance=Math.max(x/(2*tangent*Math.max(.1,aspect)),y/(2*tangent))*1.18;
  return {target:[0,y/2,0],position:[0,y/2,z/2+distance]};
}
export function roomEntryProgress(elapsed,duration=1100){
  const t=Math.max(0,Math.min(1,elapsed/duration));
  return t*t*t*(t*(t*6-15)+10);
}
