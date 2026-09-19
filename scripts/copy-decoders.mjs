import { cp, mkdir } from 'node:fs/promises';

const base = 'node_modules/three/examples/jsm/libs';
await mkdir('public/draco', { recursive: true });
await mkdir('public/basis', { recursive: true });
await cp(`${base}/draco/gltf`, 'public/draco', { recursive: true });
await cp(`${base}/basis`, 'public/basis', { recursive: true });
console.log('Decodoare copiate în public/draco și public/basis');
