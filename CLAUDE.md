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
| `npm run strat-ndvi` | infraroșul ortofotoului → `public/data/<hartă>-ndvi.bin` + `.json`, pe fiecare nod |
| `npm run verifica-teren` | construiește plasa cu codul paginii, în Node, și verifică ce primește și ce pictează regula de culoare |

Scripturile de construit hărți (`build-zona`, `build-petic`) cer date-sursă care
nu sunt în depozit; vezi mai jos. La fel `ortofoto` și `strat-ndvi`, care citesc
dala de ortofoto. Codul lor comun — proiecția TM06, mersul prin IFD-urile unui
TIFF, citirea unei hărți gata făcute, citirea și alinierea ortofotoului, OKLab,
EXIF-ul — stă în `scripts/comun/`.

## Arhitectură

- `src/main.js` — punctul de intrare; leagă scena de conținut, nimic altceva
- `src/scene/` — tot codul three.js. Nimic din three.js nu trăiește în afara acestui director.
- `src/chapters/` — câte un modul per capitol narativ, cu un `init()` și un `dispose()`
- `src/content/` — textele în română, ca date, separate de cod
- `public/` — modele, texturi, fotografii, decodoare. Servite ca atare.

## Convenții three.js r186 (esențiale)

- Bucla de animație: `renderer.setAnimationLoop(animate)`. **Nu** `requestAnimationFrame`
  — documentația oficială cere `setAnimationLoop` pentru compatibilitate.
- O animație proprie — întoarcerea camerei spre un punct de privire, un zbor de
  capitol — **nu** deschide al doilea `requestAnimationFrame`. Bucla rulează deja
  la fiecare cadru și decide doar *dacă* desenează, deci animația se agață în ea.
  Modelul e `busola.pas()`, chemat ca primă instrucțiune din buclă.
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

Depozitul păstrează **exact** harta pe care o încarcă pagina, cu straturile ei, și
nimic altceva: `harta_v1` plus baza ei, `harta_v0`, fiecare cu `-ndvi` alături. Hărțile de probă de dinainte — promontoriul
întreg din Copernicus GLO-30 și golful Lagosteiros — au fost șterse împreună cu
scripturile lor, tocmai ca să nu mai existe îndoială care hartă e „cea bună".
Sunt recuperabile din istoricul git.

Conturul unei hărți se scrie ca longitudine/latitudine în constanta
`POLIGON_GEO` din capul lui `scripts/build-zona.mjs` (sau `build-petic.mjs`),
iar scriptul îl proiectează în TM06 și decupează după el. Pagina doar îl citește
din sidecar; nu are unealtă de desenat sau de măsurat contururi.

### Stratul NDVI: `<nume>-ndvi.bin`

Pe fiecare nod al hărții, indicele de vegetație din infraroșul ortofotoului. E un
strat al aceleiași grile, nu o hartă nouă — de aceea poartă numele hărții, ca
`-dem`. Îl produce `npm run strat-ndvi` și intră în depozit, fiindcă dala de
ortofoto nu intră.

- **4 biți pe nod**: nodul `i` în octetul `i >> 1`, pe jumătatea de jos dacă `i` e
  par. Codul 0 = fără NDVI (apă, pixel fără date, nod pe care plasa nu-l
  folosește); 1–15 = NDVI după tabelul `niveluri` din sidecar, pas 0,05 pe
  [−0,10; 0,60]. Pagina decodează din tabel, nu dintr-o formulă.
- **De ce 15 niveluri:** pasul e cât zgomotul datelor citite. Pe `harta_v0`,
  NDVI-ul nivelului de 2 m diferă de media aceleiași imagini la 0,25 m cu mediana
  0,014, p90 0,040 — recomprimarea JPEG a nivelului, nu terenul. Un octet întreg
  l-ar stoca, cu +36% la transfer în loc de +13%. Măsurat: regula de culoare pe
  NDVI cuantizat față de necuantizat diferă cu ΔE_OK×100 medie 0,37, p99 1,95.
- **Baza citește nivelul de 2 m ca atare, cu zgomotul lui.** Nivelul de 0,5 m
  mediat 4 × 4 ar avea mediana 0,002 față de 0,25 m, iar nivelul de 2 m dă alt cod
  decât datele fine la 34% din noduri. Pe culoare efectul e în jur de 0,35 ΔE, sub
  prag. S-a păstrat nivelul de 2 m ca proba de clase să rămână comparabilă cu
  `ortofoto.mjs`; trecerea la 0,5 m e o îmbunătățire posibilă, nu o reparație.
- **Peticul NU se citește de la nivelul de 1 m.** Nodurile lui cad acolo pe
  COLȚURILE pixelilor (convenția „noduri", vezi mai jos), deci culorile ar ieși
  deplasate cu 0,707 m spre sud-est. Se ia media benzilor pe blocuri 2×2 de la
  nivelul de 0,5 m, iar NDVI-ul se calculează după medie. Nivelul îl alege
  `deschideAliniat()` din `scripts/strat-ndvi.mjs`: cel mai grosier pe care
  nodurile se aliniază exact (2 m la `harta_v0`, 0,5 m cu blocuri 2×2 la
  `harta_v1`). `aliniaza()` din `scripts/comun/ortofoto.mjs` nu alege nimic:
  primește un nivel, ține cont de convenția de noduri și aruncă dacă nu se
  aliniază. Verificarea de dinainte compara `bbox.xMin`, iar la `harta_v1`
  trecea tăcut. Tot în `comun/`, `fereastra()` refuză o fereastră care iese din
  dală, în loc să citească tăcut dale din alt loc.

Scriptul se oprește singur dacă pică una dintre probe:
- clasificarea din `ortofoto.mjs`, refăcută pe NDVI-ul lui, dă exact 122 388 /
  122 273 / 61 849 / 185 546 (tufăriș / uscată / calcar / potecă). Dovedește că
  cele două scripturi citesc același lucru, NU alinierea absolută: amândouă
  folosesc `aliniaza()` și `fereastra()`, deci un decalaj comun ar trece.
  Alinierea bazei stă pe aritmetică — nodul cade pe centrul pixelului, decalajul
  106 × 703 iese întreg;
- corelația NDVI dintre petic și bază, pe cele 62 902 noduri comune de uscat, are
  maximul la deplasare (0, 0): **0,9840**, iar vecinii de ±0,5 m sunt la 0,98. Proba e
  față de bază, nu față de alt nivel al ortofotoului: o greșeală comună de indice
  ar trece de a doua.

### Convenția `bbox_tm06`: două scripturi, două înțelesuri

`build-zona.mjs` scrie dreptunghiul de **decupare** (muchii de celulă), deci
primul nod cade la `xMin + pas/2`. `build-petic.mjs` scrie poziții de **noduri**
ale bazei, deci primul nod cade chiar la `xMin`. Diferența e o jumătate de celulă.

Semnul care le distinge, fără ambiguitate: `xMax − xMin` e `lățime · pas` la
prima și `(lățime − 1) · pas` la a doua (2328 față de 2326; 534 față de 535).
`scripts/comun/relief.mjs` **deduce** convenția din aritmetică și aruncă dacă nu
se potrivește niciuna. Nu presupune.

## Busola și nordul adevărat

Scena e așezată pe grila TM06: `+X` e estul grilei, `−Z` e **nordul grilei**.
Nordul adevărat e altceva. Zona stă la ~95 km vest de meridianul central al
proiecției (λ₀ = −8,133108°), deci convergența meridianelor e **γ = −0,673704°**:
nordul adevărat cade cu 0,67° la **est** de nordul grilei. Pe rozetă asta face
0,47 px — deci nu se vede, și tocmai de aceea nu se verifică din ochi.

γ **nu e scris ca o constantă.** `src/scene/busola.js` îl deduce din
`colturi_geo` al hărții de **bază** — `harta_v1` n-are cheia asta, numai
`harta_v0` — ca media azimutului celor două muchii verticale. Scalarea
longitudinii NU e `cos(φ)`, ci `cos(φ)·N(φ)/M(φ)` pe GRS80; cu `cos(φ)` singur γ
iese sistematic mai mic cu 0,414%. Fără `colturi_geo`, busola **nu se creează**
și spune de ce: mai bine lipsește decât să arate cu convingere un nord care nu e.

Verificare independentă, din parametrii proiecției:
`γ = atan(tan(λ−λ₀)·sin φ)` dă −0,673397°. Cele 0,0003° rămase sunt rotunjirea
colțurilor la șase zecimale în sidecar (~0,1 m pe o muchie de 2986 m). Un sidecar
cu mai puține zecimale ar lărgi eroarea proporțional, tăcut.

**Capcana semnului.** `OrbitControls.getAzimuthalAngle()` întoarce
`Spherical.theta = atan2(x, z)` al vectorului de la țintă la cameră, deci
`theta = 0` înseamnă camera la SUD, privind spre nord. `theta` **nu** e azimutul
privirii, ci minus el. „Nordul în sus" e `theta = γ`, nu `theta = 0`.

Cifra afișată e azimutul **poziției** camerei — dinspre ce direcție privești —,
nu al privirii. La pornire scrie `213° SV`, coerent cu `AZIMUT = 214` din
`camera.js` și cu fotografia de referință.

**Clicul nu întoarce scena cu nordul în sus.** Duce camera la un punct de
privire ales, `AZIMUT_TINTA` din `busola.js`, acum **300° NV** — privirea dinspre
nord-vest peste promontoriu. Eticheta butonului se scrie din constanta aceea, ca
textul și comportamentul să nu se poată despărți. Dacă vrei totuși „nordul în
sus", valoarea e 180: cifra fiind a poziției, stai în sud ca să privești spre nord.

**Camera se rotește punând `theta` ABSOLUT**, nu cu `rotateLeft()`. Acela există
și e public în r186, dar adaugă un *delta* într-un acumulator care se scurge
exponențial; deltele se compun, deci două clicuri repezi trec de nord cu exact
cât mai rămăsese de aplicat. `setAzimuthalAngle()` nu există.

**Theta absolut nu ajunge, totuși — inerția trebuie descărcată întâi.**
`update()` nu citește doar poziția camerei, ci îi ADAUGĂ acumulatorul:
`_spherical.theta += _sphericalDelta.theta * dampingFactor` (OrbitControls.js:717).
Cu amortizare pornită acumulatorul nu se golește niciodată — se stinge doar cu
×(1 − dampingFactor) pe cadru (:801). Singura ramură care îl golește e cea fără
amortizare (:808), iar `_sphericalDelta` e privat, deci aceea e toată calea
publică spre el. `laClic()` stinge amortizarea, cheamă `update()` o dată și o
repune — o singură dată la clic, nu pe fiecare cadru al zborului.

`laStart` nu acoperă cazul: butonul rozetei nu e copil al canvasului, deci
OrbitControls nu emite niciodată „start" la clicul pe el.

Cât greșea, măsurat: după o aruncare de 66° urmată imediat de clic, zborul
ateriza la **0,098°** de țintă — puțin, fiindcă `aplicaTheta` reașază poziția la
fiecare cadru și aruncă astfel contaminarea cadrului trecut, deci supraviețuia
numai ultima felie. Pe calea `prefers-reduced-motion` însă, unde `aplicaTheta`
se cheamă o SINGURĂ dată, se pierdea toată prima felie: `inerție × dampingFactor`,
măsurat exact **0,8°** pentru 10° rămase. Tocmai calea de accesibilitate greșea
cel mai mult.

Inerția se APLICĂ, nu se aruncă: ramura fără amortizare o adaugă întreagă înainte
să golească. Camera ajunge unde se ducea gestul, iar zborul pleacă de acolo.

**Probe care pot eșua.** La încadrarea de pornire busola scrie **213° SV**; cu
nordul grilei ar scrie 214°, cu semnul lui γ inversat 215°. După clic,
`__scena.controale.getAzimuthalAngle() * 180/Math.PI` trebuie să fie
**−120,673704** — pe grilă ar fi fost exact −120, deci zecimalele sunt chiar
dovada că punctul e cel adevărat, nu cel al grilei. Iar
`__scena.busola.convergenta` trebuie să cadă la mai puțin de 0,001 de valoarea
analitică: pragul e ales ca să pice dacă factorul elipsoidal lipsește.

## Punctul de sub clic

`src/scene/punct.js` — clic stâng pe scenă, iar panoul din stânga spune unde e
punctul, în trei sisteme, și cât de sus. Butonul copiază tot, cu punct zecimal:
panoul e text românesc și se citește, textul copiat pleacă în altă parte.

**Nu se dă raycast pe plasă.** `raycaster.intersectObject()` pe geometria
neindexată costă **53 ms pe rază**, măsurat pe cele 2,56 milioane de triunghiuri
de atunci. Pe un câmp de înălțimi nu e nevoie: se merge pe rază cu pasul de
8 m, se prinde schimbarea de semn față de `inaltimeLa`, apoi 22 de bisecții. Măsurat acum:
**0,19 ms**. Și e *mai* exact — pe fiecare celulă testează chiar interpolarea pe
care o citește `inaltimeLa`, nu triunghiurile plasei decupate.

**Butonul stâng rămâne al lui OrbitControls.** Selectorul de altădată îl
confisca; aici nu. Ce deosebește clicul de rotire e un prag de **5 px** între
apăsare și ridicare. Ridicarea se ascultă pe `globalThis`, nu pe canvas:
OrbitControls mută `pointermove`/`pointerup` pe `ownerDocument` cât ține
tragerea, deci o tragere care se termină în afara canvasului n-ar mai declanșa
niciodată ridicarea pe el, iar apăsarea ar rămâne agățată.

**Coordonatele au mereu acoperire, altitudinea nu.** Raza lovește un loc real
chiar și pe apă, deci lon/lat, scena și TM06 se arată întotdeauna. Altitudinea
primește etichetă, după două reguli verificabile:

- **„în afara hărții"** dacă punctul cade în afara lui `poligon_scena`. Contează:
  `inaltimeLa` prinde indicii la marginea grilei, deci acolo întoarce o valoare
  interpolată din celule care n-au fost nici măcar randate — la (900, 900) iese
  130,54 m, care pare măsurătoare și nu e.
- **„apă"** dacă altitudinea nu e strict pozitivă. Regula vine din sidecar, nu
  din ochi: `regula_apa` spune „exact 0.0 m sau NODATA (−999); plaja, care are
  valori mici dar nenule, rămâne uscat", iar celulele acelea sunt coborâte la
  `zMin_m = −8`, „artificiu de randare, nu batimetrie". Deci uscatul măsurat e
  strict pozitiv prin construcție; orice valoare negativă e umplutură sau
  interpolare cu ea.

`Y` din coordonatele de scenă **este** altitudinea, deci primește exact același
tratament: fără acoperire, se scrie „—", nu o cifră.

Altitudinea vine din `inaltimeLa` **compus** — peticul de 1 m acolo unde există,
baza de 2 m în rest. Nu e cosmetic: diferența dintre plase e ~2 mm în mijlocul
peticului și până la 0,153 m pe cusătură.

`src/scene/geo.js` face conversiile scenă ↔ TM06 ↔ longitudine/latitudine,
ancorate pe **centrul** lui `bbox_tm06` — vezi convenția de mai sus. Longitudinea
și latitudinea se dau cu **6 zecimale**, exact câte are `colturi_geo` în sidecar:
mai multe ar fi precizie inventată peste o sursă rotunjită.

## Cum se generează plasa terenului

`src/scene/terrain.js` transformă grila de înălțimi într-un singur mesh cu
fațete plate. Patru lucruri de acolo nu se pot ghici din cod fără măsurătoarea
care le-a motivat.

**Celulele de apă nu se generează.** Toate patru nodurile la `zMin_m` înseamnă
umplutură, nu batimetrie — o spune `regula_apa` din sidecar. Sunt 477 166 din
cele 907 427 de celule păstrate ale bazei (52,6%) și 122 858 din cele 373 800
ale peticului (32,9%), iar marea e un plan **opac** de 40 km la `COTA_MARE`, pe
sub care camera nu poate coborî: ținta stă la y = 60, `minDistance` e 80 și
`maxPolarAngle` e π/2 − 0,04, deci camera rămâne peste 64,6 m. Erau desenate la
fiecare cadru și nu se puteau vedea niciodată. Triunghiuri: 2 562 454 → 1 362 406.

Se taie numai celulele cu TOATE patru nodurile la cotă; malul rămâne întreg. Iar
`inaltimeLa` citește din `grila`, nu din plasă, deci panoul punctului măsoară
peste apă exact ca înainte — verificat: un clic pe mare întoarce punctul la
centimetru și eticheta „apă".

**Nu există atribut `normal`.** Cu `flatShading: true`, shaderul r186 nu-l
citește: sub `FLAT_SHADED` varianta `vNormal` nici nu se declară, iar
`normal_fragment_begin` calculează `normalize(cross(dFdx, dFdy))` — planul
fațetei, adică exact ce am fi scris. Pe geometrie neindexată cu normale de
fațetă cele două sunt același plan. Scapă 92 248 344 de octeți din RAM și de pe
placă, plus 127 ms de `computeVertexNormals()` la fiecare pornire.

**Culoarea stă pe `Uint16` normalizat**, 6 octeți pe vârf în loc de 12. `Uint8`
NU merge: valorile din atribut sunt liniare, iar un pas de 1/255 în liniar
înseamnă la luminozitate mică ~2,5 niveluri de afișare — benzi pe faleza
umbrită. Pe 16 biți eroarea e 0,0005–0,0011 dintr-un nivel din 255.

**Conversia sRGB → liniar se face dintr-un tabel de 256 de intrări**, nu prin
`Color.setHex` pe fiecare fațetă. E bit-identică — aceeași formulă din
`ColorManagement.SRGBToLinear`, pe aceeași intrare `octet / 255` —, verificată
în pagină față de `setHex` însuși pe șapte culori, inclusiv alb, negru și
0x010101.

**Sfera de încadrare se scrie, nu se calculează.** Dar nu se poate nici lăsa
`null`: `WebGLRenderer` o calculează el pe calea de sortare, activă implicit.

Efectul cumulat, măsurat pe pagină: atributele de vârf scad de la 276 745 032 la
**73 569 924 de octeți (−73,4%)**, în RAM și pe GPU deodată.

Proba care contează: randare într-o țintă fixă de 640 × 400, aceeași cameră,
înainte și după. Din 256 000 de pixeli **diferă 176, adică 0,069%, fiecare cu
exact 1 din 255 pe un singur canal** — cuantizarea culorii, răsturnând rotunjirea
acolo unde pixelul stătea chiar pe pragul ei. Nu e „identic la pixel", și nu se
scrie așa.

## Cum se colorează terenul

`culoareTeren(panta, altitudine, p, ndvi)` din `src/scene/palette.js`. Regula a fost
multă vreme `TODO(human)`, ca decizie de autor; autorul a delegat-o explicit, iar
ea s-a scris din măsurători. Comentariul de deasupra ei poartă cifra care a decis
fiecare parametru.

**De ce are nevoie de NDVI.** Numai din pantă și altitudine nu se află unde e
vegetația. Tufărișul și vegetația uscată au aceeași pantă mediană (14,1° față de
12,6°) și aceeași altitudine mediană (103,3 față de 103,4 m); cea mai bună regulă
posibilă pe cele două le desparte la întâmplare pe date nevăzute, iar antrenată pe
sudul hărții și aplicată pe nord cade sub clasa majoritară. Informația stă în
infraroșul ortofotoului — vezi stratul NDVI, la hărți.

**Ce face:**
- roca: potecă → calcar după pantă, lin între 20° și 40°;
- vegetația: uscată → tufăriș după NDVI, liniar între medianele claselor, 0,261 →
  0,410. Nu sunt două populații: NDVI-ul vegetației are un singur vârf, iar pragul
  vechi de 0,341 îl tăia la mediană;
- cât din fiecare: rampă pe NDVI, de la mediana rocii (0,017) la a vegetației uscate;
- faleza: peste 55° vegetația se stinge, peste 70° e numai rocă — ortofotoul vede
  peretele din muchie;
- amestecul se face în RGB **liniar**, cum reflectă o fațetă acoperită pe jumătate;
- fără strat: vegetația după cotă, în patru noduri măsurate;
- fără `p.masurat`: `GRI_REZERVA`.

**Apa n-are caz special, și nu trebuie să aibă.** Fațetele de la mal coboară la
umplutura de −8 m pe cel mult 2 m în plan, deci au panta de peste 76° și ies calcar
exact. Pe petic câteva fațete de la apă stau întregi sub mare, în inelul de
cusătură, unde relieful e interpolat între −8 m și uscat: nu se văd niciodată.

**Albedo, nu aparență.** Regula nu corectează lumina. Cu soarele la 18°, platoul
chiar iese mai închis decât în pozele de la amiază; asta se reglează în lumini sau
în expunere, nu în culoare.

**Probe care pot eșua** — toate în `npm run verifica-teren`:
- argumentul primit de fiecare din cele 1 362 406 fațete e egal cu o recalculare
  independentă din `.bin`: **0 nepotriviri**. Proba chiar pică dacă un indice de nod
  e greșit — încercat;
- toate fațetele de la apă de deasupra mării ies calcar (3 986 pe bază, 2 714 pe petic);
- calea fără strat o iau numai fațetele scufundate întregi (700 + 549);
- **0** fațete diferă între tema de zi și cea de noapte;
- peticul față de ce ar picta baza sub el: ΔE_OK×100 al mediilor **0,245** pe toată
  zona, 0,115 pe fâșia de 20 m de la margine — dreptunghiul peticului nu se vede;
- numai cu dala de ortofoto pe disc: ΔE față de ortofoto, pe cele 855 836 de
  fațete de uscat ale bazei, **10,22** medie / 8,49 mediană; pragul e 11. Pe
  aceleași fațete griul de rezervă dă 11,70, iar regula fără strat 15,56 — deci
  pragul prinde o regulă căzută înapoi pe gri sau un strat ignorat. Cu ancore potrivite pe
  ortofoto ar fi 5,46: diferența e că paleta e albedo, iar ortofotoul are umbrele
  în el. Cifra aceea nu se calculează în unealtă.

Regula costă +23 ms la construcția bazei, în Node.

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
nodul LiDAR fără reeșantionare. La `harta_v1` pasul se potrivește, dar
alinierea NU: pe convenția „noduri", amprenta primului nod începe la 1180,5 ×
2298,5 pixeli, deci nodurile cad pe colțurile pixelilor. Peticul se citește de la
nivelul de 0,5 m, mediat 2 × 2 — vezi stratul NDVI, mai sus. Scriptul verifică asta și se oprește dacă nu iese.
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
