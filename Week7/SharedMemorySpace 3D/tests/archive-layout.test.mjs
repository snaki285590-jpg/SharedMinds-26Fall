import assert from 'node:assert/strict';
import {archiveLayout,archiveRoomStyle} from '../archive-layout.js';
for(const n of [0,1,2,8,20,80]){
 const points=archiveLayout(n);
 assert.equal(points.length,n);
 assert.equal(new Set(points.map(p=>JSON.stringify(p))).size,n);
 assert.ok(points.every(p=>p.length===3&&p.every(Number.isFinite)));
 for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
   const d=points[i].map((v,k)=>Math.abs(v-points[j][k]));
   assert.ok(d[0]>=5.4||d[1]>=3.6||d[2]>=3.8,'Room volumes must not intersect');
 }
 assert.deepEqual(points,archiveLayout(n));
}
const points=archiveLayout(20);
for(let axis=0;axis<3;axis++)assert.ok(new Set(points.map(p=>p[axis])).size>1,'All XYZ axes must have depth');
const span=axis=>Math.max(...points.map(p=>p[axis]))-Math.min(...points.map(p=>p[axis]));
assert.ok(span(1)>span(0)*2&&span(1)>span(2)*2,'Archive must form a tall narrow composition');
console.log('PASS shared XYZ archive: unique finite coordinates, all axes, spacing, deterministic semantic slots');

for(const key of ['resident-1','resident-2','resident-3']){
 assert.deepEqual(archiveRoomStyle(key),{scale:[1,1,1],yaw:0});
}
console.log('PASS uniform physical room size and orientation; perspective controls apparent size');

assert.notDeepEqual(archiveLayout(20,123),archiveLayout(20,456));
assert.deepEqual(archiveLayout(20,123),archiveLayout(20,123));
for(const seed of [1,123,456,4294967295]){
 const rows=archiveLayout(30,seed);
 for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
  const d=rows[i].map((v,k)=>Math.abs(v-rows[j][k]));
  assert.ok(d[0]>=5.4||d[1]>=3.6||d[2]>=3.8);
 }
}
console.log('PASS Random: different seeds rearrange rooms, same seed stays stable, no overlapping volumes');
