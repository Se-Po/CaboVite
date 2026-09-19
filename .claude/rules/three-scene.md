---
paths:
  - "src/scene/**"
  - "src/chapters/**"
  - "src/main.js"
---

# Reguli three.js (r186)

## Renderer și buclă

```js
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setAnimationLoop(animate);   // nu requestAnimationFrame
```

`renderer.outputColorSpace` este deja `SRGBColorSpace` și `THREE.ColorManagement`
este activ implicit — nu le seta redundant.

Pentru tone mapping alege explicit (`ACESFilmicToneMapping`, `AgXToneMapping` sau
`NeutralToneMapping`); implicit este `NoToneMapping`.

## Redimensionare — tiparul oficial din manual

Nu folosi `renderer.setPixelRatio(window.devicePixelRatio)`. Manualul oficial îl
descrie ca „strongly NOT RECOMMENDED": pe un telefon cu DPI 3x înseamnă de 9 ori
mai multă muncă. Calculează dimensiunea singur, cu plafon:

```js
function resizeRendererToDisplaySize(renderer, maxPixelCount = 2560 * 1440) {
  const canvas = renderer.domElement;
  let pixelRatio = window.devicePixelRatio;
  let width = canvas.clientWidth * pixelRatio;
  let height = canvas.clientHeight * pixelRatio;
  const pixelCount = width * height;
  if (pixelCount > maxPixelCount) {
    const scale = Math.sqrt(maxPixelCount / pixelCount);
    width = Math.floor(width * scale);
    height = Math.floor(height * scale);
  } else {
    width = Math.floor(width);
    height = Math.floor(height);
  }
  const needResize = canvas.width !== width || canvas.height !== height;
  if (needResize) renderer.setSize(width, height, false);  // false e obligatoriu
  return needResize;
}
```

În buclă:

```js
if (resizeRendererToDisplaySize(renderer)) {
  const canvas = renderer.domElement;
  camera.aspect = canvas.clientWidth / canvas.clientHeight;
  camera.updateProjectionMatrix();
}
```

## Randare la cerere

Scena aceasta este în mare parte statică. Nu randa continuu: randează la
`controls.addEventListener('change', ...)`, la resize și la schimbarea capitolului.
Economisește baterie pe mobil și este tiparul recomandat în manual.

## Eliberarea resurselor

Scoaterea din scenă nu eliberează nimic. La schimbarea capitolului:

```js
function disposeObject(root) {
  root.traverse((obj) => {
    obj.geometry?.dispose();
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of materials) {
      if (!m) continue;
      for (const value of Object.values(m)) {
        if (value?.isTexture) value.dispose();   // materialul NU-și eliberează texturile
      }
      m.dispose();
    }
  });
}
```

Verifică scurgerile cu `renderer.info.memory.geometries` / `.textures` și numărul
de draw call-uri cu `renderer.info.render.calls`.

## Performanță

- Un `Mesh` = cel puțin un draw call. Multe obiecte identice → `InstancedMesh`.
  Geometrii diferite, același material → `BatchedMesh`. Obiecte statice variate →
  `BufferGeometryUtils.mergeGeometries()`.
- Depărtări mari → `LOD` cu `lod.addLevel(mesh, distance)`.
- Memoria unei texturi este `lățime × înălțime × 4 × 1.33` octeți, **indiferent**
  de formatul fișierului. Un JPG nu ocupă mai puțină memorie GPU decât un PNG.
  Micșorează dimensiunile, nu doar greutatea fișierului.
- Obiecte care nu se mișcă: `obj.matrixAutoUpdate = false; obj.updateMatrix();`

## Încărcare modele

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

const draco = new DRACOLoader().setDecoderPath('/draco/');
const ktx2 = new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer);

const loader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2);
const gltf = await loader.loadAsync('/models/far.glb');
```

`detectSupport(renderer)` trebuie apelat înainte de orice încărcare.
Creează o singură instanță `DRACOLoader` și refolosește-o.
