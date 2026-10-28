import assert from 'node:assert/strict';
import {removeGreenBackground} from '../chroma-key.js';
const pixels=new Uint8ClampedArray([0,255,0,255,130,210,65,255,220,220,220,255,40,40,40,120,90,130,90,200,255,255,255,0]);
removeGreenBackground(pixels);
assert.equal(pixels[3],0);assert.equal(pixels[7],0);
assert.equal(pixels[11],255);assert.equal(pixels[15],120);
assert.ok(pixels[19]>0&&pixels[19]<200);assert.equal(pixels[23],0);
for(let i=0;i<pixels.length;i+=4){assert.equal(pixels[i],pixels[i+1]);assert.equal(pixels[i+1],pixels[i+2]);}
console.log('PASS cutouts: green/lime transparency, soft edges, grayscale, existing alpha preserved');
