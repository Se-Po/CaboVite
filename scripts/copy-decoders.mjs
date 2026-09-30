// Decodoarele Draco și KTX2 pentru glTF.
//
// NU se rulează încă. Nimic din `src/` nu importă GLTFLoader sau DRACOLoader, iar
// `public/` se copiază întreg în `dist/`: rulat degeaba, pune acolo peste un MB pe
// care nu-l cere nicio linie de cod. De aceea cele două directoare sunt gitignorate.
//
// Texturile vederii Satelit NU au nevoie de el: KTX2Loader din r186 își găsește
// singur transcodorul, cu `new URL('../libs/basis/…', import.meta.url)`, iar Vite
// îl emite la build. Cu `setTranscoderPath('/basis/')` s-ar fi livrat de două ori.

import { cp, mkdir } from 'node:fs/promises';

const base = 'node_modules/three/examples/jsm/libs';
await mkdir('public/draco', { recursive: true });
await mkdir('public/basis', { recursive: true });
await cp(`${base}/draco/gltf`, 'public/draco', { recursive: true });
await cp(`${base}/basis`, 'public/basis', { recursive: true });
console.log('Decodoare copiate în public/draco și public/basis');
