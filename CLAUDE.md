# Cabo Espichel — pagină 3D interactivă

Pagină web narativă despre promontoriul Cabo Espichel (Sesimbra, Portugalia):
geologie, urme de dinozauri, legendă mariană, far, fotografie personală.
Scenă 3D interactivă + text lung, într-o singură pagină.

**Limba proiectului este româna.** Tot textul vizibil, comentariile din cod,
numele de capitole și mesajele de commit se scriu în română. Discuția cu mine
se poartă în română.

## Stack

- three.js **0.186.0 (r186)**, versiune fixă în `package.json`, fără `^`
- Vite 8 (dev server + build)
- JavaScript modern, module ES, fără framework. Nu introduce React, TypeScript
  sau alt strat fără să întrebi întâi.

## Comenzi

| Comandă | Ce face |
|---|---|
| `npm run dev` | dev server pe http://localhost:5173 |
| `npm run build` | build de producție în `dist/` |
| `npm run preview` | servește build-ul de producție |
| `npm run copy-decoders` | copiază decodoarele Draco/KTX2 în `public/` |

## Arhitectură

- `src/main.js` — punctul de intrare; leagă scena de conținut, nimic altceva
- `src/scene/` — tot codul three.js. Nimic din three.js nu trăiește în afara acestui director.
- `src/chapters/` — câte un modul per capitol narativ, cu un `init()` și un `dispose()`
- `src/content/` — textele în română, ca date, separate de cod
- `public/` — modele, texturi, fotografii, decodoare. Servite ca atare.

## Convenții three.js r186 (esențiale)

- Bucla de animație: `renderer.setAnimationLoop(animate)`. **Nu** `requestAnimationFrame`
  — documentația oficială cere `setAnimationLoop` pentru compatibilitate.
- Importă addon-urile ca `three/addons/...`, nu `three/examples/jsm/...`.
- `THREE.Clock` e deprecat din r183 → folosește `THREE.Timer`.
- `PCFSoftShadowMap` a fost **eliminat** în r186 → `THREE.PCFShadowMap`.
- Texturile de culoare (`.map`, `.emissiveMap`) primesc `texture.colorSpace = THREE.SRGBColorSpace`.
  Cele de date (`.normalMap`, `.roughnessMap`, `.metalnessMap`) rămân `NoColorSpace`.
- Orice `BufferGeometry`, `Material`, `Texture`, `WebGLRenderTarget` creat trebuie
  să aibă un `.dispose()` corespunzător. Scoaterea din scenă **nu** eliberează memoria GPU.
- Rămânem pe `WebGLRenderer`. `WebGPURenderer` e încă experimental în r186.

Detaliile complete sunt în `.claude/rules/three-scene.md`, încărcate automat
când lucrezi în `src/scene/`.

## Cum îți verifici munca

Înainte să spui că o modificare e gata:

1. `npm run build` trebuie să treacă fără erori.
2. Deschide panoul Browser (Ctrl+Shift+B / Cmd+Shift+B), încarcă pagina,
   fă un screenshot și **uită-te la el**. O scenă 3D poate compila perfect și
   afișa un ecran negru.
3. Citește consola browserului. Avertismentele WebGL contează.
4. Verifică la lățime de 390px, nu doar pe desktop.

Nu declara nimic funcțional fără dovadă. Dacă nu poți verifica, spune asta.

## Flux de lucru

- Nu comite și nu împinge nimic fără să-ți cer eu explicit.
- Versiunea se schimbă o dată la fiecare push, cu etichetă `v0.0.N`. Fiecare
  commit are un număr `0.0.N.xx`, scris ca prefix în subiect.

## Hărțile de relief

Hărțile se numesc `harta_vN` și trăiesc în `public/data/<nume>-dem.bin` +
`.json`. O hartă nouă — alt contur sau altă rezoluție — primește un nume nou;
nu se suprascrie una existentă. Numele e scris și în sidecar, la cheia `nume`.

| hartă | sursă | acoperire |
|---|---|---|
| `harta_v0` | LiDAR DGT 2024-2025, MDT 2 m | conturul ales în pagină, 4,00 km², 2 m |
| `espichel-dem` | Copernicus DEM GLO-30 | promontoriul întreg, 4,12 × 3,93 km, ~30 m |
| `lagosteiros-dem` | LiDAR DGT, MDT 2 m | golful Lagosteiros, 1,5 × 1,1 km, 2 m |

Pagina încarcă una singură, aleasă în `src/scene/loaders.js`. Datele-sursă
(`date-sursa/`) nu intră în depozit; hărțile produse, da — altfel pagina nu se
poate încărca dintr-o clonă curată.

Zona se alege cu selectorul de poligon din pagină, iar panoul „Coordonate" dă
conturul exact în forma constantei `POLIGON_GEO` din `scripts/build-zona.mjs`.

## Principii de design (nenegociabile)

- **Accesibilitate:** fonturi mari, contrast ridicat. Cititorii pot fi vârstnici.
- **Responsivitate** reală, pe toate dimensiunile și nivelurile de zoom.
- **Navigare clară:** nav sticky, breadcrumbs, scrollspy.
- **Degradare grațioasă:** pagina trebuie să rămână lizibilă și fără WebGL.
  Textul este conținutul; scena 3D îl servește, nu invers.
- `prefers-reduced-motion` oprește animațiile automate ale camerei.

## Acuratețe factuală

Conținutul se sprijină pe surse primare portugheze (Diocese de Setúbal,
Câmara Municipal de Sesimbra, monumentos.gov.pt / SIPA, literatura
paleontologică). Nu inventa date, cifre sau nume. Dacă o afirmație nu are
sursă, marcheaz-o `<!-- NEVERIFICAT -->` și spune-mi.

IMPORTANT: diferența de vârstă dintre siturile Pedra da Mua (Jurasic superior)
și Lagosteiros (Cretacic inferior) este de ~15–20 milioane de ani. Cifra
„50 de milioane" care circulă în versiunile vechi ale textului este greșită.
