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
| `npm run citeste-poze` | inventarul fotografiilor din `date-sursa/poze/` |
| `npm run culori-poze` | grupează culorile din poze, scoate pagina de etichetat |
| `npm run ortofoto` | culori din ortofotoul aerian DGT (RGB + infraroșu) |
| `npm run paleta` | culorile etichetate → `public/data/paleta-teren.json` |

Scripturile de construit hărți (`build-zona`, `build-petic`) cer date-sursă care
nu sunt în depozit; vezi mai jos. Codul lor comun — proiecția TM06, mersul prin
IFD-urile unui TIFF, citirea unei hărți gata făcute, EXIF-ul — stă în
`scripts/comun/`.

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
| `harta_v1` | LiDAR DGT, MDT 50 cm mediat | petic de 534 × 700 m la 1 m, peste `harta_v0` |
| `harta_v0` | LiDAR DGT 2024-2025, MDT 2 m | conturul ales în pagină, 4,00 km², 2 m |

O hartă poate avea cheia `baza`: atunci e un **petic** de rezoluție mai mare,
iar `incarcaRelief()` încarcă și baza. Scena generează două plase — baza, cu o
gaură exact sub petic, și peticul deasupra. Nodurile peticului cad peste ale
bazei din doi în doi, iar inelul lui exterior ia relieful bazei, așa că muchia
comună e aceeași linie și nu rămâne nicio crăpătură.

Pagina încarcă o singură hartă (plus baza ei), aleasă în `src/scene/loaders.js`. Datele-sursă
(`date-sursa/`) nu intră în depozit; hărțile produse, da — altfel pagina nu se
poate încărca dintr-o clonă curată.

Depozitul păstrează **exact** harta pe care o încarcă pagina, și nimic altceva:
`harta_v1` plus baza ei, `harta_v0`. Hărțile de probă de dinainte — promontoriul
întreg din Copernicus GLO-30 și golful Lagosteiros — au fost șterse împreună cu
scripturile lor, tocmai ca să nu mai existe îndoială care hartă e „cea bună".
Sunt recuperabile din istoricul git.

Conturul unei hărți se scrie ca longitudine/latitudine în constanta
`POLIGON_GEO` din capul lui `scripts/build-zona.mjs` (sau `build-petic.mjs`),
iar scriptul îl proiectează în TM06 și decupează după el. Pagina doar îl citește
din sidecar — nu mai există unealtă de desenat contururi în ea.

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

## Fotografiile de la fața locului

Originalele stau în `date-sursa/poze/` — date-sursă, deci în afara depozitului,
lângă `lidar/`. `public/photos/` e altceva: fotografiile pe care le *afișează*
pagina, redimensionate. Copiază-le prin USB; WhatsApp, Telegram și descărcarea
din Google Photos pe web șterg sau degradează GPS-ul din EXIF.

`npm run citeste-poze` citește EXIF-ul fără să decodeze niciun pixel și întreabă
hărțile de relief unde cade fiecare poză. Scrie `date-sursa/poze/indice.json`.

Două lucruri pe care le-a scos la iveală și care rămân valabile:

- **Altitudinea din EXIF e elipsoidală**, deși Android o etichetează cu
  `GPSAltitudeRef = 0`, „deasupra nivelului mării". LiDAR-ul DGT e ortometric.
  Diferența e ondulația geoidului, 52,92 m aici (EGM2008, via GeoidEval). Fără
  scăderea ei, cele două par să difere cu ~58 m. Altitudinea de folosit e cea din
  LiDAR: GPS-ul telefonului e bun lateral (~5 m) și slab pe verticală (~±10 m).
- **`0x0010` din GPS IFD e `GPSImgDirectionRef`, nu direcția** — direcția e
  `0x0011`. Inversate, litera „M" citită ca număr dă 77 la fiecare poză, adică o
  valoare constantă care pare măsurătoare și nu e.

Ce **nu** pot face pozele: să picteze harta. EXIF-ul nu conține înclinarea și
rotația camerei, deci o poză nu se poate proiecta pe relief. Rolul lor e să dea
culorile măsurate cu care `culoareTeren()` pictează toată harta.

### Lanțul culorilor

`citeste-poze` → `culori-poze` → *etichetat de om* → `paleta`

`culori-poze` grupează culorile în **OKLab**, nu în RGB: distanța din OKLab
corespunde diferenței percepute, deci grupurile ies acolo unde le-ar vedea și
ochiul. k-means pornește cu **sămânță fixă** — fără ea, fiecare rulare dă alte
grupuri, iar etichetele puse de om pe „grupul 5" ajung pe alt material.

Etichetele stau în `date-sursa/poze/etichete.json`, **cheie pe culoare, nu pe
numărul grupului**: numărul e doar ordinea de afișare, culoarea e lucrul la care
omul s-a uitat. Fiecare petic primește eticheta reperului celui mai apropiat în
OKLab, deci etichetele supraviețuiesc unei regrupări.

`paleta` scoate **albedo, nu aparență**. O fotografie măsoară materialul înmulțit
cu lumina care cădea pe el; calcarul a ieșit în trei grupuri care sunt aceeași
piatră în umbră, la umbră deschisă și în soare. Media lor n-ar exista nicăieri pe
promontoriu. three.js înmulțește culoarea vârfului cu propria lui lumină, deci o
umbră coaptă în culoare s-ar aplica de două ori. Luminozitatea se ia din cuantila
0,8 (materialul în soare), iar nuanța numai din peticele peste mediană — umbra e
albastră de la cer și ar trage albedoul spre rece.

`masurat.nuanta_de_incredere` e fals când croma e sub 0,02: fotografiile nu susțin
nicio nuanță anume și materialul iese practic neutru. **Nu se inventează una.**
La calcar, vegetație uscată și tufăriș e fals — vezi nota din `paleta-teren.json`.

### Ortofotoul, și de ce nu înlocuiește fotografiile

`ORTOS-2025` de la DGT, dala `ORTOS-2025-cog-25cm-464-3` (283 MB, în
`date-sursa/ortofoto/`, deci în afara depozitului). **BigTIFF**, nu TIFF clasic:
magic 43, numărul de intrări dintr-un IFD pe 8 octeți, intrări de 20 de octeți,
valori inline până în 8 octeți. `citesteIfd(..., big)` din `scripts/comun/tiff.mjs`
tratează ambele.

Piramida lui are nivel la **2 m** și la **1 m** — exact pașii lui `harta_v0` și
`harta_v1`. Colțul e la TM06 (−96000, −135000) cu pas 0,25 m, iar decalajul până
la `harta_v0` iese **106 × 703 pixeli, întregi**: pixelul ortofotoului cade peste
nodul LiDAR fără reeșantionare. Scriptul verifică asta și se oprește dacă nu iese.
Control independent: numărul de celule de uscat din contur, 492 056, e identic cu
`acoperire.uscat_masurat_in_poligon` din sidecar.

Dalele sunt JPEG cu `JPEGTables` partajate (73 de octeți: SOI + o tabelă de
cuantizare + EOI) și `PlanarConfiguration = 2`, deci fiecare dală e un flux JPEG
**prescurtat**, cu un singur canal. Se lipește tabela imediat după SOI-ul dalei,
altfel nu se decodează.

**Cele două surse sunt oarbe una acolo unde cealaltă vede, și e geometrie, nu
preferință:**

- fotografiile de la sol măsoară bine numai ce era aproape de aparat; restul a
  venit prin kilometri de aer, care împrăștie albastrul. Tufărișul avea `B > G`
  în poze (`#3b4447`) și `G > B` în ortofoto (`#516868`), cu croma dublă.
- ortofotoul n-are drumul acela de aer, dar privește drept în jos, deci vede o
  faleză aproape din muchie.

Deci: platoul de la ortofoto, faleza și ce-a fost sub picioare din fotografii.
Tabelul `SURSA` din `scripts/paleta.mjs` ține regula, iar fiecare material din
`paleta-teren.json` poartă ambele măsurători, cu `sursa` și `de_ce`.

`npm run paleta` merge și fără ortofoto — dala nu intră în depozit, deci cine
clonează trebuie să poată reface paleta numai din fotografii.

## Selectorul 3D

`src/scene/selectie3d.js` — o cutie aliniată la axele scenei: dreptunghi tras pe
teren pentru X-Z, bandă de altitudine pentru Y. Panoul `#unelte` din `index.html`
scoate coordonatele gata de pus în `scripts/build-zona.mjs`.

**E o unealtă, nu conținut.** Se scoate ștergând trei bucăți — `<aside id="unelte">`
din `index.html`, blocul `#unelte` din `main.css` și `legPanoul()` din `main.js`.
Decupajul hărții nu atârnă de ea: acela trăiește în sidecar și în `scena.js`.

Ce s-a hotărât și de ce:

- **Verticala aruncă celule întregi**, nu taie triunghiuri. Terenul e o pânză,
  n-are interior; marginea urmează curbele de nivel. Decizia se ia pe înălțimea
  din *centrul* celulei — media celor patru colțuri, care pe un patrulater
  bilinear chiar *este* valoarea din centru, deci același punct ca pentru X-Z.
- **Mânerele de altitudine merg pe deplasare de ECRAN**, nu pe proiecție în
  lume. Scena e de 20 de ori mai lată decât înaltă (X ±1163 m, Z ±1492 m, Y de la
  −8 la 143,6). Prima variantă proiecta raza pe un plan vertical: geometric
  corect, dar la o cameră de 1600 m o tragere scurtă prăbușea banda dintr-o dată.
  Acum o tragere pe toată înălțimea ecranului parcurge exact tot intervalul de
  altitudine — ~0,2 m pe pixel, la fel de previzibil de aproape ca de departe.
- **Regenerarea se face la eliberarea butonului**, nu în timpul tragerii:
  `creeazaTeren()` alocă până la ~250 MB pentru baza de 1164 × 1493.
- **Cutia e aliniată la TM06, nu la nord.** Scripturile decupează în TM06; o
  cutie rotită față de ele ar cere reeșantionare. Rotația de ~0,7° o poartă cele
  patru colțuri raportate în longitudine/latitudine.
- Selecția se ține în `localStorage` și **se reaplică la reîncărcare** — asta
  înseamnă „folosesc numai acea selecție". Butonul *Tot* o desface.

`src/scene/geo.js` face conversiile scenă ↔ TM06 ↔ longitudine/latitudine.
**Ancorează pe centrul cutiei, nu pe un colț** — vezi mai jos de ce.

### Convenția `bbox_tm06`: două scripturi, două înțelesuri

`build-zona.mjs` scrie dreptunghiul de **decupare** (muchii de celulă), deci
primul nod cade la `xMin + pas/2`. `build-petic.mjs` scrie poziții de **noduri**
ale bazei, deci primul nod cade chiar la `xMin`. Diferența e o jumătate de celulă.

Semnul care le distinge, fără ambiguitate: `xMax − xMin` e `lățime · pas` la
prima și `(lățime − 1) · pas` la a doua (2328 față de 2326; 534 față de 535).
`scripts/comun/relief.mjs` **deduce** convenția din aritmetică și aruncă dacă nu
se potrivește niciuna. Nu presupune.

Ancorat pe **centrul** cutiei, conversia nu mai depinde deloc de convenție:
nodurile sunt simetrice față de centru în ambele cazuri. Verificat pe `harta_v0`
și `harta_v1` — deci pe ambele convenții — plus pe o a treia hartă de atunci,
ștearsă între timp: diferență exact zero. De aceea `geo.js` folosește
`TM06 = scenă + centrul cutiei`, iar nu un colț.

### Ce a ieșit la recenzie, și rămâne valabil

- **Nu se dă raycast pe plasă.** `raycaster.intersectObject()` pe geometria
  neindexată de 2,75 milioane de triunghiuri costă **53 ms pe rază**, măsurat pe
  desktop. `pointermove` vine de 60–120 de ori pe secundă. Selectorul merge în
  schimb pe rază folosind `inaltimeLa` și prinde schimbarea de semn, apoi
  bisectează: **0,34 ms**, de 156 de ori mai rapid. Diferența dintre suprafața
  biliniară și cea din triunghiuri e mediana 3,6 mm, maxim 17 cm pe o celulă de
  2 m — răsucirea celulei, nu o eroare.
- **`renderOrder` nu trece granița opac/transparent.** three.js sortează în două
  liste, iar cea opacă se desenează prima; `renderOrder` contează numai în
  interiorul uneia. De aceea materialul liniilor are `transparent: true` deși e
  opac — altfel planele-mânere i-ar spăla muchiile.
- **`controale.touches` se schimbă separat de `mouseButtons`.** OrbitControls le
  citește din două locuri; fără al doilea, pe telefon o tragere cu un deget
  rotește camera **și** desenează dreptunghiul.
- **`dispose()` trece prin aceeași listă ca eșecul pornirii** (`deEliberat` /
  `curata()`). O listă scrisă de mână sărise deja peste selector o dată: trei
  geometrii vii, patru ascultători de pointer rămași, iar o tragere de după
  `dispose()` reconstruia 250 MB într-o scenă moartă.
- **Un clic fără mișcare nu regenerează.** Se compară o amprentă a cutiei luată
  la apăsare; altfel orice clic rătăcit costa ~250 MB și 2,75 M de triunghiuri
  pentru zero schimbare. Acum costă 2,2 ms.
- **Materialul terenului se creează o dată** și se injectează în amândouă
  plasele. Recreat la fiecare regenerare, ducea `usedTimes` la zero și forța o
  recompilare de shader la fiecare selecție.
- **`fog: false` pe materialele uneltei** — ceața începe la 5000 m, iar pe 390 px
  camera ajunge la ~4350.
