import assert from 'node:assert/strict';
import {conjure,unit,pca,normalizePoints} from '../semantic-math.js';
const records=[{key:'you',vector:unit([1,0,0])},{key:'home',vector:unit([1,.1,0])},{key:'night',vector:unit([0,1,.1])},{key:'music',vector:unit([0,0,1])}];
const positions={home:[.2,.3,.7],night:[.8,.7,.2],music:[.4,.8,.6]};
const first=conjure(records[1].vector,records,positions,'you');
const second=conjure(records[2].vector,records,positions,'you');
assert.deepEqual(first.you,[0,0,0]);assert.deepEqual(second.you,[0,0,0]);
assert(Math.hypot(...first.home)<Math.hypot(...first.night));
assert(Math.hypot(...second.night)<Math.hypot(...second.home));
for(const key of ['home','night','music'])assert.notDeepEqual(first[key],second[key]);
assert(Object.values(first).flat().every(Number.isFinite));
for(const vectors of [[],[[1,0,0]],[[1,0,0],[1,0,0]],records.map(r=>r.vector)]){
 const points=normalizePoints(pca(vectors,3));assert(points.every(p=>p.length===3&&p.every(Number.isFinite)));
}
assert.deepEqual(conjure(null,[],{},'you'),{});
console.log('PASS query stays centered; all neighbors rearrange; semantic radial ordering; finite 3D small-collection fallback');
