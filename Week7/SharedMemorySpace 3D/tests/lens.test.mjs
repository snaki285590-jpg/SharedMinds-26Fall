import assert from 'node:assert/strict';
import {lensSettings,lensPointer} from '../lens-math.js';
assert.equal(lensSettings(0).fov,32);assert.equal(lensSettings(1).fov,145);
assert.equal(lensSettings(.5).strength,0);assert.ok(lensSettings(1).strength>2.5);
assert.deepEqual(lensPointer(.5,-.7,1.5,0),[.5,-.7]);
assert.deepEqual(lensPointer(0,0,1.5,.85),[0,0]);
for(const aspect of [.4,1,2])for(const value of [0,.3,.7,1]){
 const s=lensSettings(value);assert.ok(lensPointer(.7,.8,aspect,s.strength).every(Number.isFinite));
}
console.log('PASS lens: zoom bounds, smooth fish-eye onset, identity picking, centered and finite warped coordinates');

assert.ok(lensPointer(.2,.2,1,2.6)[0]<.2,'Peephole expands the image center');
