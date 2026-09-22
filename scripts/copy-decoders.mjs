// Decodoarele Draco și KTX2 pentru glTF.
//
// NU se rulează încă. Nimic din `src/` nu importă GLTFLoader, DRACOLoader sau
// KTX2Loader, iar `public/` se copiază întreg în `dist/`: rulat degeaba, pune
// acolo 1 349 591 de octeți pe care nu-i cere nicio linie de cod. Se rulează
// când intră primul `.glb` — de aceea cele două directoare sunt și gitignorate,
// ca o clonă curată să nu le moștenească.

import { cp, mkdir } from 'node:fs/promises';

const base = 'node_modules/three/examples/jsm/libs';
await mkdir('public/draco', { recursive: true });
await mkdir('public/basis', { recursive: true });
await cp(`${base}/draco/gltf`, 'public/draco', { recursive: true });
await cp(`${base}/basis`, 'public/basis', { recursive: true });
console.log('Decodoare copiate în public/draco și public/basis');
