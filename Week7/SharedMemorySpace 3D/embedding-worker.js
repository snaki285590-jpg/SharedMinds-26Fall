import {createSemanticEngine} from './embedding-runtime.js';
const run=createSemanticEngine(data=>self.postMessage(data));
self.onmessage=({data})=>run(data);
