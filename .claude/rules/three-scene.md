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

## Redimensionare — tiparul din manual, cu plafoanele proiectului

Nu folosi `renderer.setPixelRatio(window.devicePixelRatio)`. Manualul oficial îl
descrie ca „strongly NOT RECOMMENDED": pe un telefon cu DPI 3x înseamnă de 9 ori
mai multă muncă. Calculează dimensiunea singur, cu două plafoane: raportul de
pixeli cel mult 2 (alegerea autorului) și 2560 × 1440 de pixeli de dispozitiv.
În proiect funcția există: `redimensioneaza()` din `src/scene/renderer.js`.
Folosește-o pe aceea, nu o copie.

```js
function redimensioneaza(renderer, maxPixeli = 2560 * 1440) {
  const canvas = renderer.domElement;
  const raport = Math.min(globalThis.devicePixelRatio || 1, 2);   // DPR ≤ 2
  let latime = canvas.clientWidth * raport;
  let inaltime = canvas.clientHeight * raport;
  const pixeli = latime * inaltime;
  if (pixeli > maxPixeli) {
    const scara = Math.sqrt(maxPixeli / pixeli);
    latime = Math.floor(latime * scara);
    inaltime = Math.floor(inaltime * scara);
  } else {
    latime = Math.floor(latime);
    inaltime = Math.floor(inaltime);
  }
  const nevoie = canvas.width !== latime || canvas.height !== inaltime;
  if (nevoie) renderer.setSize(latime, inaltime, false);  // false e obligatoriu
  return nevoie;
}
```

Funcția din proiect întoarce `true` și când s-a schimbat numai mărimea CSS a
canvasului, cu bufferul neschimbat — mărirea paginii —, ca bucla să refacă
decalajul imaginii: `docs/randarea.md`, „Mărimea canvasului”.

În buclă:

```js
if (redimensioneaza(renderer)) {
  const canvas = renderer.domElement;
  camera.aspect = canvas.clientWidth / canvas.clientHeight;
  camera.updateProjectionMatrix();
}
```

## Randare la cerere

Scena aceasta este în mare parte statică. Nu randa continuu: randează la
`controls.addEventListener('change', ...)`, la resize și la schimbarea capitolului
(când vor exista capitole narative).
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

Scoaterea din scenă nu eliberează nimic. La schimbarea capitolului (când vor exista
capitole narative):

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
- Memoria unei texturi **necomprimate pe GPU** este `lățime × înălțime × 4 × 1.33`
  octeți: JPG, PNG, WebP, și KTX2 pe un GPU fără niciun format comprimat (calea
  RGBA). Un JPG nu ocupă mai puțină memorie GPU decât un PNG. Micșorează
  dimensiunile, nu doar greutatea fișierului.
- KTX2 rămâne comprimat pe GPU. În r186 (`FORMAT_OPTIONS` din `KTX2Loader.js`):
  UASTC → ASTC 4×4 sau BC7, 1 octet pe pixel; ETC1S → ETC2 sau ETC1 pe telefon,
  0,5 octeți pe pixel fără alfa (cu alfa, ETC2 RGBA, 1 octet; ETC1 n-are alfa și cade pe
  RGBA), iar pe un desktop fără ETC → BC7, 1 octet. Toate × ~1,33 cu mipurile.
  4096 × 4096 face ~89 MB necomprimat, ~22 MB în UASTC.
- Obiecte care nu se mișcă: `obj.matrixAutoUpdate = false; obj.updateMatrix();`

## Încărcare modele

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

// Fără cale de decodor: în r186 amândouă își iau decodorul din three,
// cu `new URL('../libs/…', import.meta.url)`, iar Vite îl emite în dist/assets.
const draco = new DRACOLoader();
const ktx2 = new KTX2Loader().detectSupport(renderer);

const loader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2);
const gltf = await loader.loadAsync('/models/exemplu.glb');
```

Nimic nu se copiază în `public/draco/` sau `public/basis/`: directoarele sunt
gitignorate, iar Vercel, care construiește din commit, nu le-ar publica — local ar
merge, publicat ar da 404. Cu o cale scrisă de mână, decodorul s-ar livra și de
două ori. Încercat pe 2026-10-09, cu un build de probă care importă `DRACOLoader`:
Vite pune în `dist/assets` cinci fișiere Draco, 1 314 796 B, din care decodorul
cere numai două. `DRACO_GLTF_CONFIG`, exportat de același modul, dă decodorul
numai pentru glTF (`setDecoderPath(DRACO_GLTF_CONFIG)`), dar cere WebAssembly.

În proiect, încărcătorul KTX2 există: `creeazaIncarcatorKtx2(renderer)` din
`src/scene/loaders.js` face `new KTX2Loader().detectSupport(renderer)`, după
`verificaTranscodorul()`, iar `elibereazaKtx2()` îl eliberează. Folosește-le pe
acelea: `docs/satelit.md`, „În pagină: `src/scene/satelit.js`”. Farul nu e un
model: se construiește din `public/data/cladiri_v1.json`.

`detectSupport(renderer)` trebuie apelat înainte de orice încărcare.
Creează o singură instanță `DRACOLoader` și refolosește-o.
