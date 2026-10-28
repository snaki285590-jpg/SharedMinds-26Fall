import assert from 'node:assert/strict';
import {extractImageUrl} from '../image-result.js';
assert.equal(extractImageUrl({input:{image_input:['https://input.jpg']},urls:{get:'https://poll'},output:['https://generated.png']}),'https://generated.png');
assert.equal(extractImageUrl({input:{image_input:['https://input.jpg']},urls:{get:'https://poll'}}),null);
assert.equal(extractImageUrl({data:{output:['https://out.png']}}),'https://out.png');
assert.equal(extractImageUrl({status:'failed',output:'https://bad.png'}),null);
console.log('PASS generated output selection excludes reference photos, polling URLs and failed results');
