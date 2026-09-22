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

## Ordinea de desenare

`renderOrder` **nu trece granița opac/transparent.** three.js sortează obiectele
în două liste — opacă și transparentă — și o desenează pe cea opacă prima;
`renderOrder` contează numai în interiorul uneia. Un material opac cu
`renderOrder: 999` ajunge tot înaintea unuia transparent cu `998`, oricât ar
părea de invers.

Ca `renderOrder` să însemne ce pare că înseamnă între două obiecte, amândouă
trebuie să fie în aceeași listă. Un material perfect opac se poate muta în lista
transparentă cu `transparent: true` — nu pentru transparență, ci pentru sortare.

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

`dispose()` trebuie să treacă prin **aceeași listă** ca eșecul pornirii, nu
printr-o copie scrisă de mână. Ține resursele într-un tablou de închideri, în
ordinea creării, golește-l dintr-o singură funcție idempotentă și cheam-o din
amândouă locurile — din `catch`-ul de la pornire și din `dispose()`:

```js
const deEliberat = [];
const curata = () => {
  // Fiecare eliberare în try-ul ei: una care aruncă ar ascunde excepția adevărată.
  for (const f of deEliberat.reverse()) {
    try { f(); } catch (e) { console.warn('eliberare eșuată:', e.message); }
  }
  deEliberat.length = 0;
};
```

Înregistrează fiecare resursă **imediat** după ce ai creat-o, nu pe toate la
sfârșit: dacă a doua alocare aruncă, prima trebuie să fie deja în listă. Două căi
scrise separat se despart încet — una capătă o resursă nouă, cealaltă n-o află
niciodată, iar ce rămâne viu sunt exact geometriile și ascultătorii pe care nu-i
mai caută nimeni.

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
