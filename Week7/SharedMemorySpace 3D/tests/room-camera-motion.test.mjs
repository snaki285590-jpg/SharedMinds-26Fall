import assert from 'node:assert/strict';
import {frontRoomView,roomEntryProgress} from '../room-camera-motion.js';
for(const aspect of [.4,1,2.2]){
 const dims={x:8,y:5,z:7},view=frontRoomView(dims,aspect);
 assert.equal(view.position[0],0);assert.equal(view.position[1],view.target[1]);
 const near=view.position[2]-dims.z/2,tan=Math.tan(Math.PI/8);
 assert.ok(near*tan*aspect>dims.x/2);assert.ok(near*tan>dims.y/2);
}
assert.equal(roomEntryProgress(0),0);assert.equal(roomEntryProgress(1100),1);
let prior=0;for(let ms=0;ms<=1100;ms+=10){const p=roomEntryProgress(ms);assert.ok(p>=prior&&p<=1);prior=p;}
console.log('PASS front view: portrait/landscape fit, centered camera, smooth monotonic entry');
